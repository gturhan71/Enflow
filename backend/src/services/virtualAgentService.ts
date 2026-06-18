import { prisma } from '../prismaClient';
import { isPluginEntitled } from './entitlementService';
import { getPlugin, type AgentMode } from './pluginCatalog';
import { agentActorId } from './agentProvenance';

// ── Sanal Agent Servisi ──────────────────────────────────────────────────────
// Boş koltuğu dolduran vekil: bir birimin işini yapar, çıktı üretir, gerçek
// kişiye devreder. Danışman modunda çıktı PENDING_RATIFICATION kalır.
//
// Handler kayıt defteri (registry): her agent eklentisi için bir fonksiyon.
// Yeni birim agent'ı = registry'e bir satır. Deterministik (LLM gerekmez).

export interface AgentOutput {
  rationale: string;            // insan-okunur gerekçe
  output: Record<string, unknown>; // yapısal çıktı
  // devir görevi başlığı/özeti
  taskTitle: string;
}

type AgentHandler = (tenantId: string, entityId: string) => Promise<AgentOutput | null>;

// ── İhale/İSAB handler: checklist eksiksizliği + deadline riski ───────────────
const tenderHandler: AgentHandler = async (tenantId, entityId) => {
  const tender = await prisma.tender.findFirst({
    where: { id: entityId, tenantId },
    include: { checklist: true },
  });
  if (!tender) return null;

  const required = tender.checklist.filter((c) => c.isRequired);
  const missing = required.filter((c) => c.status === 'PENDING');
  const done = required.filter((c) => c.status === 'DONE' || c.status === 'WAIVED');

  // Deadline riski (iş günü yaklaşık — saf gün farkı)
  let deadlineNote = 'Son teslim tarihi belirtilmemiş.';
  let deadlineRisk: 'NONE' | 'WARNING' | 'OVERDUE' = 'NONE';
  if (tender.submissionDeadline) {
    const days = Math.ceil(
      (tender.submissionDeadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000),
    );
    if (days < 0) { deadlineRisk = 'OVERDUE'; deadlineNote = `Son teslim tarihi ${-days} gün GEÇTİ.`; }
    else if (days <= 7) { deadlineRisk = 'WARNING'; deadlineNote = `Son teslime ${days} gün kaldı (kritik).`; }
    else { deadlineNote = `Son teslime ${days} gün var.`; }
  }

  const complete = missing.length === 0;
  const rationale = complete
    ? `Uygunluk denetimi tamamlandı: ${required.length} zorunlu kalemin tümü hazır. ${deadlineNote} Teklif gönderimine hazır — onayınızı bekliyor.`
    : `Uygunluk denetimi: ${required.length} zorunlu kalemden ${missing.length} tanesi EKSİK (${missing.map((m) => m.name).join(', ')}). ${deadlineNote} Eksikler tamamlanmadan teklif gönderilemez.`;

  return {
    rationale,
    output: {
      tenderName: tender.name,
      ikn: tender.ikn,
      requiredCount: required.length,
      doneCount: done.length,
      missingItems: missing.map((m) => m.name),
      deadlineRisk,
      deadlineNote,
      readyToSubmit: complete,
    },
    taskTitle: complete
      ? `İhale uygunluk denetimi hazır: ${tender.name} (onay bekliyor)`
      : `İhale eksik evrak: ${tender.name} (${missing.length} zorunlu kalem)`,
  };
};

// ── Proje handler: devir paketi eksik evrak + geciken milestone ───────────────
const projectHandler: AgentHandler = async (tenantId, entityId) => {
  const project = await prisma.project.findFirst({
    where: { id: entityId, tenantId },
    include: { handoverDocs: true, milestones: true },
  });
  if (!project) return null;

  const requiredDocs = project.handoverDocs.filter((d) => d.isRequired);
  const missingDocs = requiredDocs.filter(
    (d) => !['UPLOADED', 'VERIFIED', 'WAIVED'].includes(d.status),
  );

  const now = Date.now();
  const overdueMilestones = project.milestones.filter(
    (m) =>
      m.status !== 'COMPLETED' &&
      m.status !== 'CANCELLED' &&
      m.plannedEnd &&
      m.plannedEnd.getTime() < now,
  );

  const handoverReady = missingDocs.length === 0;
  const parts: string[] = [];
  parts.push(
    handoverReady
      ? `Devir paketi tam: ${requiredDocs.length} zorunlu evrakın tümü hazır.`
      : `Devir paketi eksik: ${requiredDocs.length} zorunludan ${missingDocs.length} evrak eksik (${missingDocs.map((d) => d.name).join(', ')}).`,
  );
  parts.push(
    overdueMilestones.length === 0
      ? 'Geciken milestone yok.'
      : `${overdueMilestones.length} milestone gecikmede: ${overdueMilestones.map((m) => m.title).join(', ')}.`,
  );

  return {
    rationale: parts.join(' ') + ' Proje yöneticisinin incelemesi bekleniyor.',
    output: {
      projectName: project.name,
      projectCode: project.code,
      requiredDocCount: requiredDocs.length,
      missingDocs: missingDocs.map((d) => d.name),
      handoverReady,
      overdueMilestones: overdueMilestones.map((m) => m.title),
    },
    taskTitle: handoverReady
      ? `Proje devir paketi hazır: ${project.name} (onay bekliyor)`
      : `Proje devir eksik: ${project.name} (${missingDocs.length} evrak)`,
  };
};

// ── Presales handler: BoM eksiksizlik + maliyet/marj tutarlılığı ──────────────
const presalesHandler: AgentHandler = async (tenantId, entityId) => {
  const proposal = await prisma.proposal.findFirst({
    where: { id: entityId, tenantId },
    include: { opportunity: true },
  });
  if (!proposal) return null;

  const oppId = proposal.opportunityId;
  const [bom, costs] = await Promise.all([
    prisma.boMItem.findMany({ where: { opportunityId: oppId } }),
    prisma.costItem.findMany({ where: { opportunityId: oppId, tenantId } }),
  ]);

  // Eksiksizlik denetimi — tender checklist mantığının aynısı (sorun listesi)
  const issues: string[] = [];
  if (bom.length === 0) issues.push('BoM (malzeme listesi) boş');
  const missingPrice = bom.filter((b) => !b.unitSalePrice || b.unitSalePrice <= 0);
  if (missingPrice.length > 0) issues.push(`${missingPrice.length} kalemde satış fiyatı yok`);
  const zeroCost = bom.filter((b) => !b.purchaseCost || b.purchaseCost <= 0);
  if (zeroCost.length > 0) issues.push(`${zeroCost.length} kalemde alış maliyeti 0/eksik`);
  const lowMargin = bom.filter((b) => typeof b.marginPercentage === 'number' && b.marginPercentage < 10);
  if (lowMargin.length > 0) issues.push(`${lowMargin.length} kalemde marj %10 altında`);

  const avgMargin = bom.length
    ? Math.round((bom.reduce((s, b) => s + (b.marginPercentage || 0), 0) / bom.length) * 100) / 100
    : 0;
  const costTotal = costs.reduce((s, c) => s + (c.amount || 0), 0);

  const consistent = issues.length === 0;
  const rationale = consistent
    ? `Presales denetimi tamamlandı: ${bom.length} BoM kalemi tutarlı, ortalama marj %${avgMargin}. Ek maliyet kalemi: ${costs.length}. Teklif hazırlığına uygun — onayınızı bekliyor.`
    : `Presales denetimi: ${issues.length} tutarsızlık bulundu (${issues.join('; ')}). Ortalama marj %${avgMargin}. Düzeltilmeden teklif kesinleştirilemez.`;

  return {
    rationale,
    output: {
      proposalVersion: proposal.version,
      bomCount: bom.length,
      avgMargin,
      additionalCostItems: costs.length,
      additionalCostTotal: costTotal,
      issues,
      consistent,
    },
    taskTitle: consistent
      ? `Presales BoM denetimi hazır: ${proposal.opportunity?.title ?? 'Teklif'} (onay bekliyor)`
      : `Presales tutarsızlık: ${proposal.opportunity?.title ?? 'Teklif'} (${issues.length} sorun)`,
  };
};

// ── Satınalma handler: PR doğrulaması + tekliflerden tedarikçi önerisi ─────────
const procurementHandler: AgentHandler = async (tenantId, entityId) => {
  const pr = await prisma.purchaseRequest.findFirst({
    where: { id: entityId, tenantId },
    include: { items: true, quotes: true },
  });
  if (!pr) return null;

  // Doğrulama denetimi — eksiklik listesi
  const issues: string[] = [];
  if (pr.items.length === 0) issues.push('Talep kalemi yok');
  const noPrice = pr.items.filter((i) => i.estimatedUnitPrice == null);
  if (noPrice.length > 0) issues.push(`${noPrice.length} kalemde tahmini birim fiyat yok`);
  if (pr.quotes.length === 0) issues.push('Hiç tedarikçi teklifi yok');

  // Tedarikçi önerisi — en düşük toplam (TRY varsa onu, yoksa nominal)
  let recommendation: { vendorName: string; amount: number; currency: string; deliveryDays: number | null } | null = null;
  if (pr.quotes.length > 0) {
    const sorted = [...pr.quotes].sort(
      (a, b) => (a.totalAmountTRY ?? a.totalAmount) - (b.totalAmountTRY ?? b.totalAmount),
    );
    const best = sorted[0];
    recommendation = {
      vendorName: best.vendorName,
      amount: best.totalAmountTRY ?? best.totalAmount,
      currency: best.totalAmountTRY ? 'TRY' : best.currency,
      deliveryDays: best.deliveryDays ?? null,
    };
  }
  const alreadySelected = pr.quotes.some((q) => q.isSelected);

  // İhtiyaç tarihi riski (tender deadline mantığı)
  let neededNote = 'İhtiyaç tarihi belirtilmemiş.';
  let neededRisk: 'NONE' | 'WARNING' | 'OVERDUE' = 'NONE';
  if (pr.neededBy) {
    const days = Math.ceil((pr.neededBy.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (days < 0) { neededRisk = 'OVERDUE'; neededNote = `İhtiyaç tarihi ${-days} gün GEÇTİ.`; }
    else if (days <= 7) { neededRisk = 'WARNING'; neededNote = `İhtiyaç tarihine ${days} gün kaldı (kritik).`; }
    else { neededNote = `İhtiyaç tarihine ${days} gün var.`; }
  }

  const valid = issues.length === 0;
  const recText = recommendation
    ? ` Önerilen tedarikçi: ${recommendation.vendorName} (${recommendation.amount.toLocaleString('tr-TR')} ${recommendation.currency}${recommendation.deliveryDays ? `, ${recommendation.deliveryDays} gün teslim` : ''}).`
    : '';
  const rationale = valid
    ? `Satınalma talebi doğrulandı: ${pr.items.length} kalem, ${pr.quotes.length} teklif.${recText} ${neededNote}${alreadySelected ? ' Tedarikçi zaten seçili.' : ' Tedarikçi seçimi onayınızı bekliyor.'}`
    : `Satınalma talebi eksik: ${issues.join('; ')}.${recText} ${neededNote} Eksikler tamamlanmadan PO açılamaz.`;

  return {
    rationale,
    output: {
      title: pr.title,
      status: pr.status,
      itemCount: pr.items.length,
      quoteCount: pr.quotes.length,
      issues,
      recommendedVendor: recommendation?.vendorName ?? null,
      recommendedAmount: recommendation?.amount ?? null,
      alreadySelected,
      neededRisk,
      neededNote,
    },
    taskTitle: valid
      ? `Satınalma önerisi hazır: ${pr.title} (onay bekliyor)`
      : `Satınalma eksik: ${pr.title} (${issues.length} sorun)`,
  };
};

// ── Finans handler: eşik altı maliyet onay önerisi (yalnızca DANIŞMAN) ─────────
// Para — asla otonom değil (catalog allowedModes:['ADVISORY']). İnsan ratifiye eder.
const FINANCE_AUTO_APPROVE_THRESHOLD_TRY = 50000; // eşik altı → onay önerilir
const financeHandler: AgentHandler = async (tenantId, entityId) => {
  const cost = await prisma.projectCostItem.findFirst({
    where: { id: entityId, project: { tenantId } },
    include: { project: true },
  });
  if (!cost) return null;

  const amount = cost.amountTRY || cost.plannedAmount || 0;
  const belowThreshold = amount > 0 && amount <= FINANCE_AUTO_APPROVE_THRESHOLD_TRY;
  const decision = cost.approvalStatus !== 'PENDING'
    ? `Kalem zaten ${cost.approvalStatus}. Yeni öneri gerekmiyor.`
    : belowThreshold
      ? `Tutar (${amount.toLocaleString('tr-TR')} ₺) ${FINANCE_AUTO_APPROVE_THRESHOLD_TRY.toLocaleString('tr-TR')} ₺ eşiğinin ALTINDA — ONAY önerilir.`
      : `Tutar (${amount.toLocaleString('tr-TR')} ₺) eşiğin ÜZERİNDE — üst yönetim incelemesi/ek belge önerilir.`;

  const recommendation = cost.approvalStatus !== 'PENDING'
    ? 'NO_ACTION'
    : belowThreshold ? 'APPROVE_SUGGESTED' : 'REVIEW_NEEDED';

  return {
    rationale: `Finans maliyet onay denetimi: "${cost.description}" (${cost.category}), proje ${cost.project?.code ?? cost.project?.name ?? ''}. ${decision} (Danışman modu — kararı insan ratifiye eder.)`,
    output: {
      description: cost.description,
      category: cost.category,
      amountTRY: amount,
      threshold: FINANCE_AUTO_APPROVE_THRESHOLD_TRY,
      currentStatus: cost.approvalStatus,
      recommendation,
    },
    taskTitle: `Finans maliyet onay önerisi: ${cost.description} (${recommendation === 'APPROVE_SUGGESTED' ? 'onay öneriliyor' : recommendation === 'REVIEW_NEEDED' ? 'inceleme öneriliyor' : 'işlem yok'})`,
  };
};

const HANDLERS: Record<string, AgentHandler> = {
  AGENT_TENDER: tenderHandler,
  AGENT_PROJECT: projectHandler,
  AGENT_PRESALES: presalesHandler,
  AGENT_PROCUREMENT: procurementHandler,
  AGENT_FINANCE: financeHandler,
};

export function hasHandler(pluginKey: string): boolean {
  return pluginKey in HANDLERS;
}

/**
 * Bir agent eklentisini çalıştır. Lisans kapısı + handler + devir.
 * Sonuç AgentRun (PENDING_RATIFICATION). Otonom modda auto-ratify edilir.
 */
export async function runAgent(params: {
  tenantId: string;
  pluginKey: string;
  entityId: string;
  triggeredById?: string;
}): Promise<{ ok: boolean; error?: string; run?: unknown }> {
  const { tenantId, pluginKey, entityId, triggeredById } = params;
  const plugin = getPlugin(pluginKey);
  if (!plugin) return { ok: false, error: 'Bilinmeyen eklenti' };

  // Lisans kapısı — onay mekanizmasının içindeki tek kontrol noktası
  const entitled = await isPluginEntitled(tenantId, pluginKey);
  if (!entitled) return { ok: false, error: 'Bu eklenti için aktif lisans yok' };

  const handler = HANDLERS[pluginKey];
  if (!handler) return { ok: false, error: 'Bu eklenti için handler henüz hazır değil (COMING_SOON)' };

  const ent = await prisma.pluginEntitlement.findUnique({
    where: { tenantId_pluginKey: { tenantId, pluginKey } },
  });
  const mode = (ent?.mode as AgentMode) || plugin.defaultMode || 'ADVISORY';

  const result = await handler(tenantId, entityId);
  if (!result) return { ok: false, error: 'İşlenecek varlık bulunamadı' };

  // Kanonik aktör kimliği — köken etiketi ('AGENT:<pluginKey>')
  const actorId = agentActorId(pluginKey);

  // Önce AgentRun (köken kaydı) — handoff görevi ve loglar buna bağlanır
  const autoRatify = mode === 'AUTONOMOUS';
  const run = await prisma.agentRun.create({
    data: {
      tenantId,
      pluginKey,
      unitKey: plugin.unitKey ?? '',
      entityType: plugin.entityType ?? '',
      entityId,
      mode,
      status: autoRatify ? 'RATIFIED' : 'PENDING_RATIFICATION',
      rationale: result.rationale,
      outputJson: JSON.stringify(result.output),
      triggeredById: triggeredById ?? null,
      ratifiedById: autoRatify ? actorId : null,
      ratifiedAt: autoRatify ? new Date() : null,
    },
  });

  // Devir görevi (gerçek kişiye) — unit çözümlemesi: ilk birim, yoksa task atla
  const unit = await prisma.unit.findFirst({ where: { tenantId } });
  let handoffTaskId: string | null = null;
  if (unit) {
    const task = await prisma.todoTask.create({
      data: {
        title: result.taskTitle,
        description: `🤖 ${plugin.name} tarafından hazırlandı.\n\n${result.rationale}`,
        unitId: unit.id,
        assignedBy: actorId,
        priority: 'HIGH',
        relatedModule: plugin.entityType ?? 'GENERAL',
        relatedItemId: entityId,
        agentRunId: run.id,
        tenantId,
      },
    });
    handoffTaskId = task.id;
    await prisma.agentRun.update({ where: { id: run.id }, data: { handoffTaskId } });
    run.handoffTaskId = handoffTaskId; // dönen nesneyi güncel tut
  }

  // Denetim logu — köken etiketli (actorType=AGENT, agentRunId)
  await prisma.activityLog.create({
    data: {
      action: 'AGENT_RUN',
      entityType: plugin.entityType ?? 'AGENT',
      entityId,
      details: JSON.stringify({ pluginKey, mode, rationale: result.rationale }),
      userId: triggeredById ?? actorId,
      actorType: 'AGENT',
      agentRunId: run.id,
      tenantId,
    },
  });

  return { ok: true, run };
}

/** Devir alan gerçek kişi çıktıyı ratifiye eder veya reddeder. */
export async function ratifyAgentRun(params: {
  tenantId: string;
  runId: string;
  decision: 'RATIFY' | 'REJECT';
  ratifiedById?: string;
  ratifyNote?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { tenantId, runId, decision, ratifiedById, ratifyNote } = params;
  const run = await prisma.agentRun.findFirst({ where: { id: runId, tenantId } });
  if (!run) return { ok: false, error: 'Çalıştırma bulunamadı' };
  if (run.status !== 'PENDING_RATIFICATION') {
    return { ok: false, error: 'Yalnızca onay bekleyen çalıştırmalar ratifiye edilebilir' };
  }
  await prisma.agentRun.update({
    where: { id: run.id },
    data: {
      status: decision === 'RATIFY' ? 'RATIFIED' : 'REJECTED',
      ratifiedById: ratifiedById ?? null,
      ratifiedAt: new Date(),
      ratifyNote: ratifyNote ?? null,
    },
  });
  return { ok: true };
}

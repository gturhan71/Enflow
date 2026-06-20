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
  // opsiyonel otonom eylem — yalnız AUTONOMOUS modda + reversible ise çalıştırılır
  autonomousAction?: {
    kind: string;               // makine-okunur eylem türü ('SELECT_CHEAPEST_QUOTE')
    summary: string;            // insan-okunur sonuç
    reversible: boolean;        // güvenlik kapısı — yalnız true olanlar otomatik çalışır
    execute: () => Promise<void>;
  } | null;
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
  let best: (typeof pr.quotes)[number] | null = null;
  if (pr.quotes.length > 0) {
    const sorted = [...pr.quotes].sort(
      (a, b) => (a.totalAmountTRY ?? a.totalAmount) - (b.totalAmountTRY ?? b.totalAmount),
    );
    best = sorted[0];
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
    // Otonom eylem: en ucuz teklifi seç — yalnız eksiksiz, öneri var ve henüz seçilmemişse
    autonomousAction:
      valid && recommendation && best && !alreadySelected
        ? {
            kind: 'SELECT_CHEAPEST_QUOTE',
            summary: `En ucuz teklif seçildi: ${recommendation.vendorName} (${recommendation.amount.toLocaleString('tr-TR')} ${recommendation.currency})`,
            reversible: true, // deselect-all → select; idempotent ve geri-alınabilir
            execute: async () => {
              await prisma.purchaseQuote.updateMany({
                where: { purchaseRequestId: entityId },
                data: { isSelected: false },
              });
              await prisma.purchaseQuote.update({
                where: { id: best!.id },
                data: { isSelected: true },
              });
              await prisma.purchaseRequest.update({
                where: { id: entityId },
                data: { selectedVendorId: best!.vendorId, selectedVendorName: best!.vendorName },
              });
            },
          }
        : null,
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

const legalHandler: AgentHandler = async (tenantId, entityId) => {
  const c = await prisma.legalCase.findFirst({ where: { id: entityId, tenantId } });
  if (!c) return null;

  const isOpen = c.status !== 'CLOSED';
  const overdue = !!c.dueDate && isOpen && new Date(c.dueDate) < new Date();
  const hasOpinion = !!(c.opinion && c.opinion.trim());
  const issues: string[] = [];
  if (isOpen && !hasOpinion) issues.push('Hukuki görüş (opinion) henüz girilmemiş.');
  if (overdue) issues.push(`Termin geçti (${new Date(c.dueDate!).toLocaleDateString('tr-TR')}).`);
  if (c.priority === 'HIGH' && isOpen) issues.push('Yüksek öncelikli açık vaka.');

  const recommendation = !isOpen
    ? 'NO_ACTION'
    : overdue
      ? 'ESCALATE'
      : !hasOpinion
        ? 'DRAFT_OPINION'
        : 'REVIEW';

  const recLabel = recommendation === 'ESCALATE' ? 'üst makama taşıma (ESCALATED) öneriliyor'
    : recommendation === 'DRAFT_OPINION' ? 'hukuki görüş taslağı hazırlanması öneriliyor'
    : recommendation === 'REVIEW' ? 'inceleme öneriliyor'
    : 'işlem gerekmiyor';

  return {
    rationale: `Hukuki vaka denetimi: "${c.title}" (${c.type}, öncelik ${c.priority}, durum ${c.status}). ${issues.length ? issues.join(' ') : 'Belirgin eksik yok.'} → ${recLabel}. (Danışman modu — kararı insan hukukçu ratifiye eder.)`,
    output: {
      type: c.type,
      status: c.status,
      priority: c.priority,
      overdue,
      hasOpinion,
      issues,
      recommendation,
    },
    taskTitle: `Hukuk önerisi: ${c.title} (${recommendation === 'ESCALATE' ? 'escalate' : recommendation === 'DRAFT_OPINION' ? 'görüş taslağı' : recommendation === 'REVIEW' ? 'inceleme' : 'işlem yok'})`,
  };
};

const DAY_MS = 86400000;

const crmHandler: AgentHandler = async (tenantId, entityId) => {
  const opp = await prisma.opportunity.findFirst({
    where: { id: entityId, tenantId },
    include: { proposals: true },
  });
  if (!opp) return null;

  const isOpen = !['WON', 'LOST', 'CANCELLED'].includes(opp.status);
  const ageDays = Math.floor((Date.now() - new Date(opp.updatedAt).getTime()) / DAY_MS);
  const proposalCount = opp.proposals.length;
  const duePast = !!opp.expectedCloseDate && new Date(opp.expectedCloseDate) < new Date();

  const issues: string[] = [];
  if (isOpen && ageDays > 30) issues.push(`${ageDays} gündür güncellenmemiş (bayat).`);
  if (isOpen && (!opp.probability || opp.probability <= 0)) issues.push('Kazanma olasılığı girilmemiş.');
  if (isOpen && (!opp.expectedCloseDate || duePast)) issues.push('Beklenen kapanış tarihi yok/geçmiş.');
  if (isOpen && ['QUALIFIED', 'PROPOSAL', 'NEGOTIATION'].includes(opp.status) && proposalCount === 0) issues.push('Bu aşamada henüz teklif yok.');
  const atRisk = isOpen && opp.probability > 0 && opp.probability < 30 && opp.value >= 250000;
  if (atRisk) issues.push(`Düşük olasılık (%${opp.probability}) + yüksek değer (${opp.value.toLocaleString('tr-TR')} ₺).`);

  const recommendation = !isOpen
    ? 'NO_ACTION'
    : atRisk
      ? 'AT_RISK'
      : (['QUALIFIED', 'PROPOSAL', 'NEGOTIATION'].includes(opp.status) && proposalCount === 0)
        ? 'PROPOSAL_NEEDED'
        : (!opp.probability || !opp.expectedCloseDate || duePast)
          ? 'UPDATE_FIELDS'
          : (ageDays > 30 ? 'FOLLOW_UP' : 'NO_ACTION');

  const recLabel = recommendation === 'AT_RISK' ? 'risk bayrağı — yakın takip'
    : recommendation === 'PROPOSAL_NEEDED' ? 'teklif hazırlanması öneriliyor'
    : recommendation === 'UPDATE_FIELDS' ? 'eksik alanların güncellenmesi öneriliyor'
    : recommendation === 'FOLLOW_UP' ? 'takip teması öneriliyor'
    : 'işlem gerekmiyor';

  return {
    rationale: `CRM fırsat triyajı: "${opp.title}" (durum ${opp.status}, %${opp.probability}, ${opp.value.toLocaleString('tr-TR')} ₺, ${proposalCount} teklif). ${issues.length ? issues.join(' ') : 'Belirgin eksik yok.'} → ${recLabel}. (Danışman modu — insan ratifiye eder.)`,
    output: { status: opp.status, probability: opp.probability, value: opp.value, ageDays, proposalCount, issues, recommendation },
    taskTitle: `CRM önerisi: ${opp.title} (${recommendation === 'AT_RISK' ? 'risk' : recommendation === 'PROPOSAL_NEEDED' ? 'teklif' : recommendation === 'UPDATE_FIELDS' ? 'alan güncelle' : recommendation === 'FOLLOW_UP' ? 'takip' : 'işlem yok'})`,
  };
};

const igpdHandler: AgentHandler = async (tenantId, entityId) => {
  const opp = await prisma.opportunity.findFirst({ where: { id: entityId, tenantId } });
  if (!opp) return null;

  const isOpen = !['WON', 'LOST', 'CANCELLED'].includes(opp.status);
  const expectedValue = Math.round((opp.probability / 100) * opp.value);
  const valueTier = opp.value >= 1_000_000 ? 'HIGH' : opp.value >= 250_000 ? 'MEDIUM' : 'LOW';
  const ageDays = Math.floor((Date.now() - new Date(opp.createdAt).getTime()) / DAY_MS);

  const recommendation = !isOpen
    ? 'NO_ACTION'
    : (valueTier === 'HIGH' && opp.probability >= 50)
      ? 'PRIORITIZE'
      : (opp.value >= 250000 && opp.probability < 40)
        ? 'NURTURE'
        : 'REVIEW';

  const recLabel = recommendation === 'PRIORITIZE' ? 'stratejik öncelik — kaynak ayır'
    : recommendation === 'NURTURE' ? 'yüksek değer/düşük olasılık — besleme/pazarlama dokunuşu'
    : recommendation === 'REVIEW' ? 'gözden geçirme'
    : 'işlem gerekmiyor';

  return {
    rationale: `İş Geliştirme değerlendirmesi: "${opp.title}" — değer ${opp.value.toLocaleString('tr-TR')} ₺ (${valueTier} kademe), olasılık %${opp.probability}, beklenen değer ≈ ${expectedValue.toLocaleString('tr-TR')} ₺, yaş ${ageDays} gün. → ${recLabel}. (Danışman modu — insan ratifiye eder.)`,
    output: { value: opp.value, probability: opp.probability, expectedValue, valueTier, ageDays, recommendation },
    taskTitle: `İş Geliştirme önerisi: ${opp.title} (${recommendation === 'PRIORITIZE' ? 'önceliklendir' : recommendation === 'NURTURE' ? 'besle' : recommendation === 'REVIEW' ? 'gözden geçir' : 'işlem yok'})`,
  };
};

const HANDLERS: Record<string, AgentHandler> = {
  AGENT_TENDER: tenderHandler,
  AGENT_PROJECT: projectHandler,
  AGENT_PRESALES: presalesHandler,
  AGENT_PROCUREMENT: procurementHandler,
  AGENT_FINANCE: financeHandler,
  AGENT_LEGAL: legalHandler,
  AGENT_CRM: crmHandler,
  AGENT_IGPD: igpdHandler,
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

  // Otonom eylem — yalnız AUTONOMOUS mod + eklenti AUTONOMOUS'a izinli + geri-alınabilir eylem.
  // ADVISORY modda eylem ASLA çalışmaz: öneri handoff görevinde kalır, insan uygular.
  const allowedAuto = (plugin.allowedModes ?? ['ADVISORY', 'AUTONOMOUS']).includes('AUTONOMOUS');
  let actionTaken: string | null = null;
  if (autoRatify && allowedAuto && result.autonomousAction?.reversible) {
    await result.autonomousAction.execute();
    actionTaken = result.autonomousAction.summary;
    await prisma.agentRun.update({ where: { id: run.id }, data: { actionTaken } });
    run.actionTaken = actionTaken; // dönen nesneyi güncel tut
    // Mutasyonu AGENT_RUN'dan ayrı bir denetim kaydı olarak göster
    await prisma.activityLog.create({
      data: {
        action: 'AGENT_ACTION',
        entityType: plugin.entityType ?? 'AGENT',
        entityId,
        details: JSON.stringify({ pluginKey, kind: result.autonomousAction.kind, summary: actionTaken }),
        userId: actorId,
        actorType: 'AGENT',
        agentRunId: run.id,
        tenantId,
      },
    });
  }

  // Devir görevi (gerçek kişiye) — unit çözümlemesi: ilk birim, yoksa task atla
  const unit = await prisma.unit.findFirst({ where: { tenantId } });
  let handoffTaskId: string | null = null;
  if (unit) {
    const task = await prisma.todoTask.create({
      data: {
        title: actionTaken ? `✅ ${actionTaken} — yapıldı, incele` : result.taskTitle,
        description: actionTaken
          ? `🤖 ${plugin.name} otonom modda uyguladı: ${actionTaken}\n\n${result.rationale}`
          : `🤖 ${plugin.name} tarafından hazırlandı.\n\n${result.rationale}`,
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

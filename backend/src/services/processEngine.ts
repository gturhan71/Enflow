// Enflow — Süreç Motoru (Faz A).
// ─────────────────────────────────────────────────────────────────────────────
// Tenant'ın Ayarlar → İş Akışı Tasarımcısı'nda (processKey bazında) kurguladığı
// WorkflowStep zincirini TEK gerçek kaynak sayan, iş modüllerinin (Fırsat,
// Sözleşme, ileride Satınalma/Tender/Proje) çağıracağı merkezi orkestrasyon
// motoru. Ne yapar: bir varlık (entityType+entityId) için ApprovalChain/Stage
// üretir/ilerletir, her aşamanın alıcılarını (TodoTask + Notification) tenant'ın
// gerçek Unit/User verisinden çözer, AUTO+actionKey adımlarda kayıtlı bir
// eylemi (örn. sözleşmeden proje oluşturma) çalıştırır.
//
// KESİN KURAL: bu dosyada hiçbir hardcoded rol adı (`'FINANCE_MGR'` vb.) ya da
// `unit.name.includes(...)` türü isim eşleştirmesi YOK — her unitId/role,
// tenant'ın WorkflowStep tablosuna kaydettiği veriden gelir. Tenant bir
// processKey için Tasarımcı'da henüz bir akış kurgulamadıysa motor sessizce bir
// hardcoded şablona (APPROVAL_CHAIN_TEMPLATES vb.) düşmez — ProcessNotConfiguredError
// fırlatır.
import { prisma } from '../prismaClient';
import { logActivity } from './activityLog';
import { getApprovalSlaBusinessDays } from './approvalSlaEscalation';
import { computeSlaDueDate } from '../utils/businessDays';
import { resolveGroupAfterDecision, autoSkipOrphanStages, resolveEffectiveApprover } from './approvalChainService';
import { createProjectWithMilestones } from './projectFactory';
import { createInvoiceRecord } from './invoiceService';
import { entityTypeToTab } from '../utils/entityTypeTab';
import type { ApprovalChain, ApprovalStage, User, WorkflowStep } from '@prisma/client';

export class ProcessNotConfiguredError extends Error {
  constructor(public processKey: string) {
    super(`Süreç yapılandırılmamış: ${processKey}. Ayarlar → İş Akışı Tasarımcısı'ndan kurgulayın.`);
    this.name = 'ProcessNotConfiguredError';
  }
}

export interface StepRecipientQuery {
  unitId: string;
  role: string | null;
  delegateUserId?: string | null;
  recipientField?: string | null;
}

/**
 * TEK paylaşımlı alıcı çözümleyici — TodoTask ataması, Notification fanout ve
 * ApprovalStage onaycı eşleşmesi bunu kullanır. Sıra: (0) `recipientField`
 * doluysa işlenen kaydın o alanından (User ID, ör. Opportunity.assignedToId)
 * DOĞRUDAN çöz — beyaz listede yoksa veya alan boş/kullanıcı pasifse aşağıdaki
 * zincire düş. (1) o birimdeki (+varsa role'e sahip) aktif kullanıcılar,
 * (2) birim yöneticisi (rolü de eşleşiyorsa), (3) VEKİL (`delegateUserId` —
 * değişmez kural #2: birim boşsa/açılmadıysa modülün kullanılabilmesi için
 * vekil ataması zorunludur, sessiz atlama YOK). Hiçbiri yoksa boş dizi döner
 * (çağıran "orphan" olarak ele alır).
 */
export async function resolveStepRecipients(
  tenantId: string,
  step: StepRecipientQuery,
  entity?: { entityType: string; entityId: string }
): Promise<User[]> {
  if (step.recipientField && entity && ENTITY_RECIPIENT_FIELDS[entity.entityType]?.some((f) => f.key === step.recipientField)) {
    const record = await fetchEntityRecord(tenantId, entity.entityType, entity.entityId);
    const userId = record?.[step.recipientField] as string | null | undefined;
    if (userId) {
      const direct = await prisma.user.findFirst({ where: { id: userId, tenantId, status: 'ACTIVE' } });
      if (direct) return [direct];
    }
  }

  const where: { tenantId: string; unitId: string; status: string; role?: string } = {
    tenantId,
    unitId: step.unitId,
    status: 'ACTIVE',
  };
  if (step.role) where.role = step.role;

  let users = await prisma.user.findMany({ where });
  if (users.length === 0 && step.role) {
    const unit = await prisma.unit.findFirst({ where: { id: step.unitId, tenantId } });
    if (unit?.managerId) {
      const manager = await prisma.user.findFirst({
        where: { id: unit.managerId, tenantId, status: 'ACTIVE', role: step.role },
      });
      if (manager) users = [manager];
    }
  }
  if (users.length === 0 && step.delegateUserId) {
    const delegate = await prisma.user.findFirst({ where: { id: step.delegateUserId, tenantId, status: 'ACTIVE' } });
    if (delegate) users = [delegate];
  }
  return users;
}

/**
 * Tek-aktörlü, çok-aşamalı olmayan eylemler için hafif yetkilendirme kontrolü
 * (ör. fatura kaydı) — tam bir `ApprovalChain`/TodoTask seremonisi başlatmadan,
 * tenant'ın o süreç için kurguladığı (tek/ilk) adımın rol+birimine göre çağıranın
 * yetkili olup olmadığını döner. Tenant süreci kurgulamadıysa `ProcessNotConfiguredError`.
 */
export async function isAuthorizedForStep(tenantId: string, processKey: string, userId: string | undefined): Promise<boolean> {
  const workflow = await prisma.workflow.findFirst({
    where: { tenantId, processKey, isActive: true },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (!workflow || workflow.steps.length === 0) {
    throw new ProcessNotConfiguredError(processKey);
  }
  if (!userId) return false;
  const minOrder = Math.min(...workflow.steps.map(s => s.order));
  const firstGroup = workflow.steps.filter(s => s.order === minOrder);
  for (const step of firstGroup) {
    if (await resolveEffectiveApprover(tenantId, { role: step.role, unitId: step.unitId, delegateUserId: step.delegateUserId }, userId)) return true;
  }
  return false;
}

// ── Aşama eylem kayıt defteri ───────────────────────────────────────────────
// type=AUTO + actionKey adımlarda, insan onayı beklemeden çalıştırılan işlem.
// Faz A'da yalnız CREATE_PROJECT_FROM_ENTITY gerçek; diğerleri (T3/T5/T6'nın
// motora bağlanacağı sonraki fazlar için) sözlükte yer tutucu — Tasarımcı UI'da
// seçilebilir ama çağrılırsa açık bir hata verir (sessiz no-op YOK).
export interface StageActionCtx {
  tenantId: string;
  entityType: string;
  entityId: string;
  step: WorkflowStep;
  actorUserId?: string;
  // Çağıranın orijinal istek gövdesi (ör. proje formundaki type/pmId/milestoneTemplate
  // gibi ek alanlar) — action bunu kullanıp kullanmamakta serbest, entityId'den
  // türeyen alanlar (opportunityId vb.) action içinde her zaman üzerine yazılır.
  input?: Record<string, unknown>;
}

// ── Jenerik varlık alan kaydı (tenant-özel süreçler için) ───────────────────
// COPY_FIELDS_TO_TASK ve generic tetikleme ucu bunu kullanır. Yalnız burada
// KAYITLI alanlar okunabilir/kopyalanabilir — client'tan gelen keyfi bir alan
// adı asla doğrudan DB kaydına erişemez (beyaz liste).
export interface FieldSpec { key: string; label: string }
export const ENTITY_FIELD_SPECS: Record<string, FieldSpec[]> = {
  OPPORTUNITY: [
    { key: 'title', label: 'Başlık' },
    { key: 'value', label: 'Değer' },
    { key: 'probability', label: 'Olasılık (%)' },
    { key: 'status', label: 'Durum' },
    { key: 'expectedCloseDate', label: 'Beklenen Kapanış' },
  ],
  CONTRACT_WORKFLOW_SIGNING: [
    { key: 'title', label: 'Başlık' },
    { key: 'contractValue', label: 'Sözleşme Bedeli' },
    { key: 'tenderNo', label: 'İKN' },
    { key: 'projectName', label: 'Proje Adı' },
    { key: 'deadline', label: 'Son Tarih' },
  ],
  PROJECT: [
    { key: 'name', label: 'Proje Adı' },
    { key: 'code', label: 'Proje Kodu' },
    { key: 'totalValue', label: 'Toplam Değer' },
    { key: 'budgetTotal', label: 'Bütçe' },
    { key: 'status', label: 'Durum' },
  ],
  PURCHASE_REQUEST: [
    { key: 'title', label: 'Başlık' },
    { key: 'budgetAmount', label: 'Bütçe Tutarı' },
    { key: 'currency', label: 'Para Birimi' },
    { key: 'status', label: 'Durum' },
    { key: 'poNumber', label: 'PO Numarası' },
  ],
  TENDER: [
    { key: 'name', label: 'İhale Adı' },
    { key: 'ikn', label: 'İKN' },
    { key: 'estimatedValue', label: 'Tahmini Bedel' },
    { key: 'currency', label: 'Para Birimi' },
    { key: 'submissionDeadline', label: 'Son Teklif Tarihi' },
  ],
};
export const ENTITY_TYPES = Object.keys(ENTITY_FIELD_SPECS);

// ── Alıcı-alanı beyaz listesi (entity-alan-bazlı dinamik hedefleme) ─────────
// `WorkflowStep.recipientField` yalnız burada kayıtlı (entityType,field)
// çiftlerini kabul eder — client'tan keyfi bir alan adı asla doğrudan bir
// kullanıcıya çözülmez. Yalnız gerçekten bir User ID taşıyan alanlar listelenir.
export const ENTITY_RECIPIENT_FIELDS: Record<string, FieldSpec[]> = {
  OPPORTUNITY: [
    { key: 'assignedToId', label: 'Fırsat Sahibi (Satış Temsilcisi)' },
    { key: 'presalesId', label: 'Atanan Presales Mühendisi' },
    { key: 'createdById', label: 'Oluşturan Kullanıcı' },
  ],
};

async function fetchEntityRecord(tenantId: string, entityType: string, entityId: string): Promise<Record<string, unknown> | null> {
  switch (entityType) {
    case 'OPPORTUNITY':
      return (await prisma.opportunity.findFirst({ where: { id: entityId, tenantId } })) as unknown as Record<string, unknown> | null;
    case 'CONTRACT_WORKFLOW_SIGNING':
      return (await prisma.contractWorkflow.findFirst({ where: { id: entityId, tenantId } })) as unknown as Record<string, unknown> | null;
    case 'PROJECT':
      return (await prisma.project.findFirst({ where: { id: entityId, tenantId } })) as unknown as Record<string, unknown> | null;
    case 'PURCHASE_REQUEST':
      return (await prisma.purchaseRequest.findFirst({ where: { id: entityId, tenantId } })) as unknown as Record<string, unknown> | null;
    case 'TENDER':
      return (await prisma.tender.findFirst({ where: { id: entityId, tenantId } })) as unknown as Record<string, unknown> | null;
    default:
      return null;
  }
}

export async function entityExists(tenantId: string, entityType: string, entityId: string): Promise<boolean> {
  return !!(await fetchEntityRecord(tenantId, entityType, entityId));
}

export async function readEntityFields(tenantId: string, entityType: string, entityId: string, fields: string[]): Promise<{ label: string; value: unknown }[]> {
  const specs = ENTITY_FIELD_SPECS[entityType] || [];
  const allowed = new Set(specs.map((s) => s.key));
  const record = await fetchEntityRecord(tenantId, entityType, entityId);
  if (!record) return [];
  return fields
    .filter((f) => allowed.has(f))
    .map((f) => ({ label: specs.find((s) => s.key === f)?.label || f, value: record[f] }));
}

/**
 * Genel kural — motorun ürettiği HER birimden-birime devirde, işi alan kişiye
 * ek olarak onun biriminin yöneticisine de bir HATIRLATMA bildirimi gider
 * (TodoTask değil, yalnız görünürlük — yöneticiden aksiyon beklenmez). Alıcı
 * zaten yönetici ise (`unit.managerId === user.id`) tekrar bildirim atılmaz.
 */
async function notifyUnitManager(
  tenantId: string,
  user: User,
  workflowName: string,
  entityType: string,
  entityId: string,
  contextLabel: string,
): Promise<void> {
  if (!user.unitId) return;
  const unit = await prisma.unit.findFirst({ where: { id: user.unitId, tenantId }, select: { managerId: true } });
  if (!unit?.managerId || unit.managerId === user.id) return;

  // Kaydın görünen adı (Fırsat başlığı, Proje adı vb.) — ENTITY_FIELD_SPECS'teki
  // ilk alan her entity türü için "başlık/ad" alanıdır (title/name).
  const nameField = ENTITY_FIELD_SPECS[entityType]?.[0]?.key;
  const record = nameField ? await fetchEntityRecord(tenantId, entityType, entityId) : null;
  const entityName = nameField && record ? (record[nameField] as string | undefined) : undefined;
  const subject = entityName ? `"${entityName}"` : `"${workflowName}"`;

  await prisma.notification.create({
    data: {
      tenantId,
      userId: unit.managerId,
      type: 'INFO',
      title: 'Ekibinize iş devredildi',
      message: `${subject} için "${workflowName}" sürecinde ${user.name} adlı ekip üyenize bir görev atandı${contextLabel ? ` (${contextLabel})` : ''}.`,
      // Notification.relatedModule doğrudan activeTab olarak kullanılıyor
      // (Header.tsx) — entityType'ı gerçek sekme id'sine çevirmeden yazma.
      ...(entityTypeToTab(entityType) ? { relatedModule: entityTypeToTab(entityType), relatedItemId: entityId } : {}),
    },
  }).catch(() => undefined);
}

/**
 * Jenerik "veri aktarımı" AUTO eylemi — tenant, süreci kurgularken hangi
 * alanların kopyalanacağını seçer (adımın `actionConfig` JSON'unda
 * `{fields:[...]}`), kod yazmaya gerek kalmaz. Yalnız basit alan-kopyalama
 * içindir — hesaplı/dönüşümlü aktarımlar (ör. oranlı BoM dağıtımı) hâlâ özel
 * bir STAGE_ACTIONS fonksiyonu gerektirir (bkz. createPurchaseRequestFromContract).
 */
async function copyFieldsToTask(ctx: StageActionCtx): Promise<void> {
  let fields: string[] = [];
  try {
    const cfg = ctx.step.actionConfig ? (JSON.parse(ctx.step.actionConfig) as { fields?: string[] }) : null;
    fields = Array.isArray(cfg?.fields) ? cfg.fields : [];
  } catch {
    fields = [];
  }
  if (fields.length === 0) return;

  const picked = await readEntityFields(ctx.tenantId, ctx.entityType, ctx.entityId, fields);
  if (picked.length === 0) return;

  const recipients = await resolveStepRecipients(
    ctx.tenantId,
    { unitId: ctx.step.unitId, role: ctx.step.role, delegateUserId: ctx.step.delegateUserId, recipientField: ctx.step.recipientField },
    { entityType: ctx.entityType, entityId: ctx.entityId },
  );
  if (recipients.length === 0) return;

  const lines = picked.map((p) => `${p.label}: ${p.value ?? '—'}`).join('\n');

  await prisma.todoTask.create({
    data: {
      tenantId: ctx.tenantId,
      title: `Veri aktarımı: ${ctx.step.description || ctx.entityType}`,
      description: lines,
      unitId: ctx.step.unitId,
      assignedToUserId: recipients[0].id,
      assignedBy: ctx.actorUserId || 'system',
      // 'GENERAL' hardcode'u "Git" butonunu her zaman kırıyordu (MODULE_TARGET'ta
      // karşılığı yok) — gerçek entityType (OPPORTUNITY/PROJECT/vb.) kaydın ait
      // olduğu sekmeye doğru yönlendirir.
      relatedModule: ctx.entityType,
      relatedItemId: ctx.entityId,
      priority: 'MEDIUM',
      status: 'PENDING',
      updatedAt: new Date(),
    },
  }).catch(() => {});

  await Promise.all(recipients.map((u) => prisma.notification.create({
    data: { tenantId: ctx.tenantId, userId: u.id, type: 'INFO', title: 'Veri aktarımı', message: lines.slice(0, 300) },
  }).catch(() => {})));

  await Promise.all(recipients.map((u) => notifyUnitManager(ctx.tenantId, u, ctx.step.description || ctx.entityType, ctx.entityType, ctx.entityId, ctx.step.description || '')));
}

async function createProjectFromEntity(ctx: StageActionCtx): Promise<void> {
  // Faz B — CONTRACT_WORKFLOW_SIGNING (Faz A) + OPPORTUNITY (Faz B, T1) burada
  // dallanır; ikisi de aynı createProjectWithMilestones'ı çağırır.
  if (ctx.entityType === 'CONTRACT_WORKFLOW_SIGNING') {
    const wf = await prisma.contractWorkflow.findFirst({ where: { id: ctx.entityId, tenantId: ctx.tenantId } });
    if (!wf) throw new Error('Sözleşme kaydı bulunamadı.');
    if (wf.projectId) return; // idempotent — zaten aktarılmış

    const project = await createProjectWithMilestones(
      ctx.tenantId,
      {
        name: wf.projectName || wf.title,
        opportunityId: wf.opportunityId || undefined,
        contractId: wf.contractId || undefined,
        totalValue: wf.contractValue,
        budgetTotal: wf.contractValue,
        deadline: wf.deadline || undefined,
        type: 'HARDWARE',
      },
      ctx.actorUserId,
    );
    await prisma.contractWorkflow.update({
      where: { id: wf.id },
      data: { status: 'TRANSFERRED', projectId: project?.id ?? null, updatedAt: new Date() },
    });
    return;
  }

  if (ctx.entityType === 'OPPORTUNITY') {
    const opp = await prisma.opportunity.findFirst({ where: { id: ctx.entityId, tenantId: ctx.tenantId } });
    if (!opp) throw new Error('Fırsat bulunamadı.');
    if (opp.status !== 'WON') throw new Error('Yalnız kazanılmış (WON) bir fırsattan proje oluşturulabilir.');

    const existing = await prisma.project.findFirst({ where: { tenantId: ctx.tenantId, opportunityId: opp.id } });
    if (existing) return; // idempotent — zaten oluşturulmuş

    // Formdan gelen ek alanlar (type/pmId/milestoneTemplate vb.) korunur —
    // yalnız opportunityId her zaman entity'den gelen gerçek değere sabitlenir.
    await createProjectWithMilestones(ctx.tenantId, { ...(ctx.input || {}), opportunityId: opp.id }, ctx.actorUserId);
    return;
  }

  throw new Error(`CREATE_PROJECT_FROM_ENTITY bu entityType için henüz desteklenmiyor: ${ctx.entityType}`);
}

async function createContractFromTender(ctx: StageActionCtx): Promise<void> {
  if (ctx.entityType !== 'TENDER') {
    throw new Error(`CREATE_CONTRACT_FROM_TENDER bu entityType için henüz desteklenmiyor: ${ctx.entityType}`);
  }
  const tender = await prisma.tender.findFirst({ where: { id: ctx.entityId, tenantId: ctx.tenantId } });
  if (!tender) throw new Error('İhale kaydı bulunamadı.');
  if (tender.contractWorkflowId) return; // idempotent — zaten bağlı

  const wf = await prisma.contractWorkflow.create({
    data: {
      title: tender.ikn ? `${tender.name} — İKN: ${tender.ikn}` : tender.name,
      tenderName: tender.name,
      tenderNo: tender.ikn || null,
      contractValue: tender.estimatedValue || 0,
      opportunityId: tender.opportunityId || null,
      status: 'DRAFT',
      tenantId: ctx.tenantId,
    },
  });
  await prisma.tender.update({ where: { id: tender.id }, data: { contractWorkflowId: wf.id } });
  await logActivity({ tenantId: ctx.tenantId, userId: ctx.actorUserId, action: 'CONTRACT_WORKFLOW_CREATED', entityType: 'TENDER', entityId: tender.id, details: { contractWorkflowId: wf.id } });
}

/**
 * PO kesildiğinde (Satınalma) proje maliyet kalemi(leri) oluşturur/günceller —
 * BoM'a bağlı satırlar orantılı dağıtılır, BoM dışı talepler tek kalem, BoM
 * kaynaklı (projesiz) talepler legacy CostItem'a yazılır. `purchaseRequests.ts`
 * `/:id/approve`'un PO_ISSUED dalından `advanceProcess(..., 'PURCHASE_TO_COST_ITEM', ...)`
 * üzerinden çağrılır — PURCHASE_APPROVAL'dan bilerek AYRI, bağımsız kurgulanabilir
 * bir süreçtir; tenant kurgulamadıysa maliyet kalemi bu talep için oluşmaz (PO_ISSUED
 * geçişinin kendisi geri alınmaz, zaten ayrı bir onay zincirine — PURCHASE_APPROVAL —
 * bağlıdır). `STAGE_ACTIONS.CREATE_PURCHASE_COST_ITEM` olarak da kayıtlı (AUTO adım
 * seçilebilir eylem listesinde).
 */
export async function createPurchaseCostItemsForRequest(tenantId: string, purchaseRequestId: string, userId?: string): Promise<void> {
  const pr = await prisma.purchaseRequest.findFirst({ where: { id: purchaseRequestId, tenantId } });
  if (!pr) throw new Error('Satınalma talebi bulunamadı.');
  const updated = await prisma.purchaseRequest.findFirst({
    where: { id: purchaseRequestId, tenantId },
    include: { items: true },
  });
  if (!updated) return;

  const selected = await prisma.purchaseQuote.findFirst({ where: { purchaseRequestId: pr.id, isSelected: true } });
  const amount = selected?.totalAmountTRY ?? pr.budgetAmountTRY ?? 0;
  const itemsWithBomKey = updated.items.filter(i => i.lineKey);

  if (pr.projectId && itemsWithBomKey.length > 0 && amount > 0) {
    const weight = (it: (typeof updated.items)[number]) => (it.estimatedUnitPrice ?? 0) * it.quantity;
    const totalWeight = updated.items.reduce((s, it) => s + weight(it), 0);
    const otherItems = updated.items.filter(i => !i.lineKey);

    const upsertLineCost = async (bomLineKey: string | null, description: string, itemAmount: number) => {
      const data = {
        category: 'PROCUREMENT', description, actualAmount: itemAmount, amountTRY: itemAmount,
        currency: pr.currency, purchaseRequestId: pr.id, bomLineKey,
      };
      const existing = await prisma.projectCostItem.findFirst({
        where: { projectId: pr.projectId!, purchaseRequestId: pr.id, bomLineKey },
      });
      if (existing) await prisma.projectCostItem.update({ where: { id: existing.id }, data }).catch(() => {});
      else await prisma.projectCostItem.create({ data: { projectId: pr.projectId!, createdById: userId, ...data } }).catch(() => {});
    };

    for (const it of itemsWithBomKey) {
      const share = totalWeight > 0 ? weight(it) / totalWeight : 1 / updated.items.length;
      await upsertLineCost(it.lineKey as string, `PO: ${it.name} (${pr.poNumber ?? ''})`, amount * share);
    }
    if (otherItems.length > 0) {
      const otherWeight = otherItems.reduce((s, it) => s + weight(it), 0);
      const share = totalWeight > 0 ? otherWeight / totalWeight : otherItems.length / updated.items.length;
      await upsertLineCost(null, `PO: ${pr.title} — diğer kalemler (${pr.poNumber ?? ''})`, amount * share);
    }
  } else if (pr.projectId) {
    const data = {
      category: 'PROCUREMENT',
      description: `PO: ${pr.title} (${pr.poNumber ?? ''})`,
      actualAmount: amount,
      amountTRY: amount,
      currency: pr.currency,
      purchaseRequestId: pr.id,
    };
    const existing = await prisma.projectCostItem.findFirst({ where: { projectId: pr.projectId, purchaseRequestId: pr.id } });
    if (existing) await prisma.projectCostItem.update({ where: { id: existing.id }, data }).catch(() => {});
    else await prisma.projectCostItem.create({ data: { projectId: pr.projectId, createdById: userId, ...data } }).catch(() => {});
  } else if (pr.sourceBomId) {
    await prisma.costItem.create({
      data: {
        tenantId,
        description: `PO: ${pr.title} (${pr.poNumber ?? ''})`,
        category: 'OTHER',
        amount,
        currency: pr.currency,
        opportunityId: pr.sourceBomId,
      },
    }).catch(() => {});
  }
}

/**
 * İmzalı sözleşmeden BoM + referans alış fiyatlarıyla Satınalma Talebi (PR)
 * oluşturur. Eskiden `contractWorkflow.ts` `/:id/handoff-procurement`'te
 * doğrudan, `prisma.user.findFirst({role:'PROCUREMENT_MGR'})` ile hardcoded
 * çağrılıyordu (Designer'da hiç görünmeyen, tenant'ın kurgulayamadığı bir
 * "olmayan süreç"ti — Faz D). Artık CONTRACT_TO_PROCUREMENT processKey'i
 * üzerinden, alıcı `resolveStepRecipients` ile (tenant'ın kurguladığı
 * birim/rol/vekil) çözülür.
 */
async function createPurchaseRequestFromContract(ctx: StageActionCtx): Promise<void> {
  if (ctx.entityType !== 'CONTRACT_WORKFLOW_SIGNING') {
    throw new Error(`CREATE_PURCHASE_REQUEST_FROM_CONTRACT bu entityType için henüz desteklenmiyor: ${ctx.entityType}`);
  }
  const wf = await prisma.contractWorkflow.findFirst({ where: { id: ctx.entityId, tenantId: ctx.tenantId } });
  if (!wf) throw new Error('Sözleşme kaydı bulunamadı.');
  if (wf.procurementRequestId) return; // idempotent — zaten aktarılmış

  const opp = wf.opportunityId
    ? await prisma.opportunity.findFirst({ where: { id: wf.opportunityId, tenantId: ctx.tenantId }, include: { bomItems: true, customer: true } })
    : null;
  const bomItems = opp?.bomItems ?? [];
  const currency = bomItems[0]?.currency || 'TRY';

  const recipients = await resolveStepRecipients(
    ctx.tenantId,
    { unitId: ctx.step.unitId, role: ctx.step.role, delegateUserId: ctx.step.delegateUserId, recipientField: ctx.step.recipientField },
    { entityType: ctx.entityType, entityId: ctx.entityId },
  );
  const procUser = recipients[0];

  const descLines = [
    `Sözleşme: ${wf.title}`,
    wf.tenderNo ? `İKN: ${wf.tenderNo}` : '',
    opp?.customer?.name ? `Müşteri: ${opp.customer.name}` : '',
    `Sözleşme bedeli: ${wf.contractValue ?? 0} ${currency}`,
    'Kaynak: imzalı sözleşme — BoM referans alış fiyatları üretici/distribütör ile yapılmıştır.',
  ].filter(Boolean).join('\n');

  const pr = await prisma.purchaseRequest.create({
    data: {
      tenantId: ctx.tenantId,
      title: `[Sözleşme] ${wf.projectName || wf.title}`,
      description: descLines,
      sourceType: 'BOM',
      sourceBomId: wf.opportunityId || null,
      projectId: wf.projectId || null,
      requestedBy: ctx.actorUserId || 'system',
      requestedByName: null,
      unitId: procUser?.unitId || ctx.step.unitId,
      unitName: null,
      status: 'DRAFT',
      urgency: 'NORMAL',
      budgetAmount: wf.contractValue || null,
      currency,
      items: bomItems.length ? {
        create: bomItems.map(b => ({
          name: b.partNumber || b.description || 'Kalem',
          description: b.description || null,
          quantity: b.quantity || 0,
          unit: 'adet',
          estimatedUnitPrice: b.purchaseCost ?? null,
          currency: b.currency || currency,
          refVendor: b.vendor || null,
          refSource: b.source || null,
          lineKey: b.lineKey || null,
          brandId: b.brandId || null,
        })),
      } : undefined,
    },
    include: { items: true },
  });

  await prisma.contractWorkflow.update({ where: { id: wf.id }, data: { procurementRequestId: pr.id, updatedAt: new Date() } });

  if (procUser?.id) {
    await prisma.notification.create({
      data: {
        tenantId: ctx.tenantId, userId: procUser.id, type: 'INFO',
        title: 'Sözleşme → Satınalma',
        message: `"${wf.projectName || wf.title}" sözleşmesi imzalandı. ${bomItems.length} kalemlik BoM ve referans alış fiyatları Satınalma Talebi olarak iletildi.`,
      },
    }).catch(() => {});
  }
  if (procUser?.unitId) {
    await prisma.todoTask.create({
      data: {
        tenantId: ctx.tenantId, title: `Satınalma: ${wf.projectName || wf.title}`,
        description: `İmzalı sözleşmeden ${bomItems.length} kalemlik satınalma talebi oluştu. Referans alış fiyatlarını (üretici/distribütör) inceleyip teklif toplayın.`,
        unitId: procUser.unitId, assignedBy: ctx.actorUserId || 'system',
        relatedModule: 'PROCUREMENT', relatedItemId: pr.id, priority: 'HIGH', status: 'PENDING', updatedAt: new Date(),
      },
    }).catch(() => {});
    await notifyUnitManager(ctx.tenantId, procUser, `Sözleşme → Satınalma: ${wf.projectName || wf.title}`, 'PROCUREMENT', pr.id, '');
  }

  await logActivity({ tenantId: ctx.tenantId, userId: ctx.actorUserId, action: 'CONTRACT_TO_PROCUREMENT', entityType: 'CONTRACT_WORKFLOW', entityId: wf.id, details: { purchaseRequestId: pr.id, items: pr.items.length } });
}

/**
 * İhale teklifini gerçekten teslim eder (status→SUBMITTED). Eskiden
 * `tenders.ts` `/:id/submit`'te hiçbir onay/rol kontrolü olmadan doğrudan
 * çalışıyordu — şirketi bağlayan bu geri-dönüşsüz adım TENDER_SUBMIT_APPROVAL
 * üzerinden geçer artık (Faz G).
 */
async function submitTender(ctx: StageActionCtx): Promise<void> {
  if (ctx.entityType !== 'TENDER') {
    throw new Error(`SUBMIT_TENDER bu entityType için henüz desteklenmiyor: ${ctx.entityType}`);
  }
  const tender = await prisma.tender.findFirst({ where: { id: ctx.entityId, tenantId: ctx.tenantId } });
  if (!tender) throw new Error('İhale kaydı bulunamadı.');
  if (['SUBMITTED', 'EVALUATING', 'WON', 'LOST'].includes(tender.status)) return; // idempotent
  await prisma.tender.update({ where: { id: tender.id }, data: { status: 'SUBMITTED', submittedAt: new Date() } });
  await logActivity({ tenantId: ctx.tenantId, userId: ctx.actorUserId, action: 'TENDER_SUBMITTED', entityType: 'TENDER', entityId: tender.id, details: {} });
}

/**
 * Projeyi kapatan SATIŞ faturasını oluşturur (`invoiceService.createInvoiceRecord`
 * — `finance.ts`'in gate'siz yoluyla AYNI mantık, kopyalanmadı). Eskiden
 * `POST /finance/invoices` projeye bağlı SATIŞ faturaları dahil hiçbir rol/onay
 * kontrolü olmadan çalışıyordu — PROJECT_TO_INVOICE üzerinden geçer artık (Faz G).
 */
async function createSalesInvoiceForProject(ctx: StageActionCtx): Promise<void> {
  if (ctx.entityType !== 'PROJECT') {
    throw new Error(`CREATE_SALES_INVOICE_FOR_PROJECT bu entityType için henüz desteklenmiyor: ${ctx.entityType}`);
  }
  // B-10 düzeltmesi: bu adım eskiden tutar/müşteri bilgisini YALNIZ zinciri tamamlatan
  // HTTP isteğinin gövdesinden (ctx.input) okuyordu. Zincir birden fazla MANUAL onay
  // aşaması içerdiğinde (normal durum), aradaki/son onaylar `continueProcess` üzerinden
  // BOŞ gövdeyle geçer (walkForward — bkz. finalizePurchaseInvoice'daki aynı sorunun
  // PURCHASE_TO_INVOICE tarafındaki çözümü) — bu da her asenkron onayda "Fatura tutarı
  // zorunlu." hatasıyla sessizce (approvalChains.ts .catch) başarısız oluyordu. Artık
  // ctx.input boşsa (ya da amount taşımıyorsa) tutar/müşteri, halihazırda projede
  // güvenle mevcut olan alanlardan (totalValue = sözleşme bedeli, customerId/Name)
  // türetilir — proje kapanış faturasının doğal beklenen değeri zaten budur.
  const input = (ctx.input || {}) as Record<string, unknown>;
  const hasAmount = input.amount !== undefined && input.amount !== null && input.amount !== '';
  let amount = input.amount as number | string | undefined;
  let currency = input.currency as string | undefined;
  let customerId = input.customerId as string | undefined;
  let customerName = input.customerName as string | undefined;
  if (!hasAmount || !customerId) {
    const project = await prisma.project.findFirst({
      where: { id: ctx.entityId, tenantId: ctx.tenantId },
      select: { totalValue: true, contractCurrency: true, customerId: true, customerName: true },
    });
    if (!project) throw new Error('Proje bulunamadı.');
    if (!hasAmount) { amount = project.totalValue; currency = currency || project.contractCurrency; }
    if (!customerId) { customerId = project.customerId || undefined; customerName = customerName || project.customerName || undefined; }
  }
  // input.status boşsa (asenkron onaydan sonraki normal durum) createInvoiceRecord'un
  // kendi 'DRAFT' varsayılanına düşülmez: DRAFT bir fatura invoiceEngine.recalcInvoice
  // tarafından KASITLI OLARAK dondurulur (tam ödense bile asla PAID'e ilerlemez) — bu
  // yüzden tahsilat kalıcı olarak DRAFT bir faturaya karşı boşa düşerdi. Manuel "Yeni
  // Fatura" formunun kendi varsayılanı ISSUED'dır; otomatik yol da aynı varsayılanı kullanır.
  const status = (input.status as string | undefined) || 'ISSUED';
  await createInvoiceRecord(ctx.tenantId, {
    type: 'SALES',
    invoiceNo: input.invoiceNo as string | undefined,
    amount: amount as number | string,
    currency,
    issueDate: input.issueDate as string | undefined,
    dueDate: input.dueDate as string | undefined,
    status,
    projectId: ctx.entityId,
    contractId: input.contractId as string | undefined,
    milestoneId: input.milestoneId as string | undefined,
    customerId,
    customerName,
    notes: input.notes as string | undefined,
    categoryCode: input.categoryCode as string | undefined,
    issueRateToTRY: input.issueRateToTRY as number | string | undefined,
  }, ctx.actorUserId);
}

/**
 * Satınalma faturasını sonlandırır: PR.status'u INVOICED/CLOSED'a ilerletir +
 * Finans Invoice (type=PURCHASE) kaydını idempotent upsert eder. Fatura
 * alanları (invoiceNo/Amount/Date/PaidAt) `purchaseRequests.ts` `/:id/invoice`
 * tarafından bu fonksiyon çağrılmadan ÖNCE entity'ye yazılmış olmalı — AUTO
 * adım, tenant'ın PURCHASE_TO_INVOICE'a kaç MANUAL onay aşaması koyduğundan
 * bağımsız çalışabilsin diye (aradaki onaylar `continueProcess` üzerinden,
 * orijinal istek gövdesi olmadan geçer — bkz. walkForward) veriyi `opts.input`
 * yerine doğrudan PurchaseRequest kaydından okur.
 */
export async function finalizePurchaseInvoice(tenantId: string, purchaseRequestId: string, actorUserId?: string): Promise<void> {
  const pr = await prisma.purchaseRequest.findFirst({
    where: { id: purchaseRequestId, tenantId },
    include: { quotes: true },
  });
  if (!pr) throw new Error('Satınalma talebi bulunamadı.');
  if (pr.status === 'INVOICED' || pr.status === 'CLOSED') return; // idempotent — zaten sonlandırılmış

  const paid = !!pr.invoicePaidAt;
  const nextStatus = paid ? 'CLOSED' : 'INVOICED';
  await prisma.purchaseRequest.update({ where: { id: pr.id }, data: { status: nextStatus } });

  if (pr.invoiceAmount || pr.invoiceNo) {
    const selectedQuote = pr.quotes.find(q => q.isSelected);
    const amount = pr.invoiceAmount ? Number(pr.invoiceAmount) : 0;
    const invData = {
      type: 'PURCHASE',
      invoiceNo: pr.invoiceNo || null,
      amount,
      issueDate: pr.invoiceDate,
      projectId: pr.projectId || null,
      vendorName: selectedQuote?.vendorName || null,
      status: paid ? 'PAID' : 'ISSUED',
      paidAmount: paid ? amount : 0,
      paidAt: pr.invoicePaidAt,
      notes: `Satınalma talebinden: ${pr.title}`,
    };
    const existingInv = await prisma.invoice.findFirst({ where: { purchaseRequestId: pr.id, tenantId } });
    if (existingInv) {
      await prisma.invoice.update({ where: { id: existingInv.id }, data: invData });
    } else {
      await prisma.invoice.create({ data: { tenantId, purchaseRequestId: pr.id, ...invData } });
    }
  }

  await logActivity({ tenantId, userId: actorUserId, action: `STATUS_${nextStatus}`, entityType: 'PURCHASE_REQUEST', entityId: pr.id, details: { invoiceNo: pr.invoiceNo, invoiceAmount: pr.invoiceAmount } });
}

async function createInvoiceFromPurchase(ctx: StageActionCtx): Promise<void> {
  if (ctx.entityType !== 'PURCHASE_REQUEST') {
    throw new Error(`CREATE_INVOICE_FROM_PURCHASE bu entityType için henüz desteklenmiyor: ${ctx.entityType}`);
  }
  await finalizePurchaseInvoice(ctx.tenantId, ctx.entityId, ctx.actorUserId);
}

export const STAGE_ACTIONS: Record<string, (ctx: StageActionCtx) => Promise<void>> = {
  CREATE_PROJECT_FROM_ENTITY: createProjectFromEntity,
  CREATE_CONTRACT_FROM_TENDER: createContractFromTender,
  CREATE_PURCHASE_COST_ITEM: (ctx) => createPurchaseCostItemsForRequest(ctx.tenantId, ctx.entityId, ctx.actorUserId),
  CREATE_PURCHASE_REQUEST_FROM_CONTRACT: createPurchaseRequestFromContract,
  COPY_FIELDS_TO_TASK: copyFieldsToTask,
  SUBMIT_TENDER: submitTender,
  CREATE_SALES_INVOICE_FOR_PROJECT: createSalesInvoiceForProject,
  CREATE_INVOICE_FROM_PURCHASE: createInvoiceFromPurchase,
};

// ── advanceProcess ──────────────────────────────────────────────────────────

export interface AdvanceProcessOpts {
  actorUserId?: string;
  stageId?: string;
  decision?: 'APPROVE' | 'REJECT';
  note?: string;
  // Çağıranın orijinal istek gövdesi — AUTO+actionKey adımlara StageActionCtx.input
  // olarak iletilir (ör. proje oluşturma formunun type/pmId gibi ek alanları).
  input?: Record<string, unknown>;
}

export interface AdvanceProcessResult {
  chain: ApprovalChain & { stages: ApprovalStage[] };
  advancedToOrder: number | null;
  actionsInvoked: string[];
}

function findStepForStage(steps: WorkflowStep[], stage: ApprovalStage): WorkflowStep | undefined {
  return steps.find(
    s => s.order === stage.order && s.unitId === stage.unitId && (s.role ?? null) === (stage.role ?? null),
  );
}

async function instantiateChain(
  tenantId: string,
  processKey: string,
  steps: WorkflowStep[],
  entityType: string,
  entityId: string,
): Promise<ApprovalChain & { stages: ApprovalStage[] }> {
  const slaDays = await getApprovalSlaBusinessDays(tenantId);
  const dueDate = computeSlaDueDate(slaDays) ?? undefined;
  const minOrder = steps.length ? Math.min(...steps.map(s => s.order)) : 0;

  return prisma.approvalChain.create({
    data: {
      tenantId,
      entityType,
      entityId,
      // processKey işaretlenir ki generic /approval-chains/:id/stages/:sid/approve
      // rotası (PendingChainApprovals.tsx) her bireysel onaydan sonra continueProcess
      // ile "sıradaki aşamanın alıcılarına bildir" adımını tetikleyebilsin — motor
      // dışı (legacy/DMO) zincirlerde bu alan null kalır, dokunulmaz.
      processKey,
      stages: {
        create: steps.map(s => ({
          role: s.role,
          unitId: s.unitId,
          delegateUserId: s.delegateUserId,
          mode: s.approvalMode,
          order: s.order,
          dueDate: s.order === minOrder ? dueDate : undefined,
        })),
      },
    },
    include: { stages: { orderBy: { order: 'asc' } } },
  });
}

/**
 * Süreç motorunun TEK giriş noktası. İş modülleri (opportunities.ts,
 * contractWorkflow.ts, ileride tenders.ts/purchaseRequests.ts) bu fonksiyonu
 * çağırır; kendi `findFirst({role})`/birim-adı-eşleştirme mantıklarını
 * yeniden yazmaz.
 */
export async function advanceProcess(
  tenantId: string,
  processKey: string,
  entityType: string,
  entityId: string,
  opts: AdvanceProcessOpts = {},
): Promise<AdvanceProcessResult> {
  const workflow = await prisma.workflow.findFirst({
    where: { tenantId, processKey, isActive: true },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (!workflow || workflow.steps.length === 0) {
    throw new ProcessNotConfiguredError(processKey);
  }

  // Faz F düzeltmesi — eskiden yalnız (entityType, entityId) ile aranıyordu.
  // Bir varlık türü (ör. CONTRACT_WORKFLOW_SIGNING, OPPORTUNITY) birden fazla
  // süreç tarafından paylaşılabilir (özellikle tenant'ın "+ Yeni Süreç" ile
  // eklediği özel süreçler, sabit süreçlerle AYNI entityType'ı hedefleyebilir);
  // processKey filtresi olmadan başka bir sürecin PENDING zinciri yanlışlıkla
  // eşleşip walkForward'ı o zincirin (uyumsuz) aşamalarına karşı çalıştırıyordu.
  let chain: (ApprovalChain & { stages: ApprovalStage[] }) | null = await prisma.approvalChain.findFirst({
    where: { tenantId, entityType, entityId, processKey, status: 'PENDING' },
    include: { stages: { orderBy: { order: 'asc' } } },
  });

  // Bir aşama kararı geldiyse önce onu uygula.
  if (opts.stageId && opts.decision) {
    if (!chain) throw new Error('Onay zinciri bulunamadı.');
    const stage = chain.stages.find(s => s.id === opts.stageId);
    if (!stage) throw new Error('Onay aşaması bulunamadı.');
    if (stage.status !== 'PENDING') throw new Error('Bu aşama zaten işlenmiş.');

    await prisma.approvalStage.update({
      where: { id: stage.id },
      data: {
        status: opts.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        approverId: opts.actorUserId,
        note: opts.note,
        approvedAt: new Date(),
      },
    });
    await logActivity({
      tenantId,
      userId: opts.actorUserId,
      action: opts.decision === 'APPROVE' ? 'PROCESS_STAGE_APPROVE' : 'PROCESS_STAGE_REJECT',
      entityType,
      entityId,
      details: { processKey, stageId: stage.id },
    });

    chain = await resolveGroupAfterDecision(tenantId, chain.id);
    if (chain) chain = await autoSkipOrphanStages(tenantId, chain.id);
    if (!chain) throw new Error('Onay zinciri işlem sonrası bulunamadı.');

    if (chain.status !== 'PENDING') {
      return { chain, advancedToOrder: null, actionsInvoked: [] };
    }
  }

  if (!chain) {
    chain = await instantiateChain(tenantId, processKey, workflow.steps, entityType, entityId);
  }

  return walkForward(tenantId, workflow.name, workflow.steps, chain, entityType, entityId, opts);
}

/**
 * Bir onay kararı, motoru DOĞRUDAN çağırmayan genel bir rotadan geldiğinde
 * (ör. `/approval-chains/:id/stages/:sid/approve` — PendingChainApprovals.tsx'in
 * kullandığı jenerik onay ucu) süreci devam ettirir: zincir motor tarafından
 * üretildiyse (`processKey` doluysa) bir sonraki aşama grubunun alıcılarına
 * TodoTask + Notification üretir / AUTO adımları çalıştırır. Motor-dışı
 * (legacy/DMO gibi `processKey` boş) zincirlerde no-op — hiçbir şeye dokunmaz.
 */
export async function continueProcess(
  tenantId: string,
  entityType: string,
  entityId: string,
  // Faz F düzeltmesi — çağıran zaten hangi zinciri (ve dolayısıyla hangi
  // processKey'i) devam ettirdiğini biliyor (`chain.id`'den geliyor); bunu
  // AÇIKÇA geçmek, bir entityType birden fazla süreç tarafından paylaşılırken
  // (ör. tenant'ın özel süreçleri sabit süreçlerle aynı entityType'ı hedeflediğinde)
  // yanlış (başka bir sürece ait) PENDING zincirin sessizce eşleşmesini engeller.
  processKey?: string | null,
): Promise<AdvanceProcessResult | null> {
  const chain = await prisma.approvalChain.findFirst({
    where: { tenantId, entityType, entityId, ...(processKey ? { processKey } : {}), status: 'PENDING' },
    include: { stages: { orderBy: { order: 'asc' } } },
  });
  if (!chain || !chain.processKey) return null;

  const workflow = await prisma.workflow.findFirst({
    where: { tenantId, processKey: chain.processKey, isActive: true },
    include: { steps: { orderBy: { order: 'asc' } } },
  });
  if (!workflow) return null;

  return walkForward(tenantId, workflow.name, workflow.steps, chain, entityType, entityId, {});
}

async function walkForward(
  tenantId: string,
  workflowName: string,
  steps: WorkflowStep[],
  chain: ApprovalChain & { stages: ApprovalStage[] },
  entityType: string,
  entityId: string,
  opts: AdvanceProcessOpts,
): Promise<AdvanceProcessResult> {
  const actionsInvoked: string[] = [];

  for (;;) {
    const fresh = await prisma.approvalChain.findFirst({
      where: { id: chain.id },
      include: { stages: { orderBy: { order: 'asc' } } },
    });
    if (!fresh) break;
    chain = fresh;
    if (chain.status !== 'PENDING') break;

    const pending = chain.stages.filter(s => s.status === 'PENDING');
    if (pending.length === 0) {
      chain = await prisma.approvalChain.update({
        where: { id: chain.id },
        data: { status: 'COMPLETED' },
        include: { stages: { orderBy: { order: 'asc' } } },
      });
      break;
    }

    const minOrder = Math.min(...pending.map(s => s.order));
    const group = chain.stages.filter(s => s.order === minOrder);
    const groupSteps = group.map(stage => ({ stage, step: findStepForStage(steps, stage) }));
    const allAuto = groupSteps.every(gs => gs.step?.type === 'AUTO');

    if (allAuto) {
      for (const { stage, step } of groupSteps) {
        if (stage.status !== 'PENDING') continue;
        if (step?.actionKey) {
          const action = STAGE_ACTIONS[step.actionKey];
          if (!action) throw new Error(`actionKey uygulanmadı: ${step.actionKey}`);
          await action({ tenantId, entityType, entityId, step, actorUserId: opts.actorUserId, input: opts.input });
          actionsInvoked.push(step.actionKey);
        }
        await prisma.approvalStage.update({
          where: { id: stage.id },
          data: {
            status: 'APPROVED',
            approverId: opts.actorUserId,
            note: step?.actionKey ? `Otomatik eylem çalıştı: ${step.actionKey}` : 'Otomatik adım tamamlandı',
            approvedAt: new Date(),
          },
        });
      }
      await logActivity({
        tenantId,
        userId: opts.actorUserId,
        action: 'PROCESS_AUTO_STEP',
        entityType,
        entityId,
        details: { order: minOrder, actionsInvoked },
      });
      continue;
    }

    // Boş koltuk (orphan) çözümü — insan kararı beklemeden ÖNCE. Bu MANUAL grupta
    // aktif kullanıcısı olmayan roller lisanslı otonom agent'la onaylanır ya da
    // SKIP edilir. Bir şey çözüldüyse döngüyü baştan işlet: böylece agent'la
    // kapatılan MANUAL ön-eklerden sonra gelen AUTO adımlar da AYNI tetiklemede
    // koşar (önceden zincir görünürde ilerliyor ama AUTO yan etkisi —
    // sözleşme/proje/fatura yaratma — hiç çalışmıyordu; yalnız /approval-chains
    // onay rotasından gelen çağrılar continueProcess ile pompalanıyordu).
    const pendingCountBefore = chain.stages.filter(s => s.status === 'PENDING').length;
    const healed = await autoSkipOrphanStages(tenantId, chain.id);
    if (healed && (healed.status !== 'PENDING'
      || healed.stages.filter(s => s.status === 'PENDING').length < pendingCountBefore)) {
      chain = healed as typeof chain;
      continue;
    }

    // MANUAL aşama içeren grup: alıcıları çöz, henüz bildirilmediyse TodoTask +
    // Notification üret, sonra dur — insan kararı bekler.
    // Değişmez kural #5 — Todo'ya eklenen görev bir deadline taşımalı ve mevcut
    // TodoTask SLA eskalasyon sweep'ine (slaEscalation.ts) girebilmeli: aynı
    // slaBusinessDays kaynağı ApprovalStage'in kendi SLA'sıyla tutarlı tutulur.
    const slaDays = await getApprovalSlaBusinessDays(tenantId);
    const taskDueDate = computeSlaDueDate(slaDays) ?? undefined;
    for (const { stage, step } of groupSteps) {
      if (!step) continue;
      const marker = `PROCESS_STAGE:${stage.id}`;
      const already = await prisma.todoTask.findFirst({ where: { tenantId, actionKey: marker } });
      if (already) continue;

      const recipients = await resolveStepRecipients(
        tenantId,
        { unitId: step.unitId, role: step.role, delegateUserId: step.delegateUserId, recipientField: step.recipientField },
        { entityType, entityId },
      );
      for (const user of recipients) {
        await prisma.todoTask.create({
          data: {
            title: `Onay bekliyor: ${workflowName}`,
            description: [step.description, opts.note].filter(Boolean).join('\n\n') || null,
            unitId: step.unitId,
            assignedToUserId: user.id,
            assignedBy: opts.actorUserId || 'system',
            actionKey: marker,
            priority: 'HIGH',
            status: 'PENDING',
            relatedModule: entityType,
            relatedItemId: entityId,
            tenantId,
            dueDate: taskDueDate,
            slaBusinessDays: slaDays,
          },
        });
        await prisma.notification
          .create({
            data: {
              tenantId,
              userId: user.id,
              type: 'APPROVAL',
              title: 'Onayınız bekleniyor',
              message: `"${workflowName}" sürecinde bir aşama onayınızı bekliyor.`,
              // Notification.relatedModule TodoTask'ın aksine (bkz. satır 922, taskTargetTab
              // ile çevriliyor) Header.tsx'te ÇEVİRİSİZ doğrudan activeTab olarak kullanılıyor
              // — burada gerçek sekme id'si gerekir, entityType değil.
              ...(entityTypeToTab(entityType) ? { relatedModule: entityTypeToTab(entityType), relatedItemId: entityId } : {}),
            },
          })
          .catch(() => undefined);
        await notifyUnitManager(tenantId, user, workflowName, entityType, entityId, step.description || '');
      }
    }
    break;
  }

  const stillPending = chain.stages.filter(s => s.status === 'PENDING');
  return {
    chain,
    advancedToOrder: chain.status === 'PENDING' && stillPending.length ? Math.min(...stillPending.map(s => s.order)) : null,
    actionsInvoked,
  };
}

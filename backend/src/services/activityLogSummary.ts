// Enflow — Denetim İzi (ActivityLog) okunabilirlik katmanı
// ─────────────────────────────────────────────────────────────────────────────
// logActivity() her satırı yazarken bu modülü kullanarak aktör adını ve
// varlık başlığını YAZMA ANINDA çözer ve tek satırlık Türkçe özet üretir.
// Write-time snapshot bilinçli bir tercih: kayıt silinse/yeniden adlandırılsa
// bile özet anlamlı kalır — hem canlı ekranda hem ileride dışa aktarılan
// arşiv dosyasında (activityLogArchiveService.ts) kendi başına okunabilir.

import { prisma } from '../prismaClient';
import { isAgentActor, agentDisplayLabel } from './agentProvenance';

// ── Aktör adı ────────────────────────────────────────────────────────────────
export async function resolveActorName(userId: string, actorType?: string | null): Promise<string> {
  if (actorType === 'AGENT' || isAgentActor(userId)) {
    return `🤖 ${agentDisplayLabel(userId)}`;
  }
  if (!userId || userId === 'system') return 'Sistem';
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    return u?.name || userId;
  } catch {
    return userId;
  }
}

// ── Varlık etiketi (entityType → insan-okunur başlık/ad alanı) ────────────────
type LabelResolver = (tenantId: string, entityId: string) => Promise<string | null>;

const first = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);

const RESOLVERS: Record<string, LabelResolver> = {
  OPPORTUNITY: async (tenantId, id) => first((await prisma.opportunity.findFirst({ where: { id, tenantId }, select: { title: true } }))?.title),
  PROPOSAL: async (tenantId, id) => {
    const p = await prisma.proposal.findFirst({ where: { id, tenantId }, select: { opportunity: { select: { title: true } }, version: true } });
    return p ? `${p.opportunity.title} — v${p.version}` : null;
  },
  PROJECT: async (tenantId, id) => first((await prisma.project.findFirst({ where: { id, tenantId }, select: { name: true } }))?.name),
  CONTRACT_WORKFLOW: async (tenantId, id) => first((await prisma.contractWorkflow.findFirst({ where: { id, tenantId }, select: { title: true } }))?.title),
  CONTRACT: async (tenantId, id) => first((await prisma.contract.findFirst({ where: { id, tenantId }, select: { title: true } }))?.title),
  TENDER: async (tenantId, id) => first((await prisma.tender.findFirst({ where: { id, tenantId }, select: { name: true } }))?.name),
  PURCHASE_REQUEST: async (tenantId, id) => first((await prisma.purchaseRequest.findFirst({ where: { id, tenantId }, select: { title: true } }))?.title),
  VENDOR: async (tenantId, id) => first((await prisma.vendor.findFirst({ where: { id, tenantId }, select: { name: true } }))?.name),
  INVOICE: async (tenantId, id) => {
    const inv = await prisma.invoice.findFirst({ where: { id, tenantId }, select: { invoiceNo: true, type: true } });
    return inv ? (inv.invoiceNo || `${inv.type} Fatura`) : null;
  },
  PROJECT_COST: async (tenantId, id) => first((await prisma.projectCostItem.findFirst({ where: { id, project: { tenantId } }, select: { description: true } }))?.description),
  GUARANTEE: async (tenantId, id) => {
    const g = await prisma.guaranteeLetter.findFirst({ where: { id, tenantId }, select: { type: true, bankName: true } });
    return g ? [g.type, g.bankName].filter(Boolean).join(' — ') || null : null;
  },
  LEGAL_CASE: async (tenantId, id) => first((await prisma.legalCase.findFirst({ where: { id, tenantId }, select: { title: true } }))?.title),
  TASK: async (tenantId, id) => first((await prisma.todoTask.findFirst({ where: { id, tenantId }, select: { title: true } }))?.title),
  CUSTOMER: async (tenantId, id) => first((await prisma.customer.findFirst({ where: { id, tenantId }, select: { name: true } }))?.name),
  USER: async (tenantId, id) => first((await prisma.user.findFirst({ where: { id, tenantId }, select: { name: true } }))?.name),
  UNIT: async (tenantId, id) => first((await prisma.unit.findFirst({ where: { id, tenantId }, select: { name: true } }))?.name),
  DOCUMENT: async (tenantId, id) => first((await prisma.corporateDocument.findFirst({ where: { id, tenantId }, select: { name: true } }))?.name),
  ARCHIVE: async (tenantId, id) => {
    const a = await prisma.archiveItem.findFirst({ where: { id, tenantId }, select: { description: true, boxNo: true } });
    return a ? (a.description || a.boxNo) : null;
  },
  LESSON: async (tenantId, id) => first((await prisma.lessonsLearned.findFirst({ where: { id, tenantId }, select: { title: true } }))?.title),
  RISK: async (tenantId, id) => first((await prisma.riskOpportunity.findFirst({ where: { id, tenantId }, select: { title: true } }))?.title),
  METRIC: async (tenantId, id) => first((await prisma.corporateMetric.findFirst({ where: { id, tenantId }, select: { name: true } }))?.name),
  EXTERNAL_DOC: async (tenantId, id) => first((await prisma.externalDocumentRegister.findFirst({ where: { id, tenantId }, select: { name: true } }))?.name),
  WORKFLOW: async (tenantId, id) => first((await prisma.workflow.findFirst({ where: { id, tenantId }, select: { name: true } }))?.name),
  CONTACT: async (tenantId, id) => first((await prisma.contact.findFirst({ where: { id, tenantId }, select: { name: true } }))?.name),
  SERVICE_TICKET: async (tenantId, id) => first((await prisma.serviceTicket.findFirst({ where: { id, tenantId }, select: { title: true } }))?.title),
  TENANT: async (_tenantId, id) => first((await prisma.tenant.findFirst({ where: { id }, select: { name: true } }))?.name),
};

export async function resolveEntityLabel(tenantId: string, entityType: string, entityId: string): Promise<string | null> {
  const resolver = RESOLVERS[entityType];
  if (!resolver) return null;
  try {
    return await resolver(tenantId, entityId);
  } catch {
    return null; // silinmiş kayıt / geçersiz id — sessizce atla
  }
}

// ── Varlık tipi Türkçe adı (nominative — çekim eki gerektirmez) ───────────────
const ENTITY_LABEL_TR: Record<string, string> = {
  OPPORTUNITY: 'Fırsat', PROPOSAL: 'Teklif', PROJECT: 'Proje', CONTRACT_WORKFLOW: 'Sözleşme Süreci',
  CONTRACT: 'Sözleşme', TENDER: 'İhale', PURCHASE_REQUEST: 'Satınalma Talebi', VENDOR: 'Tedarikçi',
  INVOICE: 'Fatura', PROJECT_COST: 'Proje Maliyet Kalemi', GUARANTEE: 'Teminat Mektubu',
  LEGAL_CASE: 'Hukuk Vakası', TASK: 'Görev', CUSTOMER: 'Müşteri', USER: 'Kullanıcı', UNIT: 'Birim',
  DOCUMENT: 'Doküman', ARCHIVE: 'Arşiv Kaydı', LESSON: 'Alınan Ders', RISK: 'Risk/Fırsat Kaydı',
  METRIC: 'KPI', EXTERNAL_DOC: 'Dış Doküman', VISIT_PLAN: 'Ziyaret Planı', WORKFLOW: 'İş Akışı',
  APPROVAL_STAGE: 'Onay Aşaması', BACKUP_JOB: 'Yedek İşi', RESTORE_JOB: 'Geri Yükleme İşi',
  BOM_QUOTE: 'BoM Teklifi', CONTACT: 'Kişi', DAILY_REPORT: 'Günlük Rapor', SERVICE_TICKET: 'Servis Talebi',
  TENANT: 'Kiracı', DMO_ORDER: 'DMO Sipariş', DMO_AGREEMENT: 'DMO Çerçeve Anlaşması',
  DMO_CATALOG_ITEM: 'DMO Katalog Kalemi', DMO_RATE: 'DMO Risturn Oranı', OPERATING_COST_POOL: 'İşletme Maliyet Havuzu',
  PROJECT_UNIT_PARTICIPATION: 'Proje Birim Katılımı', REPORT_SETTINGS: 'Rapor Ayarı', SUBSCRIPTION: 'Abonelik',
  UNIT_BUDGET: 'Birim Bütçesi', ACTIVITY_LOG_ARCHIVE: 'Denetim İzi Arşivi',
};

function humanizeEntityType(entityType: string): string {
  return ENTITY_LABEL_TR[entityType] || entityType.toLowerCase().replace(/_/g, ' ');
}

// ── Aksiyon → Türkçe eylem cümlesi ─────────────────────────────────────────────
const ACTION_VERB_TR: Record<string, string> = {
  CREATE: 'oluşturdu', UPDATE: 'güncelledi', DELETE: 'sildi', UPLOAD: 'dosya yükledi', UPSERT: 'kaydetti',
  TRANSFER_TO_PROJECT: 'projeye aktardı', CONTRACT_TO_PROCUREMENT: 'satınalmaya aktardı',
  CONTRACT_WORKFLOW_CREATED: 'sözleşme süreci başlattı', STAGE_APPROVE: 'onay aşamasını onayladı',
  STAGE_REJECT: 'onay aşamasını reddetti', APPROVAL_STAGE_APPROVE: 'onay aşamasını onayladı',
  REVERT_APPROVAL: 'onayı geri aldı', RESUBMIT: 'yeniden onaya gönderdi', SUBMIT_COST_APPROVAL: 'maliyet onayına gönderdi',
  SELECT_BOM_QUOTE: 'BoM teklifini seçti', UPLOAD_BOM_QUOTE_FILE: 'BoM teklif dosyası yükledi',
  BOM_EVALUATION_ARCHIVED: 'BoM değerlendirmesini arşivledi', BOM_HANDED_OFF: 'BoM\'u satışa devretti',
  BOM_REVISED_RESET: 'BoM\'u revize etti', BACKUP_CREATE: 'yedek oluşturdu', BACKUP_VERIFY: 'yedeği doğruladı',
  BACKUP_SCHEDULED_RUN: 'zamanlı yedeği çalıştırdı', BACKUP_SETTINGS_UPDATED: 'yedekleme ayarlarını güncelledi',
  RESTORE_ANALYZE: 'geri yüklemeyi analiz etti', RESTORE_STATE_STAGE: 'geri yükleme durumunu hazırladı',
  RESTORE_APPLY: 'geri yüklemeyi uyguladı', ACTIVITY_LOG_ARCHIVED: 'denetim izini arşivledi',
  DMO_RECOST: 'DMO maliyetini yeniden hesapladı', DMO_SETTINGS_UPDATED: 'DMO ayarlarını güncelledi',
  FINANCE_RATES_UPDATED: 'finans oranlarını güncelledi', FINANCING_COST_APPLIED: 'finansman maliyeti uyguladı',
  GOVERNANCE_SETTINGS_UPDATED: 'yönetişim ayarlarını güncelledi', SALES_SETTINGS_UPDATED: 'satış ayarlarını güncelledi',
  AI_SETTINGS_UPDATED: 'YZ ayarlarını güncelledi', LICENSE_ACTIVATED: 'lisansı etkinleştirdi',
  PAYMENT: 'ödeme kaydetti', PRESALES_SPEC_EXTRACT: 'şartnameden ürün çıkardı', SEED_TEMPLATE: 'şablonu oluşturdu',
  SHARE_PERIOD: 'dönem raporunu paylaştı', TENDER_ANALYZE: 'ihaleyi YZ ile analiz etti',
  TENDER_AUTOMATCH: 'ihale otomatik eşleşmesi yaptı', TENDER_SUBMITTED: 'ihaleyi teslim etti',
  TENDER_TRIGGERED: 'ihale sürecini tetikledi', TENDER_WITHDRAWN: 'ihaleden çekildi',
  DELIVERY_RECORD: 'teslimat kaydı oluşturdu', AGENT_ACTION: 'otonom eylem gerçekleştirdi', AGENT_RUN: 'agent çalıştırdı',
};

const STATUS_LABEL_TR: Record<string, string> = {
  WON: 'Kazanıldı', LOST: 'Kaybedildi', WITHDRAWN: 'Çekildi', APPROVED: 'Onaylandı', REJECTED: 'Reddedildi',
  PENDING: 'Beklemede', CLOSED: 'Kapatıldı', CANCELLED: 'İptal Edildi', SIGNED: 'İmzalandı',
  TRANSFERRED: 'Aktarıldı', COMPLETED: 'Tamamlandı', IN_PROGRESS: 'Devam Ediyor', ON_HOLD: 'Beklemede',
  SUBMITTED: 'Gönderildi', RESOLVED: 'Çözüldü', VERIFIED: 'Doğrulandı', WAIVED: 'Muaf', UPLOADED: 'Yüklendi',
  PAID: 'Ödendi', PARTIAL: 'Kısmi Ödendi', OVERDUE: 'Vadesi Geçti', ISSUED: 'Kesildi', SENT: 'Gönderildi',
  ACTIVE: 'Aktif', INACTIVE: 'Pasif', PO_ISSUED: 'Sipariş Kesildi', IN_DELIVERY: 'Teslimatta',
  INVOICED: 'Faturalandı', READY_TO_SIGN: 'İmzaya Hazır', ANALYSIS_DONE: 'Analiz Tamamlandı',
  PREPARATION: 'Hazırlıkta', PENDING_SIGNATURE_APPROVAL: 'İmza Onayı Bekliyor', DRAFT: 'Taslak',
  ACCEPTED: 'Kabul Edildi', PLANNING: 'Planlamada',
};

const DYNAMIC_PREFIXES: { prefix: string; phrase: (label: string) => string }[] = [
  { prefix: 'STATUS_', phrase: (l) => `durumu "${l}" olarak güncelledi` },
  { prefix: 'COST_', phrase: (l) => `maliyet onay durumunu "${l}" olarak güncelledi` },
  { prefix: 'GUARANTEE_', phrase: (l) => `teminat durumunu "${l}" olarak güncelledi` },
];

function resolveVerb(action: string): string {
  if (ACTION_VERB_TR[action]) return ACTION_VERB_TR[action];
  for (const d of DYNAMIC_PREFIXES) {
    if (action.startsWith(d.prefix)) {
      const suffix = action.slice(d.prefix.length);
      return d.phrase(STATUS_LABEL_TR[suffix] || suffix.toLowerCase().replace(/_/g, ' '));
    }
  }
  // Bilinmeyen aksiyon — hiçbir zaman boş/kırık cümle üretmeyen genel dönüş
  return `${action.toLowerCase().replace(/_/g, ' ')} işlemi yaptı`;
}

export interface SummaryInput {
  actorName: string;
  action: string;
  entityType: string;
  entityLabel: string | null;
}

/** Tek satırlık Türkçe denetim-izi özeti: "Ad: Varlık eylem (\"etiket\")" */
export function buildSummary({ actorName, action, entityType, entityLabel }: SummaryInput): string {
  const entityTypeLabel = humanizeEntityType(entityType);
  const verb = resolveVerb(action);
  const suffix = entityLabel ? ` ("${entityLabel}")` : '';
  return `${actorName}: ${entityTypeLabel} ${verb}${suffix}`;
}

// Enflow — Yönetişim kuralları: Görev Ayrılığı (Segregation of Duties)
// ─────────────────────────────────────────────────────────────────────────────
// Bir kaydı OLUŞTURAN kişi, onu ONAYLAYAMAZ. Aynı insan iki rolü taşısa bile
// kendi işini onaylayamaz (RBAC tek başına bunu yakalamaz). Tenant-bazlı toggle:
// moduleSettings.governance.enforceSoD (varsayılan: AÇIK).

import { prisma } from '../prismaClient';

// ── Delegation of Authority — Tutar-Bazlı Onay Matrisi ──────────────────────
// OPT-IN: tenant `moduleSettings.governance.approvalMatrix` tanımlamazsa mevcut
// sabit swimlane şablonu kullanılır (davranış DEĞİŞMEZ). Tanımlarsa, kaydın
// tutarına göre onay aşaması rolleri matristen seçilir.
export interface ApprovalTier { maxAmount: number; roles: string[] }

// Yalnız öneri/varsayılan — tenant kendi matrisini girene kadar UYGULANMAZ.
export const DEFAULT_APPROVAL_MATRIX: ApprovalTier[] = [
  { maxAmount: 100_000, roles: ['SALES_MGR'] },
  { maxAmount: 1_000_000, roles: ['FINANCE_MGR', 'GENERAL_MANAGER'] },
  { maxAmount: Number.MAX_SAFE_INTEGER, roles: ['FINANCE_MGR', 'IGPD_MGR', 'GENERAL_MANAGER', 'KSU_MGR'] },
];

export async function getApprovalMatrix(tenantId: string): Promise<ApprovalTier[] | null> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(t?.moduleSettings || '{}'); } catch { ms = {}; }
  const g = (ms.governance as { approvalMatrix?: ApprovalTier[] }) || {};
  const m = g.approvalMatrix;
  if (Array.isArray(m) && m.length && m.every(x => typeof x?.maxAmount === 'number' && Array.isArray(x.roles))) {
    return [...m].sort((a, b) => a.maxAmount - b.maxAmount);
  }
  return null;
}

/**
 * Tutara göre onay rolleri; matris yoksa veya tutar yoksa null (çağıran şablona düşer).
 */
export async function resolveApproverRoles(
  tenantId: string,
  amount?: number | null,
): Promise<string[] | null> {
  if (amount == null || !Number.isFinite(amount)) return null;
  const matrix = await getApprovalMatrix(tenantId);
  if (!matrix) return null;
  const tier = matrix.find(t => amount <= t.maxAmount) || matrix[matrix.length - 1];
  return tier.roles.length ? tier.roles : null;
}

export async function isSoDEnabled(tenantId: string): Promise<boolean> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(t?.moduleSettings || '{}'); } catch { ms = {}; }
  const g = (ms.governance as { enforceSoD?: boolean }) || {};
  return g.enforceSoD !== false; // varsayılan AÇIK
}

/** Onay zinciri / domain entity'sinin oluşturanını çözer (yoksa null). */
export async function resolveEntityCreator(entityType: string, entityId: string): Promise<string | null> {
  try {
    if (entityType === 'OPPORTUNITY') {
      const o = await prisma.opportunity.findUnique({ where: { id: entityId }, select: { createdById: true } });
      return o?.createdById ?? null;
    }
    if (entityType === 'PROPOSAL') {
      // Proposal'da oluşturan alanı yok → bağlı fırsatın sahibini (oluşturanını) kullan.
      const p = await prisma.proposal.findUnique({ where: { id: entityId }, select: { opportunityId: true } });
      if (!p?.opportunityId) return null;
      const o = await prisma.opportunity.findUnique({ where: { id: p.opportunityId }, select: { createdById: true } });
      return o?.createdById ?? null;
    }
    // CONTRACT_WORKFLOW vb. oluşturan izlenmiyor → SoD uygulanamaz (null).
  } catch { /* yut */ }
  return null;
}

/**
 * SoD ihlali varsa açıklama döner; ihlal yoksa/kapalıysa/çözülemiyorsa null.
 * actorUserId = işlemi yapan gerçek kullanıcı (req.userId).
 */
export async function sodViolation(
  tenantId: string,
  actorUserId: string | undefined,
  entityType: string,
  entityId: string,
): Promise<string | null> {
  if (!actorUserId) return null;
  if (!(await isSoDEnabled(tenantId))) return null;
  const creator = await resolveEntityCreator(entityType, entityId);
  if (creator && creator === actorUserId) {
    return 'Görev ayrılığı (SoD): bir kaydı oluşturan kişi onu onaylayamaz.';
  }
  return null;
}

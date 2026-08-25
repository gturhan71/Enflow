// Ortak "Fırsat" döküman klasör kökü — Fırsat→Proje boyunca üretilen tüm
// dosyalar (zorunlu evraklar, ContractWorkflow evrakları, Tender dosyaları,
// BoM tedarikçi teklifleri, Proje devir evrakları, Teminat Mektupları)
// trackingCode altında tek bir dizin ağacında toplanır. Yalnız BUNDAN SONRA
// üretilen dosyalar için geçerlidir — geçmiş dosyalar taşınmaz (forward-only,
// bkz. plan: "Fırsat Takip Kodu + Zorunlu Evrak + Merkezi Döküman Klasörü").
import path from 'path';
import { prisma } from '../prismaClient';
import { slugify, getUploadDir } from '../utils/fileUpload';

const OPPORTUNITIES_UPLOADS_ROOT = path.join(__dirname, '../../uploads/opportunities');

/** `backend/uploads/opportunities/{trackingCode}/{subfolder}/` dizinini oluşturur/döner. */
export function resolveOpportunityUploadDir(trackingCode: string, subfolder: string): { dir: string; folder: string } {
  const folder = slugify(trackingCode);
  const dir = getUploadDir(OPPORTUNITIES_UPLOADS_ROOT, path.join(folder, subfolder));
  return { dir, folder };
}

export function opportunityLocalUrl(trackingCode: string, subfolder: string, fileName: string): string {
  return `/uploads/opportunities/${slugify(trackingCode)}/${subfolder}/${fileName}`;
}

export function opportunityRemotePath(trackingCode: string, subfolder: string): string {
  return `/ENFLOW_DMS/Opportunities/${slugify(trackingCode)}/${subfolder}`;
}

export type OpportunityEntityType = 'CONTRACT_WORKFLOW' | 'TENDER' | 'BOM_LINE_QUOTE' | 'PROJECT_HANDOVER_DOC' | 'GUARANTEE_LETTER';

/**
 * Bir modül kaydının ait olduğu Fırsat'ı (varsa) çözer. `trackingCode` ile
 * dönerse çağıran taraf ortak kökü kullanır; `null` dönerse (opportunityId
 * yok, zincir kırık veya fırsatın henüz trackingCode'u yoksa) çağıran taraf
 * KENDİ eski klasör davranışına düşer — geriye uyumluluk bilinçli korunur.
 */
export async function resolveOpportunityForEntity(
  entityType: OpportunityEntityType,
  entity: Record<string, unknown>,
  tenantId: string
): Promise<{ opportunityId: string; trackingCode: string } | null> {
  let opportunityId: string | null = null;

  switch (entityType) {
    case 'CONTRACT_WORKFLOW':
    case 'TENDER':
    case 'BOM_LINE_QUOTE':
      opportunityId = (entity.opportunityId as string | null | undefined) || null;
      break;
    case 'PROJECT_HANDOVER_DOC': {
      const projectId = entity.projectId as string | undefined;
      if (projectId) {
        const project = await prisma.project.findFirst({ where: { id: projectId, tenantId }, select: { opportunityId: true } });
        opportunityId = project?.opportunityId || null;
      }
      break;
    }
    case 'GUARANTEE_LETTER': {
      const tenderId = entity.tenderId as string | undefined;
      const projectId = entity.projectId as string | undefined;
      if (tenderId) {
        const tender = await prisma.tender.findFirst({ where: { id: tenderId, tenantId }, select: { opportunityId: true } });
        opportunityId = tender?.opportunityId || null;
      }
      if (!opportunityId && projectId) {
        const project = await prisma.project.findFirst({ where: { id: projectId, tenantId }, select: { opportunityId: true } });
        opportunityId = project?.opportunityId || null;
      }
      break;
    }
  }

  if (!opportunityId) return null;
  const opp = await prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId }, select: { id: true, trackingCode: true } });
  if (!opp?.trackingCode) return null;
  return { opportunityId: opp.id, trackingCode: opp.trackingCode };
}

import { prisma } from '../prismaClient';
import { nextProjectCode } from './projectCodeService';

// Proje oluşturma + milestone şablonu — projects.ts POST ve contractWorkflow.ts /transfer
// tarafından ortak kullanılır (duplikasyon yok).

export const PROJECT_INCLUDE = {
  milestones: { orderBy: { order: 'asc' as const } },
  projectCostItems: { orderBy: { createdAt: 'desc' as const } },
};

type MilestoneTmpl = { title: string; milestoneType: string; requiresApproval: boolean; isParallel: boolean };

export function getMilestoneTemplate(type: string): MilestoneTmpl[] {
  const T: Record<string, MilestoneTmpl[]> = {
    HARDWARE: [
      { title: 'Planlama',              milestoneType: 'PLANNING',     requiresApproval: false, isParallel: false },
      { title: 'Satınalma',             milestoneType: 'PROCUREMENT',  requiresApproval: false, isParallel: false },
      { title: 'Sevkiyat',              milestoneType: 'SHIPMENT',     requiresApproval: false, isParallel: false },
      { title: 'Kurulum',               milestoneType: 'INSTALLATION', requiresApproval: false, isParallel: false },
      { title: 'Test & Kabul',          milestoneType: 'ACCEPTANCE',   requiresApproval: true,  isParallel: false },
      { title: 'Garanti Süreci',        milestoneType: 'WARRANTY',     requiresApproval: false, isParallel: false },
      { title: 'Faturalandırma',        milestoneType: 'INVOICING',    requiresApproval: false, isParallel: false },
      { title: 'Tahsilat',              milestoneType: 'COLLECTION',   requiresApproval: false, isParallel: false },
    ],
    SOFTWARE: [
      { title: 'Planlama & Analiz',     milestoneType: 'PLANNING',     requiresApproval: false, isParallel: false },
      { title: 'Geliştirme',            milestoneType: 'DEVELOPMENT',  requiresApproval: false, isParallel: true  },
      { title: 'Test',                  milestoneType: 'TESTING',      requiresApproval: false, isParallel: true  },
      { title: 'Kabul & Geçiş',         milestoneType: 'ACCEPTANCE',   requiresApproval: true,  isParallel: false },
      { title: 'Garanti Süreci',        milestoneType: 'WARRANTY',     requiresApproval: false, isParallel: false },
      { title: 'Faturalandırma',        milestoneType: 'INVOICING',    requiresApproval: false, isParallel: false },
      { title: 'Tahsilat',              milestoneType: 'COLLECTION',   requiresApproval: false, isParallel: false },
    ],
    SERVICE: [
      { title: 'Planlama',              milestoneType: 'PLANNING',     requiresApproval: false, isParallel: false },
      { title: 'Hizmet Sözleşmesi',     milestoneType: 'CUSTOM',       requiresApproval: false, isParallel: false },
      { title: 'Hizmet Teslimi',        milestoneType: 'INSTALLATION', requiresApproval: false, isParallel: false },
      { title: 'Kabul',                 milestoneType: 'ACCEPTANCE',   requiresApproval: true,  isParallel: false },
      { title: 'Garanti Süreci',        milestoneType: 'WARRANTY',     requiresApproval: false, isParallel: false },
      { title: 'Faturalandırma',        milestoneType: 'INVOICING',    requiresApproval: false, isParallel: false },
      { title: 'Tahsilat',              milestoneType: 'COLLECTION',   requiresApproval: false, isParallel: false },
    ],
    MIXED: [
      { title: 'Planlama',              milestoneType: 'PLANNING',     requiresApproval: false, isParallel: false },
      { title: 'Satınalma',             milestoneType: 'PROCUREMENT',  requiresApproval: false, isParallel: true  },
      { title: 'Geliştirme',            milestoneType: 'DEVELOPMENT',  requiresApproval: false, isParallel: true  },
      { title: 'Kurulum & Entegrasyon', milestoneType: 'INSTALLATION', requiresApproval: false, isParallel: false },
      { title: 'Test & Kabul',          milestoneType: 'ACCEPTANCE',   requiresApproval: true,  isParallel: false },
      { title: 'Garanti Süreci',        milestoneType: 'WARRANTY',     requiresApproval: false, isParallel: false },
      { title: 'Faturalandırma',        milestoneType: 'INVOICING',    requiresApproval: false, isParallel: false },
      { title: 'Tahsilat',              milestoneType: 'COLLECTION',   requiresApproval: false, isParallel: false },
    ],
  };
  return T[type] ?? T.HARDWARE;
}

export interface ProjectFactoryInput {
  name?: string;
  type?: string;
  description?: string;
  customerId?: string;
  customerName?: string;
  opportunityId?: string;
  contractId?: string;
  pmId?: string;
  pmName?: string;
  ownerId?: string;
  totalValue?: number;
  contractCurrency?: string;
  budgetTotal?: number;
  avgMargin?: number;
  startDate?: string | Date;
  plannedEndDate?: string | Date;
  deadline?: string | Date;
  status?: string;
  milestoneTemplate?: string;
  procurementNotes?: string;
}

export async function createProjectWithMilestones(
  tenantId: string,
  input: ProjectFactoryInput,
  userId?: string,
) {
  let {
    name, type = 'HARDWARE', description,
    customerId, customerName, opportunityId, contractId,
    pmId, pmName, ownerId,
    totalValue = 0, contractCurrency = 'TRY', budgetTotal = 0, avgMargin = 0,
    startDate, plannedEndDate, deadline,
    status = 'PLANNING',
    milestoneTemplate,
    procurementNotes,
  } = input;

  // Fırsat verisini otomatik çek
  if (opportunityId) {
    const opp = await prisma.opportunity.findFirst({
      where: { id: opportunityId, tenantId },
      include: { customer: true },
    });
    if (opp) {
      if (!name) name = opp.title;
      if (!customerId) customerId = opp.customerId;
      if (!customerName && opp.customer) customerName = opp.customer.name;
      if (!totalValue) totalValue = opp.value;
      if (!budgetTotal) budgetTotal = opp.value;
    }
  }

  const code = await nextProjectCode(tenantId, type);

  const project = await prisma.project.create({
    data: {
      tenantId,
      code,
      name: name || 'İsimsiz Proje',
      type,
      description: description || null,
      customerId: customerId || null,
      customerName: customerName || null,
      opportunityId: opportunityId || null,
      contractId: contractId || null,
      pmId: pmId || userId,
      pmName: pmName || null,
      ownerId: ownerId || userId,
      totalValue: Number(totalValue),
      contractCurrency,
      budgetTotal: Number(budgetTotal),
      avgMargin: Number(avgMargin),
      startDate: startDate ? new Date(startDate) : new Date(),
      plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
      deadline: deadline ? new Date(deadline) : (plannedEndDate ? new Date(plannedEndDate) : new Date()),
      status,
      phase: 'Planlama',
      procurementNotes: procurementNotes || null,
    },
  });

  // Milestone şablonu uygula
  const templates = getMilestoneTemplate(milestoneTemplate || type);
  for (const [idx, tmpl] of templates.entries()) {
    await prisma.projectMilestone.create({
      data: { projectId: project.id, ...tmpl, order: idx },
    });
  }

  return prisma.project.findFirst({ where: { id: project.id }, include: PROJECT_INCLUDE });
}

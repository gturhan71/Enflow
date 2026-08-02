import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { logActivity } from '../services/activityLog';

const router: Router = Router();

router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const proposals = await prisma.proposal.findMany({
    where: { tenantId: req.tenantId },
    include: { opportunity: { include: { customer: true } } }
  });
  res.json(proposals);
}));

router.post('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { opportunityId, status, content, ...rest } = req.body;
  const tenantId = req.tenantId;

  if (!opportunityId) {
    return res.status(400).json({ error: 'Fırsat seçimi zorunludur.' });
  }

  const latestProposal = await prisma.proposal.findFirst({
    where: { opportunityId, tenantId },
    orderBy: { version: 'desc' }
  });

  const nextVersion = latestProposal ? latestProposal.version + 1 : 1;
  const proposalContent = content || rest;

  const proposal = await prisma.proposal.create({
    data: {
      opportunityId,
      content: typeof proposalContent === 'string' ? proposalContent : JSON.stringify(proposalContent),
      status: status || 'DRAFT',
      version: nextVersion,
      tenantId
    },
    include: { opportunity: { include: { customer: true } } }
  });

  if (status === 'SENT' || status === 'ACCEPTED') {
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: 'PROPOSAL' }
    });
  } else if (proposalContent && (proposalContent.openForNegotiation === true || proposalContent.openForNegotiation === 'true')) {
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: 'NEGOTIATION' }
    });
  }

  // Kredi limiti — pipeline maruziyeti (schema değişikliği gerektirmeyen aşama; gerçek
  // açık-fatura tutarı Invoice.customerId eklenene kadar ayrı bir fazda). Müşterinin
  // WON/LOST/WITHDRAWN olmayan tüm fırsatlarının toplamı creditLimit'i aşıyorsa
  // hazırlayana (yanıtta) ve GM/Satış Müdürü'ne (bildirim) bildirilir — önceden
  // Customer.creditLimit hiçbir karar anında okunmuyordu.
  let creditWarning: { exposure: number; creditLimit: number; currency: string } | null = null;
  const customer = proposal.opportunity?.customer;
  if (customer && customer.creditLimit > 0) {
    const openOpps = await prisma.opportunity.findMany({
      where: { tenantId, customerId: customer.id, status: { notIn: ['WON', 'LOST', 'WITHDRAWN'] } },
      select: { value: true },
    });
    const exposure = openOpps.reduce((s, o) => s + (o.value || 0), 0);
    if (exposure > customer.creditLimit) {
      creditWarning = { exposure, creditLimit: customer.creditLimit, currency: customer.currency };
      const targets = await prisma.user.findMany({ where: { tenantId, role: { in: ['SALES_MGR', 'GENERAL_MANAGER'] }, status: 'ACTIVE' } });
      for (const u of targets) {
        await prisma.notification.create({
          data: {
            tenantId, userId: u.id, type: 'WARNING',
            title: 'Kredi limiti aşıldı',
            message: `${customer.name} — açık fırsat toplamı ${exposure.toLocaleString('tr-TR')} ${customer.currency}, kredi limitini (${customer.creditLimit.toLocaleString('tr-TR')} ${customer.currency}) aşıyor.`,
            relatedModule: 'crm-opportunities', relatedItemId: opportunityId,
          },
        }).catch(() => {});
      }
    }
  }

  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'PROPOSAL', entityId: proposal.id, details: { opportunityId: proposal.opportunityId, version: proposal.version, creditWarning: creditWarning ? true : undefined } });
  res.json({ ...proposal, creditWarning });
}));

router.put('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { content, status, rejectionReason } = req.body;
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.proposal.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const data: Record<string, unknown> = {};
  if (content) data.content = typeof content === 'string' ? content : JSON.stringify(content);
  if (status) data.status = status;
  if (rejectionReason !== undefined) data.rejectionReason = rejectionReason || null;

  const proposal = await prisma.proposal.update({
    where: { id },
    data,
    include: { opportunity: { include: { customer: true } } }
  });

  await logActivity({ tenantId, userId: req.userId, action: status && status !== record.status ? `STATUS_${status}` : 'UPDATE', entityType: 'PROPOSAL', entityId: id, details: { status: proposal.status, version: proposal.version } });
  res.json(proposal);
}));

router.delete('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.proposal.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.proposal.delete({ where: { id } });
  await logActivity({ tenantId, userId: req.userId, action: 'DELETE', entityType: 'PROPOSAL', entityId: id });
  res.json({ message: 'Teklif silindi.' });
}));

export default router;

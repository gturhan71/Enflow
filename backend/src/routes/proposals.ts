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

  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'PROPOSAL', entityId: proposal.id, details: { opportunityId: proposal.opportunityId, version: proposal.version } });
  res.json(proposal);
}));

router.put('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { content, status } = req.body;
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.proposal.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const data: Record<string, unknown> = {};
  if (content) data.content = typeof content === 'string' ? content : JSON.stringify(content);
  if (status) data.status = status;

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

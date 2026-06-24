import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole, withRetry } from '../middleware';
import { ensureApprovalChain, completeApprovalChain, resetApprovalChain } from '../services/approvalChainService';
import { logActivity } from '../services/activityLog';

const GM = requireRole(['GENERAL_MANAGER']);
const GM_OR_SALES = requireRole(['GENERAL_MANAGER', 'SALES_REP']);
const router: Router = Router();

router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const opps = await prisma.opportunity.findMany({
    where: { tenantId: req.tenantId },
    include: { customer: true, assignedTo: true, createdBy: true, bomItems: true, costItems: true }
  });
  // costConfig JSON string'ini parse ederek nesne olarak gönder
  const parsed = opps.map((o: any) => ({
    ...o,
    costConfig: o.costConfig ? (() => { try { return JSON.parse(o.costConfig); } catch { return undefined; } })() : undefined,
    agentTriage: o.agentTriage ? (() => { try { return JSON.parse(o.agentTriage); } catch { return null; } })() : null,
  }));
  res.json(parsed);
}));

router.post('/', tenantMiddleware, GM_OR_SALES, asyncHandler(async (req: Request, res: Response) => {
  const { title, value, probability, customerId, assignedToId, description, expectedCloseDate, status } = req.body;
  const tenantId = req.tenantId;

  if (!title || !customerId) {
    return res.status(400).json({ error: 'Başlık ve Müşteri seçimi zorunludur.' });
  }

  const firstUser = await prisma.user.findFirst({ where: { tenantId } });
  if (!firstUser) return res.status(400).json({ error: 'Sistemde kayıtlı kullanıcı bulunamadı.' });

  const finalAssignedId = assignedToId || firstUser.id;
  const finalCreatedById = req.body.createdById || firstUser.id;

  const opp = await prisma.opportunity.create({
    data: {
      title,
      value: parseFloat(value as string) || 0,
      probability: parseInt(probability as string) || 0,
      customerId,
      assignedToId: finalAssignedId,
      createdById: finalCreatedById,
      description: description || '',
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
      tenantId,
      status: status || 'NEW'
    },
    include: { customer: true, assignedTo: true, createdBy: true }
  });
  res.json(opp);
}));

router.put('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { title, value, probability, customerId, description, status, lostReason, expectedCloseDate, updatedBy, technicalStatus, costConfig } = req.body;
  const tenantId = req.tenantId;
  const opportunityId = req.params.id as string;

  const oldOpp = await prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId } });
  if (!oldOpp) return res.status(404).json({ error: 'Fırsat bulunamadı.' });

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
  if (value !== undefined) updateData.value = parseFloat(value as string) || 0;
  if (probability !== undefined) updateData.probability = parseInt(probability as string) || 0;
  if (description !== undefined) updateData.description = description;
  if (status !== undefined) updateData.status = status;
  if (lostReason !== undefined) updateData.lostReason = lostReason;
  if (expectedCloseDate !== undefined) updateData.expectedCloseDate = new Date(expectedCloseDate as string);
  if (customerId !== undefined) updateData.customerId = customerId;
  if (technicalStatus !== undefined) updateData.technicalStatus = technicalStatus;
  if (costConfig !== undefined) updateData.costConfig = typeof costConfig === 'string' ? costConfig : JSON.stringify(costConfig);

  const updated = await prisma.opportunity.update({
    where: { id: opportunityId },
    data: updateData,
    include: { customer: true, assignedTo: true, createdBy: true }
  });

  await logActivity({
    tenantId, userId: updatedBy || updated.assignedToId,
    action: 'UPDATE', entityType: 'OPPORTUNITY', entityId: opportunityId,
    details: {
      before: { title: oldOpp.title, value: oldOpp.value, status: oldOpp.status },
      after: { title: updated.title, value: updated.value, status: updated.status },
    },
  });

  // Faz 1 — kaybedilen fırsat otomatik arşivlenir (LOST'a yeni geçiş, tekrar tetiklenmesin)
  if (status === 'LOST' && oldOpp.status !== 'LOST') {
    await prisma.archiveItem.create({
      data: {
        boxNo: 'DİJİTAL',
        shelfNo: 'DİJİTAL',
        category: 'Kaybedilen Fırsat',
        owner: updated.assignedTo?.name || updated.assignedToId,
        description: [
          `Fırsat: ${updated.title}`,
          updated.customer ? `Müşteri: ${updated.customer.name}` : null,
          `Değer: ${updated.value.toLocaleString('tr-TR')}`,
          lostReason ? `Kayıp Nedeni: ${lostReason}` : null,
        ].filter(Boolean).join(' · '),
        tags: JSON.stringify(['opportunity', opportunityId, 'LOST']),
        tenantId,
      },
    });
  }

  res.json(updated);
}));

router.post('/:id/bom', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const opportunityId = req.params.id as string;
  const { items } = req.body;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Geçersiz BoM listesi.' });
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.boMItem.deleteMany({ where: { opportunityId } });

    const created = [];
    for (const item of items) {
      const qty = parseInt(String(item.qty || item.quantity)) || 0;
      const cost = parseFloat(String(item.cost || item.purchaseCost)) || 0;
      const margin = parseFloat(String(item.margin || item.marginPercentage)) || 15;

      const unitSalePrice = item.unitSalePrice !== undefined ? parseFloat(String(item.unitSalePrice)) : undefined;
      const totalSalePrice = item.totalSalePrice !== undefined ? parseFloat(String(item.totalSalePrice)) : undefined;
      const newItem = await tx.boMItem.create({
        data: {
          opportunityId,
          partNumber: String(item.pn || item.partNumber || 'N/A'),
          description: String(item.desc || item.description || ''),
          quantity: qty,
          purchaseCost: cost,
          marginPercentage: margin,
          ...(unitSalePrice !== undefined && { unitSalePrice }),
          ...(totalSalePrice !== undefined && { totalSalePrice }),
          ...(item.currency ? { currency: String(item.currency) } : {}),
          ...(item.source ? { source: String(item.source) } : {}),
          vendor: String(item.vendor || '')
        }
      });
      created.push(newItem);
    }
    return created;
  });

  res.json(result);
}));

router.post('/:id/costs', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const opportunityId = req.params.id as string;
  const tenantId = req.tenantId;
  const { items } = req.body;

  const result = await prisma.$transaction(async (tx) => {
    await tx.costItem.deleteMany({ where: { opportunityId, tenantId } });
    const created = [];
    for (const item of items) {
      const createdItem = await tx.costItem.create({
        data: {
          opportunityId,
          tenantId,
          description: item.description,
          category: item.category,
          amount: parseFloat(String(item.amount)) || 0,
          auto: item.auto === true,
          ...(item.currency ? { currency: String(item.currency) } : {})
        }
      });
      created.push(createdItem);
    }
    return created;
  });
  res.json(result);
}));

router.post('/:id/request-approval', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const opportunityId = req.params.id as string;
  const tenantId = req.tenantId;
  const { note, managerId } = req.body;

  const record = await prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const opp = await prisma.opportunity.update({
    where: { id: opportunityId },
    data: { technicalStatus: 'WAITING_APPROVAL' }
  });

  const managementUnit = await prisma.unit.findFirst({
    where: { tenantId, name: { contains: 'Yönetim' } }
  });

  await prisma.todoTask.create({
    data: {
      title: `Teklif Onayı: ${opp.title}`,
      description: note || 'Teklif incelenip onaylanmayı bekliyor.',
      unitId: managementUnit?.id || 'system',
      assignedBy: opp.assignedToId,
      tenantId,
      relatedModule: 'OPPORTUNITY',
      relatedItemId: opportunityId,
      priority: 'HIGH',
      status: 'PENDING'
    }
  });

  await prisma.workflowLog.create({
    data: {
      fromUnitId: 'u2',
      toUnitId: managementUnit?.id || 'u4',
      assignedBy: opp.assignedToId,
      assignedTo: managerId || 'system',
      note: note || 'Onaya sunuldu.',
      opportunityId,
      status: 'PENDING'
    }
  });

  // Faz 0 — kalıcı onay zinciri: Finans → İGPD → Üst Yönetim (GM) → KSU
  await ensureApprovalChain(tenantId, 'OPPORTUNITY', opportunityId);

  res.json({ message: 'Teklif onay sürecine gönderildi.' });
}));

// ── Maliyet analizi → Satış Müdürü onayı + satış temsilcisine bilgilendirme ───
async function notify(tenantId: string, userId: string | null | undefined, title: string, message: string, type = 'INFO') {
  if (!userId) return;
  await prisma.notification.create({ data: { tenantId, userId, title, message, type } }).catch(() => {});
}

// Maliyet analizi kaydedildikten sonra Satış Müdürü onayına gönder
router.post('/:id/submit-cost-approval', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const opportunityId = String(req.params.id);
  const tenantId = req.tenantId;
  const opp = await prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId } });
  if (!opp) return res.status(404).json({ error: 'Fırsat bulunamadı.' });

  await prisma.opportunity.update({ where: { id: opportunityId }, data: { technicalStatus: 'PENDING_APPROVAL' } });

  const salesMgr = await prisma.user.findFirst({ where: { tenantId, role: 'SALES_MGR' } });
  const salesUnit = salesMgr?.unitId || (await prisma.unit.findFirst({ where: { tenantId, name: { contains: 'Satış' } } }))?.id;

  // Satış Müdürüne onay görevi + bildirim
  if (salesUnit) {
    await prisma.todoTask.create({ data: {
      title: `Maliyet analizi onayı: ${opp.title}`,
      description: 'Maliyet analizi tamamlandı, Satış Müdürü onayı bekleniyor.',
      unitId: salesUnit, assignedBy: opp.assignedToId, tenantId,
      relatedModule: 'OPPORTUNITY', relatedItemId: opportunityId, priority: 'HIGH', status: 'PENDING',
    } }).catch(() => {});
  }
  await notify(tenantId, salesMgr?.id, 'Maliyet onayı bekliyor', `"${opp.title}" maliyet analizi onayınızı bekliyor.`, 'APPROVAL');
  // Fırsat sahibi satış temsilcisine bilgilendirme
  await notify(tenantId, opp.assignedToId, 'Maliyet analizi onaya gönderildi', `"${opp.title}" maliyet analiziniz Satış Müdürü onayına gönderildi.`, 'INFO');

  await logActivity({ tenantId, userId: req.userId, action: 'SUBMIT_COST_APPROVAL', entityType: 'OPPORTUNITY', entityId: opportunityId, details: { title: opp.title } });
  res.json({ ok: true, technicalStatus: 'PENDING_APPROVAL', approverId: salesMgr?.id ?? null });
}));

// Satış Müdürü maliyet analizini onaylar / reddeder
router.post('/:id/approve-cost', tenantMiddleware, requireRole(['GENERAL_MANAGER', 'SALES_MGR']), asyncHandler(async (req: Request, res: Response) => {
  const opportunityId = String(req.params.id);
  const tenantId = req.tenantId;
  const { decision, note } = req.body as { decision?: string; note?: string };
  if (decision !== 'APPROVE' && decision !== 'REJECT') return res.status(400).json({ error: 'decision APPROVE veya REJECT olmalı.' });

  const opp = await prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId } });
  if (!opp) return res.status(404).json({ error: 'Fırsat bulunamadı.' });
  if (opp.technicalStatus !== 'PENDING_APPROVAL') return res.status(409).json({ error: 'Yalnız onay bekleyen analiz onaylanabilir.' });

  const newStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  await prisma.opportunity.update({ where: { id: opportunityId }, data: { technicalStatus: newStatus } });

  // İlgili onay görevini kapat
  await prisma.todoTask.updateMany({
    where: { tenantId, relatedModule: 'OPPORTUNITY', relatedItemId: opportunityId, title: { startsWith: 'Maliyet analizi onayı' }, status: 'PENDING' },
    data: { status: 'COMPLETED' },
  }).catch(() => {});

  // Fırsat sahibi satış temsilcisine sonuç bildirimi
  const msg = decision === 'APPROVE'
    ? `"${opp.title}" maliyet analizi onaylandı. Teklif hazırlayabilirsiniz.${note ? ' Not: ' + note : ''}`
    : `"${opp.title}" maliyet analizi reddedildi.${note ? ' Not: ' + note : ''} Lütfen revize edin.`;
  await notify(tenantId, opp.assignedToId, decision === 'APPROVE' ? 'Maliyet analizi onaylandı' : 'Maliyet analizi reddedildi', msg, decision === 'APPROVE' ? 'SUCCESS' : 'WARNING');

  await logActivity({ tenantId, userId: req.userId, action: decision === 'APPROVE' ? 'APPROVE_COST' : 'REJECT_COST', entityType: 'OPPORTUNITY', entityId: opportunityId, details: { title: opp.title, note } });
  res.json({ ok: true, technicalStatus: newStatus });
}));

router.post('/:id/approve', tenantMiddleware, GM, asyncHandler(async (req: Request, res: Response) => {
  const opportunityId = req.params.id as string;
  const tenantId = req.tenantId;
  const { note } = req.body;

  const record = await prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const updated = await prisma.opportunity.update({
    where: { id: opportunityId },
    data: { technicalStatus: 'APPROVED', status: 'PROPOSAL' }
  });

  await prisma.workflowLog.updateMany({
    where: { opportunityId, status: 'PENDING' },
    data: { status: 'APPROVED', note: note || 'Onaylandı.' }
  });

  // Faz 0 — kalıcı zincirin tüm aşamalarını tamamlanmış işaretle (tek-tık GM onayı geriye uyumlu)
  await completeApprovalChain(tenantId, 'OPPORTUNITY', opportunityId, req.userId, note || 'Onaylandı.');

  res.json(updated);
}));

router.post('/:id/revert-approval', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const opportunityId = req.params.id as string;
  const tenantId = req.tenantId;

  const updated = await prisma.opportunity.update({
    where: { id: opportunityId },
    data: { technicalStatus: 'PENDING' }
  });

  // Faz 0 — kalıcı onay zincirini de geri al
  await resetApprovalChain(tenantId, 'OPPORTUNITY', opportunityId);

  await logActivity({
    tenantId, userId: req.userId,
    action: 'REVERT_APPROVAL', entityType: 'OPPORTUNITY', entityId: opportunityId,
    details: { message: 'Teknik onay kullanıcı tarafından geri çekildi.' },
  });

  res.json(updated);
}));

export default router;

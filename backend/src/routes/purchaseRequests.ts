import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { logActivity } from '../services/activityLog';

const router: Router = Router();
router.use(tenantMiddleware);

// ── LIST ──────────────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { status, sourceType } = req.query;
  const requests = await prisma.purchaseRequest.findMany({
    where: {
      tenantId: req.tenantId,
      ...(status ? { status: String(status) } : {}),
      ...(sourceType ? { sourceType: String(sourceType) } : {}),
    },
    include: {
      items: true,
      quotes: { include: { vendor: true } },
      deliveries: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(requests);
}));

// ── GET ONE ───────────────────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const pr = await prisma.purchaseRequest.findFirst({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    include: {
      items: true,
      quotes: { include: { vendor: true }, orderBy: { totalAmountTRY: 'asc' } },
      deliveries: { orderBy: { deliveredAt: 'desc' } },
    },
  });
  if (!pr) return res.status(404).json({ error: 'Satınalma talebi bulunamadı.' });
  res.json(pr);
}));

// ── CREATE ────────────────────────────────────────────────────────────────
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const {
    title, description, sourceType, sourceBomId, projectId,
    requestedBy, requestedByName, unitId, unitName,
    urgency, neededBy, budgetAmount, currency, budgetAmountTRY, notes,
    items = [],
  } = req.body;

  if (!title) return res.status(400).json({ error: 'Başlık zorunludur.' });

  const pr = await prisma.purchaseRequest.create({
    data: {
      tenantId: req.tenantId,
      title,
      description: description || null,
      sourceType: sourceType || 'MANUAL',
      sourceBomId: sourceBomId || null,
      projectId: projectId || null,
      requestedBy: requestedBy || req.userId,
      requestedByName: requestedByName || null,
      unitId: unitId || null,
      unitName: unitName || null,
      urgency: urgency || 'NORMAL',
      neededBy: neededBy ? new Date(neededBy) : null,
      budgetAmount: budgetAmount || null,
      currency: currency || 'TRY',
      budgetAmountTRY: budgetAmountTRY || budgetAmount || null,
      notes: notes || null,
      items: items.length ? {
        create: items.map((item: {
          name: string; description?: string; quantity: number;
          unit?: string; estimatedUnitPrice?: number; currency?: string;
          refVendor?: string; refSource?: string;
        }) => ({
          name: item.name,
          description: item.description || null,
          quantity: item.quantity,
          unit: item.unit || 'adet',
          estimatedUnitPrice: item.estimatedUnitPrice || null,
          currency: item.currency || currency || 'TRY',
          refVendor: item.refVendor || null,
          refSource: item.refSource || null,
        })),
      } : undefined,
    },
    include: { items: true, quotes: true, deliveries: true },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'CREATE', entityType: 'PURCHASE_REQUEST', entityId: pr.id, details: { title: pr.title, projectId: pr.projectId } });
  res.status(201).json(pr);
}));

// ── UPDATE ────────────────────────────────────────────────────────────────
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const {
    title, description, urgency, neededBy,
    budgetAmount, currency, budgetAmountTRY, notes,
    projectId, unitId, unitName,
  } = req.body;
  const pr = await prisma.purchaseRequest.update({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    data: {
      title, description, urgency,
      neededBy: neededBy ? new Date(neededBy) : undefined,
      budgetAmount: budgetAmount ?? null,
      currency: currency || undefined,
      budgetAmountTRY: budgetAmountTRY ?? null,
      notes: notes ?? null,
      projectId: projectId ?? null,
      unitId: unitId ?? null,
      unitName: unitName ?? null,
    },
    include: { items: true, quotes: true, deliveries: true },
  });
  res.json(pr);
}));

// ── DELETE ────────────────────────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  await prisma.purchaseRequest.delete({
    where: { id: String(req.params.id), tenantId: req.tenantId },
  });
  res.json({ ok: true });
}));

// ── ONAY / RET ────────────────────────────────────────────────────────────
router.post('/:id/approve', asyncHandler(async (req: Request, res: Response) => {
  const { approverRole, approverId } = req.body;
  const pr = await prisma.purchaseRequest.findFirst({
    where: { id: String(req.params.id), tenantId: req.tenantId },
  });
  if (!pr) return res.status(404).json({ error: 'Bulunamadı.' });

  const nextStatus: Record<string, string> = {
    DRAFT: 'PENDING_UNIT',
    PENDING_UNIT: 'PENDING_PROCUREMENT',
    PENDING_PROCUREMENT: 'PENDING_GM',
    PENDING_GM: 'PO_ISSUED',
  };

  const fieldMap: Record<string, string> = {
    PENDING_UNIT: 'approvedByUnit',
    PENDING_PROCUREMENT: 'approvedByProcurement',
    PENDING_GM: 'approvedByGM',
  };

  const next = nextStatus[pr.status];
  if (!next) return res.status(400).json({ error: `${pr.status} durumundan onay verilemez.` });

  const updateData: Record<string, unknown> = { status: next };
  if (fieldMap[pr.status]) updateData[fieldMap[pr.status]] = approverId || req.userId;
  if (next === 'PO_ISSUED') {
    const year = new Date().getFullYear();
    const count = await prisma.purchaseRequest.count({ where: { tenantId: req.tenantId } });
    updateData.poNumber = `PO-${year}-${String(count).padStart(4, '0')}`;
    updateData.poIssuedAt = new Date();
  }

  const updated = await prisma.purchaseRequest.update({
    where: { id: String(req.params.id) },
    data: updateData,
    include: { items: true, quotes: true, deliveries: true },
  });

  // PO kesilince maliyet kalemi oluştur
  if (next === 'PO_ISSUED') {
    const selected = await prisma.purchaseQuote.findFirst({
      where: { purchaseRequestId: pr.id, isSelected: true },
    });
    const amount = selected?.totalAmountTRY ?? pr.budgetAmountTRY ?? 0;
    if (pr.projectId) {
      // Proje → Satınalma: doğru model ProjectCostItem (idempotent: purchaseRequestId)
      const data = {
        category: 'PROCUREMENT',
        description: `PO: ${pr.title} (${updated.poNumber ?? ''})`,
        actualAmount: amount,
        amountTRY: amount,
        currency: pr.currency,
        purchaseRequestId: pr.id,
      };
      const existing = await prisma.projectCostItem.findFirst({
        where: { projectId: pr.projectId, purchaseRequestId: pr.id },
      });
      if (existing) {
        await prisma.projectCostItem.update({ where: { id: existing.id }, data }).catch(() => {});
      } else {
        await prisma.projectCostItem.create({
          data: { projectId: pr.projectId, createdById: req.userId, ...data },
        }).catch(() => {});
      }
    } else if (pr.sourceBomId) {
      // BoM kaynaklı satınalma → opportunity CostItem (mevcut davranış korunur)
      await prisma.costItem.create({
        data: {
          tenantId: req.tenantId,
          description: `PO: ${pr.title} (${updated.poNumber ?? ''})`,
          category: 'OTHER',
          amount,
          currency: pr.currency,
          opportunityId: pr.sourceBomId,
        },
      }).catch(() => {});
    }
  }

  // TodoTask oluştur
  if (next === 'PENDING_UNIT') {
    await prisma.todoTask.create({
      data: {
        tenantId: req.tenantId,
        title: `Satınalma Onayı: ${pr.title}`,
        description: 'Birim yöneticisi onayı bekliyor.',
        status: 'PENDING',
        priority: pr.urgency === 'URGENT' ? 'HIGH' : 'MEDIUM',
        relatedModule: 'PROCUREMENT',
        relatedItemId: pr.id,
        unitId: pr.unitId ?? req.tenantId,
        assignedBy: req.userId,
        dueDate: pr.neededBy ?? null,
      },
    }).catch(() => {});
  }

  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: `STATUS_${next}`, entityType: 'PURCHASE_REQUEST', entityId: String(req.params.id), details: { title: updated.title, status: updated.status } });
  res.json(updated);
}));

router.post('/:id/reject', asyncHandler(async (req: Request, res: Response) => {
  const { rejectedBy, rejectionNote } = req.body;
  const updated = await prisma.purchaseRequest.update({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    data: {
      status: 'REJECTED',
      rejectedBy: rejectedBy || req.userId,
      rejectionNote: rejectionNote || null,
    },
    include: { items: true, quotes: true, deliveries: true },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'STATUS_REJECTED', entityType: 'PURCHASE_REQUEST', entityId: String(req.params.id), details: { rejectionNote: rejectionNote || null } });
  res.json(updated);
}));

// B-04 — reddedilen talebi revize edip yeniden onaya sunma: yeni kayıt açmaya
// gerek kalmaz, BoM/Proje bağlantısı (sourceBomId/projectId) ve tüm geçmiş
// (ActivityLog aynı entityId altında) korunur. Onay alanları sıfırlanır —
// süreç baştan (PENDING_UNIT) işler.
router.post('/:id/resubmit', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const pr = await prisma.purchaseRequest.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!pr) return res.status(404).json({ error: 'Satınalma talebi bulunamadı.' });
  if (pr.status !== 'REJECTED') return res.status(409).json({ error: 'Yalnız reddedilmiş talepler yeniden gönderilebilir.' });

  const { notes } = req.body as { notes?: string };
  const updated = await prisma.purchaseRequest.update({
    where: { id },
    data: {
      status: 'DRAFT',
      rejectedBy: null,
      rejectionNote: null,
      approvedByUnit: null, approvedByProcurement: null, approvedByGM: null,
      resubmitCount: { increment: 1 },
      ...(notes !== undefined && { notes }),
    },
    include: { items: true, quotes: true, deliveries: true },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'RESUBMIT', entityType: 'PURCHASE_REQUEST', entityId: id, details: { previousRejectionNote: pr.rejectionNote, resubmitCount: updated.resubmitCount } });
  res.json(updated);
}));

// ── ITEMS ─────────────────────────────────────────────────────────────────
router.post('/:id/items', asyncHandler(async (req: Request, res: Response) => {
  const { name, description, quantity, unit, estimatedUnitPrice, currency } = req.body;
  const item = await prisma.purchaseItem.create({
    data: {
      purchaseRequestId: String(req.params.id),
      name,
      description: description || null,
      quantity: Number(quantity),
      unit: unit || 'adet',
      estimatedUnitPrice: estimatedUnitPrice || null,
      currency: currency || 'TRY',
    },
  });
  res.status(201).json(item);
}));

router.delete('/:id/items/:itemId', asyncHandler(async (req: Request, res: Response) => {
  const del = await prisma.purchaseItem.deleteMany({ where: { id: String(req.params.itemId), purchaseRequest: { tenantId: req.tenantId } } });
  if (del.count === 0) return res.status(404).json({ error: 'Kalem bulunamadı.' });
  res.json({ ok: true });
}));

// ── QUOTES ────────────────────────────────────────────────────────────────
router.post('/:id/quotes', asyncHandler(async (req: Request, res: Response) => {
  const owns = await prisma.purchaseRequest.findFirst({ where: { id: String(req.params.id), tenantId: req.tenantId }, select: { id: true } });
  if (!owns) return res.status(404).json({ error: 'Satınalma talebi bulunamadı.' });
  const { vendorId, vendorName, totalAmount, currency, totalAmountTRY, deliveryDays, validUntil, notes } = req.body;
  const quote = await prisma.purchaseQuote.create({
    data: {
      purchaseRequestId: String(req.params.id),
      vendorId: vendorId || null,
      vendorName: vendorName || 'Bilinmeyen',
      totalAmount: Number(totalAmount),
      currency: currency || 'TRY',
      totalAmountTRY: totalAmountTRY ? Number(totalAmountTRY) : Number(totalAmount),
      deliveryDays: deliveryDays ? Number(deliveryDays) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      notes: notes || null,
    },
    include: { vendor: true },
  });
  res.status(201).json(quote);
}));

router.put('/:id/quotes/:qid', asyncHandler(async (req: Request, res: Response) => {
  const { vendorName, totalAmount, currency, totalAmountTRY, deliveryDays, validUntil, notes } = req.body;
  const upd = await prisma.purchaseQuote.updateMany({
    where: { id: String(req.params.qid), purchaseRequest: { tenantId: req.tenantId } },
    data: {
      vendorName, totalAmount: Number(totalAmount), currency,
      totalAmountTRY: totalAmountTRY ? Number(totalAmountTRY) : Number(totalAmount),
      deliveryDays: deliveryDays ? Number(deliveryDays) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      notes: notes || null,
    },
  });
  if (upd.count === 0) return res.status(404).json({ error: 'Teklif bulunamadı.' });
  res.json(await prisma.purchaseQuote.findFirst({ where: { id: String(req.params.qid), purchaseRequest: { tenantId: req.tenantId } }, include: { vendor: true } }));
}));

router.delete('/:id/quotes/:qid', asyncHandler(async (req: Request, res: Response) => {
  const del = await prisma.purchaseQuote.deleteMany({ where: { id: String(req.params.qid), purchaseRequest: { tenantId: req.tenantId } } });
  if (del.count === 0) return res.status(404).json({ error: 'Teklif bulunamadı.' });
  res.json({ ok: true });
}));

router.post('/:id/quotes/:qid/select', asyncHandler(async (req: Request, res: Response) => {
  const prId = String(req.params.id);
  const qid = String(req.params.qid);
  // Tüm tekliflerin seçimini kaldır
  await prisma.purchaseQuote.updateMany({ where: { purchaseRequestId: prId }, data: { isSelected: false } });
  const selected = await prisma.purchaseQuote.update({
    where: { id: qid },
    data: { isSelected: true },
    include: { vendor: true },
  });
  // Satınalma talebine seçilen tedarikçiyi kaydet
  await prisma.purchaseRequest.update({
    where: { id: prId },
    data: { selectedVendorId: selected.vendorId, selectedVendorName: selected.vendorName },
  });
  res.json(selected);
}));

// ── DELIVERY ──────────────────────────────────────────────────────────────
// B-13 — PR üst statüsü tek bir teslimat kaydının kendi `status`'una göre değil,
// TÜM teslimatların kümülatif teslim-alınan miktarına göre ilerler (çoklu kısmi
// teslimat toplamı sipariş miktarına ulaşınca INVOICED'a geçer; ulaşmazsa
// IN_DELIVERY'de kalır — son kayıt kendi başına 'RECEIVED' dese bile).
router.post('/:id/delivery', asyncHandler(async (req: Request, res: Response) => {
  const prId = String(req.params.id);
  const { deliveredAt, receivedBy, quantityOrdered, quantityReceived, quantityDamaged, status, notes } = req.body;

  const delivery = await prisma.deliveryRecord.create({
    data: {
      purchaseRequestId: prId,
      deliveredAt: deliveredAt ? new Date(deliveredAt) : new Date(),
      receivedBy: receivedBy || null,
      quantityOrdered: quantityOrdered ? Number(quantityOrdered) : null,
      quantityReceived: quantityReceived ? Number(quantityReceived) : null,
      quantityDamaged: quantityDamaged ? Number(quantityDamaged) : null,
      status: status || 'RECEIVED',
      notes: notes || null,
    },
  });

  const pr = await prisma.purchaseRequest.findFirst({ where: { id: prId, tenantId: req.tenantId }, include: { items: true, deliveries: true } });
  if (pr) {
    const totalOrdered = pr.items.reduce((s, i) => s + (i.quantity || 0), 0);
    const cumulativeReceived = pr.deliveries.reduce((s, d) => s + (d.quantityReceived || 0), 0);
    const fullyReceived = totalOrdered > 0 && cumulativeReceived >= totalOrdered;
    await prisma.purchaseRequest.update({
      where: { id: prId },
      // totalOrdered bilinmiyorsa (eski/eksik veri) geriye dönük uyumluluk için kaydın kendi statüsüne güven.
      data: { status: totalOrdered > 0 ? (fullyReceived ? 'INVOICED' : 'IN_DELIVERY') : (status === 'RECEIVED' ? 'INVOICED' : 'IN_DELIVERY') },
    });

    // B-13 — hasar/iade alt-akışı: hasarlı teslimat, kümülatif ilerlemeyi bloklamaz
    // (hasarsız kısım yine sayılır) ama Satınalma birimine ayrı bir takip görevi açar.
    if ((status === 'DAMAGED' || (quantityDamaged && Number(quantityDamaged) > 0))) {
      const procurementUnit = await prisma.unit.findFirst({ where: { tenantId: req.tenantId, name: { contains: 'Satın Alma' } } });
      await prisma.todoTask.create({
        data: {
          title: `Hasarlı teslimat — iade/tekrar sipariş: ${pr.title}`,
          description: `Teslimat kaydında hasar bildirildi (${quantityDamaged ? Number(quantityDamaged).toLocaleString('tr-TR') : '?'} adet). Tedarikçiyle iade/tekrar sipariş süreci başlatılmalı.`,
          unitId: procurementUnit?.id || pr.unitId || 'system',
          assignedBy: req.userId || 'system',
          tenantId: req.tenantId,
          relatedModule: 'PROCUREMENT', relatedItemId: prId, priority: 'HIGH', status: 'PENDING',
        },
      }).catch(() => {});
    }
  }

  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'DELIVERY_RECORD', entityType: 'PURCHASE_REQUEST', entityId: prId, details: { status: delivery.status, quantityReceived: delivery.quantityReceived, quantityDamaged: delivery.quantityDamaged } });
  res.status(201).json(delivery);
}));

// ── INVOICE ───────────────────────────────────────────────────────────────
router.post('/:id/invoice', asyncHandler(async (req: Request, res: Response) => {
  const { invoiceNo, invoiceAmount, invoiceDate, invoicePaidAt } = req.body;
  const updated = await prisma.purchaseRequest.update({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    data: {
      invoiceNo: invoiceNo || null,
      invoiceAmount: invoiceAmount ? Number(invoiceAmount) : null,
      invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
      invoicePaidAt: invoicePaidAt ? new Date(invoicePaidAt) : null,
      status: invoicePaidAt ? 'CLOSED' : 'INVOICED',
    },
    include: { items: true, quotes: true, deliveries: true },
  });

  // Satınalma faturası → Finans Invoice (type=PURCHASE). Idempotent: purchaseRequestId ile upsert.
  if (invoiceAmount || invoiceNo) {
    const selectedQuote = updated.quotes.find(q => q.isSelected);
    const amount = invoiceAmount ? Number(invoiceAmount) : 0;
    const paid = !!invoicePaidAt;
    const invData = {
      type: 'PURCHASE',
      invoiceNo: invoiceNo || null,
      amount,
      issueDate: invoiceDate ? new Date(invoiceDate) : null,
      projectId: updated.projectId || null,
      vendorName: selectedQuote?.vendorName || null,
      status: paid ? 'PAID' : 'ISSUED',
      paidAmount: paid ? amount : 0,
      paidAt: paid ? new Date(invoicePaidAt) : null,
      notes: `Satınalma talebinden: ${updated.title}`,
    };
    const existingInv = await prisma.invoice.findFirst({
      where: { purchaseRequestId: updated.id, tenantId: req.tenantId },
    });
    if (existingInv) {
      await prisma.invoice.update({ where: { id: existingInv.id }, data: invData });
    } else {
      await prisma.invoice.create({
        data: { tenantId: req.tenantId, purchaseRequestId: updated.id, ...invData },
      });
    }
  }

  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: `STATUS_${updated.status}`, entityType: 'PURCHASE_REQUEST', entityId: String(req.params.id), details: { invoiceNo: invoiceNo || null, invoiceAmount: invoiceAmount ?? null } });
  res.json(updated);
}));

// ── CLOSE ─────────────────────────────────────────────────────────────────
router.post('/:id/close', asyncHandler(async (req: Request, res: Response) => {
  const updated = await prisma.purchaseRequest.update({
    where: { id: String(req.params.id), tenantId: req.tenantId },
    data: { status: 'CLOSED' },
    include: { items: true, quotes: true, deliveries: true },
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'STATUS_CLOSED', entityType: 'PURCHASE_REQUEST', entityId: String(req.params.id) });
  res.json(updated);
}));

export default router;

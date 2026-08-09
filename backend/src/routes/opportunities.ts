import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, requireRole, withRetry } from '../middleware';
import { ensureApprovalChain, completeApprovalChain, resetApprovalChain } from '../services/approvalChainService';
import { sodViolation } from '../services/governance';
import { logActivity } from '../services/activityLog';
import { computeSalesCosting, getSalesMarginFloor, SalesBoMItemInput, SalesManualCostItemInput, SalesCostConfig } from '../services/salesCosting';
import { buildBomEvaluationSnapshot, sumBomTotalsByCurrency } from '../services/bomHandoff';
import { sweepOpportunityProgressReminders } from '../services/opportunityProgressReminders';
import { recordProgressCheckIn, logAutoProgressChange, ProgressCheckInError } from '../services/opportunityProgressService';

const GM = requireRole(['GENERAL_MANAGER']);
const GM_OR_SALES = requireRole(['GENERAL_MANAGER', 'SALES_REP']);
const router: Router = Router();

router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  await sweepOpportunityProgressReminders(req.tenantId); // ilerleme teyidi zaman-eşiği hatırlatmaları (non-throwing)
  const opps = await prisma.opportunity.findMany({
    where: { tenantId: req.tenantId },
    include: { customer: true, assignedTo: true, createdBy: true, bomItems: { include: { brand: true, category: true } }, costItems: true }
  });
  // costConfig JSON string'ini parse ederek nesne olarak gönder
  const parsed = opps.map((o) => ({
    ...o,
    costConfig: o.costConfig ? (() => { try { return JSON.parse(o.costConfig); } catch { return undefined; } })() : undefined,
    agentTriage: o.agentTriage ? (() => { try { return JSON.parse(o.agentTriage); } catch { return null; } })() : null,
  }));
  res.json(parsed);
}));

const METHOD_LABELS: Record<string, string> = {
  OPEN: 'Açık İhale', RESTRICTED: 'Belli İstekliler Arası', NEGOTIATED: 'Pazarlık Usulü İhale',
  DIRECT: 'Doğrudan Temin', PRIVATE: 'Özel/Ticari Teklif',
};

router.post('/', tenantMiddleware, GM_OR_SALES, asyncHandler(async (req: Request, res: Response) => {
  const { title, value, probability, customerId, assignedToId, description, expectedCloseDate, status, procurementMethod, targetBidDate } = req.body;
  const tenantId = req.tenantId;

  if (!title || !customerId) {
    return res.status(400).json({ error: 'Başlık ve Müşteri seçimi zorunludur.' });
  }
  if (status !== undefined && !OPPORTUNITY_STATUSES.has(status)) {
    return res.status(400).json({ error: `Geçersiz status: '${status}'. İzinli değerler: ${[...OPPORTUNITY_STATUSES].join(', ')}` });
  }

  const firstUser = await prisma.user.findFirst({ where: { tenantId } });
  if (!firstUser) return res.status(400).json({ error: 'Sistemde kayıtlı kullanıcı bulunamadı.' });

  const finalAssignedId = assignedToId || firstUser.id;
  const finalCreatedById = req.body.createdById || firstUser.id;
  const bidDate = targetBidDate ? new Date(targetBidDate) : null;

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
      procurementMethod: procurementMethod || null,
      targetBidDate: bidDate,
      tenantId,
      status: status || 'NEW'
    },
    include: { customer: true, assignedTo: true, createdBy: true }
  });

  // Satınalma usulü seçildiyse: Satış Destek için otomatik İhale/dosya takibi + uyarı (her usulde)
  if (procurementMethod) {
    const owner = await prisma.user.findFirst({ where: { id: finalAssignedId } });
    const tender = await prisma.tender.create({
      data: {
        tenantId, name: title, method: procurementMethod, status: 'DRAFT',
        submissionDeadline: bidDate, estimatedValue: parseFloat(value as string) || 0,
        currency: 'TRY', opportunityId: opp.id, ownerId: finalAssignedId, ownerName: owner?.name || null,
      },
    }).catch(() => null);

    const salesSupport = await prisma.user.findFirst({ where: { tenantId, role: 'SALES_SUPPORT' } });
    const label = METHOD_LABELS[procurementMethod] || procurementMethod;
    const dateStr = bidDate ? bidDate.toLocaleDateString('tr-TR') : 'belirtilmedi';
    await notify(tenantId, salesSupport?.id, 'Yeni fırsat takibi', `"${title}" — usul: ${label}, son teklif: ${dateStr}. İhale/dosya hazırlığını başlatın.`, 'INFO');
    if (salesSupport?.unitId || tender) {
      await prisma.todoTask.create({ data: {
        title: `İhale dosyası: ${title}`,
        description: `Fırsat ${label} usulüyle teklife dönüşecek (son teklif: ${dateStr}). Dosya hazırlığını teklifle paralel yürütün.`,
        unitId: salesSupport?.unitId || 'unit_sales_support', assignedBy: finalCreatedById, tenantId,
        relatedModule: 'OPPORTUNITY', relatedItemId: opp.id, priority: 'HIGH', status: 'PENDING',
        ...(bidDate ? { dueDate: bidDate } : {}),
      } }).catch(() => {});
    }
    await logActivity({ tenantId, userId: finalCreatedById, action: 'TENDER_TRIGGERED', entityType: 'OPPORTUNITY', entityId: opp.id, details: { method: procurementMethod, tenderId: tender?.id ?? null } });
  }

  res.json(opp);
}));

// B-17 — status serbest string (enum değil, DB kısıtı yok); frontend'in kendi
// tipiyle (types.ts Opportunity.status) birebir aynı izinli-değer listesi.
const OPPORTUNITY_STATUSES = new Set(['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST', 'WITHDRAWN']);

router.put('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { title, value, probability, customerId, description, status, lostReason, expectedCloseDate, updatedBy, technicalStatus, costConfig, procurementMethod, targetBidDate } = req.body;
  const tenantId = req.tenantId;
  const opportunityId = req.params.id as string;

  if (status !== undefined && !OPPORTUNITY_STATUSES.has(status)) {
    return res.status(400).json({ error: `Geçersiz status: '${status}'. İzinli değerler: ${[...OPPORTUNITY_STATUSES].join(', ')}` });
  }

  const oldOpp = await prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId } });
  if (!oldOpp) return res.status(404).json({ error: 'Fırsat bulunamadı.' });

  const updateData: Record<string, unknown> = {};
  if (title !== undefined) updateData.title = title;
  if (value !== undefined) updateData.value = parseFloat(value as string) || 0;
  if (probability !== undefined) updateData.probability = parseInt(probability as string) || 0;
  if (description !== undefined) updateData.description = description;
  if (status !== undefined) updateData.status = status;
  if (lostReason !== undefined) updateData.lostReason = lostReason;
  if (expectedCloseDate !== undefined) updateData.expectedCloseDate = expectedCloseDate ? new Date(expectedCloseDate as string) : null;
  if (customerId !== undefined) updateData.customerId = customerId;
  if (technicalStatus !== undefined) updateData.technicalStatus = technicalStatus;
  if (costConfig !== undefined) updateData.costConfig = typeof costConfig === 'string' ? costConfig : JSON.stringify(costConfig);
  if (procurementMethod !== undefined) updateData.procurementMethod = procurementMethod || null;
  if (targetBidDate !== undefined) updateData.targetBidDate = targetBidDate ? new Date(targetBidDate as string) : null;

  const updated = await prisma.opportunity.update({
    where: { id: opportunityId },
    data: updateData,
    include: { customer: true, assignedTo: true, createdBy: true }
  });

  // Usul/son-teklif tarihi değiştiyse bağlı Tender'ı senkronla (varsa)
  if (procurementMethod !== undefined || targetBidDate !== undefined) {
    const linked = await prisma.tender.findFirst({ where: { tenantId, opportunityId } });
    if (linked) {
      await prisma.tender.update({ where: { id: linked.id }, data: {
        ...(procurementMethod !== undefined ? { method: procurementMethod || 'OPEN' } : {}),
        ...(targetBidDate !== undefined ? { submissionDeadline: targetBidDate ? new Date(targetBidDate as string) : null, remindersSent: null } : {}),
      } }).catch(() => {});
    }
  }

  await logActivity({
    tenantId, userId: updatedBy || updated.assignedToId,
    action: 'UPDATE', entityType: 'OPPORTUNITY', entityId: opportunityId,
    details: {
      before: { title: oldOpp.title, value: oldOpp.value, status: oldOpp.status },
      after: { title: updated.title, value: updated.value, status: updated.status },
    },
  });

  // Fırsat ilerleme takibi — probability/status fiilen değiştiyse otomatik izle
  // (kullanıcı zaten normal düzenlemeyle ilerleme kaydettiyse ayrıca "teyit et" istemiyoruz).
  if (updated.probability !== oldOpp.probability || updated.status !== oldOpp.status) {
    await logAutoProgressChange(
      tenantId, opportunityId, updatedBy || updated.assignedToId,
      { probability: oldOpp.probability, status: oldOpp.status },
      { probability: updated.probability, status: updated.status },
    ).catch(() => {});
    // finalizeCheckIn DB'de lastProgressCheckAt/progressRemindersSent'i sıfırladı —
    // yanıt nesnesi (`updated`) o update'ten ÖNCE alındığı için burada senkronla.
    updated.lastProgressCheckAt = new Date();
    updated.progressRemindersSent = null;
  }

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
  const tenantId = req.tenantId;
  const { items, handoff } = req.body;

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
          lineKey: item.lineKey ? String(item.lineKey) : undefined,
          partNumber: String(item.pn || item.partNumber || 'N/A'),
          description: String(item.desc || item.description || ''),
          quantity: qty,
          purchaseCost: cost,
          marginPercentage: margin,
          ...(unitSalePrice !== undefined && { unitSalePrice }),
          ...(totalSalePrice !== undefined && { totalSalePrice }),
          ...(item.currency ? { currency: String(item.currency) } : {}),
          ...(item.vatRate !== undefined ? { vatRate: parseFloat(String(item.vatRate)) || 0 } : {}),
          ...(item.source ? { source: String(item.source) } : {}),
          vendor: String(item.vendor || ''),
          ...(item.brandId ? { brandId: String(item.brandId) } : {}),
          ...(item.categoryId ? { categoryId: String(item.categoryId) } : {}),
        }
      });
      created.push(newItem);
    }
    return created;
  });

  // Presales BoM'u Satış'a devrediyor (handoff). BoM zaten maliyet-analizinden geçmişse
  // (APPROVED/PENDING_APPROVAL), revizyon yeni bir tur gerektirir → durumu sıfırla + sat. temsilcisini uyar.
  if (handoff) {
    const opp = await prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId }, include: { customer: true } });
    if (opp && (opp.technicalStatus === 'APPROVED' || opp.technicalStatus === 'PENDING_APPROVAL')) {
      await prisma.opportunity.update({ where: { id: opportunityId }, data: { technicalStatus: 'PENDING' } });
      await notify(tenantId, opp.assignedToId, 'BoM revize edildi', `"${opp.title}" için BoM güncellendi. Maliyet analizini yenileyip yeniden onaya gönderin.`, 'WARNING');
      await logActivity({ tenantId, userId: req.userId, action: 'BOM_REVISED_RESET', entityType: 'OPPORTUNITY', entityId: opportunityId, details: { title: opp.title, prevStatus: opp.technicalStatus } });
    }

    // Tedarikçi teklif değerlendirme snapshot'ı → teklif detayı/rapor + arşiv (değişmez kayıt)
    const quotes = await prisma.boMLineQuote.findMany({ where: { tenantId, opportunityId } });
    const evalSnapshot = buildBomEvaluationSnapshot(quotes);
    if (quotes.length > 0) {
      const byLine = new Map<string, typeof quotes>();
      for (const q of quotes) { const arr = byLine.get(q.lineKey) || []; arr.push(q); byLine.set(q.lineKey, arr); }
      await prisma.opportunity.update({ where: { id: opportunityId }, data: { bomEvaluation: JSON.stringify(evalSnapshot) } }).catch(() => {});
      await prisma.archiveItem.create({
        data: {
          tenantId, boxNo: 'DIGITAL', shelfNo: 'BOM-EVAL', category: 'BOM_EVALUATION',
          description: `BoM tedarikçi teklif değerlendirmesi — ${opp?.title ?? opportunityId} (${quotes.length} teklif, ${byLine.size} kalem)`,
          owner: req.userId || 'system', status: 'IN_ARCHIVE',
          tags: JSON.stringify(['bom-evaluation', opportunityId]),
        },
      }).catch(() => {});
      await logActivity({ tenantId, userId: req.userId, action: 'BOM_EVALUATION_ARCHIVED', entityType: 'OPPORTUNITY', entityId: opportunityId, details: { quotes: quotes.length, lines: byLine.size } });
    }

    // Devir kaydı (fırsat-bazlı upsert): KPI + Presales yönetici liste/detay
    const totalsByCurrency = sumBomTotalsByCurrency(result);
    const handoffSnapshot = {
      items: result.map(b => ({ partNumber: b.partNumber, description: b.description, quantity: b.quantity, purchaseCost: b.purchaseCost, currency: b.currency || 'TRY', vendor: b.vendor || null })),
      evaluation: evalSnapshot,
    };
    const handoffUser = req.userId ? await prisma.user.findFirst({ where: { id: req.userId }, select: { name: true } }) : null;
    const now = new Date();
    await prisma.bomHandoff.upsert({
      where: { tenantId_opportunityId: { tenantId, opportunityId } },
      create: {
        tenantId, opportunityId, oppTitle: opp?.title || opportunityId, customerName: opp?.customer?.name || null,
        handedOffById: req.userId || null, handedOffByName: handoffUser?.name || null,
        handoffCount: 1, itemCount: result.length, totalsByCurrency: JSON.stringify(totalsByCurrency),
        snapshot: JSON.stringify(handoffSnapshot), lastHandoffAt: now,
      },
      update: {
        oppTitle: opp?.title || opportunityId, customerName: opp?.customer?.name || null,
        handedOffById: req.userId || null, handedOffByName: handoffUser?.name || null,
        handoffCount: { increment: 1 }, itemCount: result.length, totalsByCurrency: JSON.stringify(totalsByCurrency),
        snapshot: JSON.stringify(handoffSnapshot), lastHandoffAt: now,
      },
    }).catch(() => {});
    await logActivity({ tenantId, userId: req.userId, action: 'BOM_HANDED_OFF', entityType: 'OPPORTUNITY', entityId: opportunityId, details: { itemCount: result.length } });
  }

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

// ── Maliyet analizi — fiyatlama motoru artık backend'de (bkz. salesCosting.ts) ──
// Önceden CostAnalysisModule.tsx unitSalePrice/marj/teklifi tarayıcıda hesaplayıp
// 3 ayrı çağrıyla (bom/costs/costConfig) olduğu gibi kaydediyordu — backend hiç
// doğrulamıyordu. Artık ham girdiler (BoM+manuel gider+costConfig parametreleri)
// gönderilir, sunucu hesaplar ve KENDİ hesapladığı değerlerle kaydeder; yanıt
// otoriter sayıları döner (agent/API tüketicisi de aynı sayıyı görür).
router.post('/:id/cost-analysis', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const opportunityId = req.params.id as string;
  const tenantId = req.tenantId;

  const opp = await prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId } });
  if (!opp) return res.status(404).json({ error: 'Fırsat bulunamadı.' });

  const bomItems = (req.body.bomItems || []) as SalesBoMItemInput[];
  const manualCostItems = (req.body.costItems || []) as SalesManualCostItemInput[];
  const costConfig = (req.body.costConfig || {}) as SalesCostConfig;

  // Usul seçilmeden hesaplanan maliyet analizi onaya gönderilemez. Fırsat oluşturulurken
  // bir satınalma usulü sabitlenmişse (Opportunity.procurementMethod) hesap doğrudan o
  // usule kilitlenir — eşleşmeyen bir usulle gelen analiz reddedilir. Fırsatta usul hiç
  // belirtilmemişse (null) kullanıcı serbestçe seçmiş olabilir; bu durumda eşleşme aranmaz.
  if (!costConfig.procurementMethod) {
    return res.status(400).json({ error: 'Maliyet analizi için bir satınalma usulü seçilmelidir.' });
  }
  if (opp.procurementMethod && costConfig.procurementMethod !== opp.procurementMethod) {
    return res.status(400).json({
      error: `Maliyet analizindeki satınalma usulü (${costConfig.procurementMethod}) fırsatın usulüyle (${opp.procurementMethod}) eşleşmiyor. Fırsatta belirlenen usul değiştirilemez.`,
    });
  }

  const marginFloorPct = await getSalesMarginFloor(tenantId);
  const result = computeSalesCosting({ bomItems, manualCostItems, costConfig, marginFloorPct });

  const bomResult = await prisma.$transaction(async (tx) => {
    await tx.boMItem.deleteMany({ where: { opportunityId } });
    const created = [];
    for (const item of result.pricedBomItems) {
      created.push(await tx.boMItem.create({
        data: {
          opportunityId,
          lineKey: item.lineKey ? String(item.lineKey) : undefined,
          partNumber: String(item.partNumber || 'N/A'),
          description: String(item.description || ''),
          quantity: item.quantity,
          purchaseCost: item.purchaseCost,
          marginPercentage: costConfig.targetMargin ?? 20,
          unitSalePrice: item.unitSalePrice,
          totalSalePrice: item.totalSalePrice,
          ...(item.currency ? { currency: String(item.currency) } : {}),
          vatRate: item.vatRate !== undefined && item.vatRate !== null ? Number(item.vatRate) : 20,
          ...(item.source ? { source: String(item.source) } : {}),
          vendor: String(item.vendor || ''),
        },
      }));
    }
    return created;
  });

  await prisma.costItem.deleteMany({ where: { opportunityId, tenantId } });
  const allCostItems = [
    ...manualCostItems.map((i) => ({ description: i.description || '', category: i.category || 'OTHER', amount: Number(i.amount) || 0, currency: i.currency || costConfig.baseCurrency || 'TRY', auto: false })),
    ...result.methodCostItems,
  ];
  for (const item of allCostItems) {
    await prisma.costItem.create({ data: { opportunityId, tenantId, description: item.description, category: item.category, amount: item.amount, currency: item.currency, auto: item.auto } });
  }

  await prisma.opportunity.update({ where: { id: opportunityId }, data: { costConfig: JSON.stringify(costConfig), technicalStatus: 'PENDING_APPROVAL' } });

  // Maliyet analizi versiyon geçmişi — canlı BoM/CostItem tabloları her kayıtta silinip
  // yeniden oluşturulduğundan (yukarıda deleteMany+create), o anki anlık görüntü ayrı bir
  // CostAnalysisVersion satırına yazılır. Kart üzerinde "kaç kez analiz yapıldı" bu tablodan.
  const lastVersion = await prisma.costAnalysisVersion.findFirst({
    where: { tenantId, opportunityId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const actor = req.userId ? await prisma.user.findUnique({ where: { id: req.userId }, select: { name: true } }) : null;
  await prisma.costAnalysisVersion.create({
    data: {
      tenantId,
      opportunityId,
      version: (lastVersion?.version ?? 0) + 1,
      bomItems: JSON.stringify(bomResult),
      costItems: JSON.stringify(allCostItems),
      costConfig: JSON.stringify(costConfig),
      grandCost: result.grandCost,
      offer: result.offer,
      marginPct: result.marginPct,
      belowFloor: result.belowFloor,
      status: 'PENDING_APPROVAL',
      createdById: req.userId ?? null,
      createdByName: actor?.name ?? null,
    },
  });

  // Satış Müdürüne onay görevi + bildirim (submit-cost-approval ile aynı — tek çağrıda birleşti)
  const salesMgr = await prisma.user.findFirst({ where: { tenantId, role: 'SALES_MGR' } });
  const salesUnit = salesMgr?.unitId || (await prisma.unit.findFirst({ where: { tenantId, name: { contains: 'Satış' } } }))?.id;
  if (salesUnit) {
    await prisma.todoTask.create({ data: {
      title: `Maliyet analizi onayı: ${opp.title}`,
      description: `Maliyet analizi tamamlandı, Satış Müdürü onayı bekleniyor. Marj: %${result.marginPct.toFixed(1)}${result.belowFloor ? ` (eşik %${result.marginFloorPct} ALTINDA)` : ''}.`,
      unitId: salesUnit, assignedBy: opp.assignedToId, tenantId,
      relatedModule: 'OPPORTUNITY', relatedItemId: opportunityId, priority: result.belowFloor ? 'URGENT' : 'HIGH', status: 'PENDING',
    } }).catch(() => {});
  }
  await notify(tenantId, salesMgr?.id, 'Maliyet onayı bekliyor', `"${opp.title}" maliyet analizi onayınızı bekliyor. Marj: %${result.marginPct.toFixed(1)}${result.belowFloor ? ' — eşik altında!' : ''}`, result.belowFloor ? 'WARNING' : 'APPROVAL');
  await notify(tenantId, opp.assignedToId, 'Maliyet analizi onaya gönderildi', `"${opp.title}" maliyet analiziniz Satış Müdürü onayına gönderildi.`, 'INFO');

  await logActivity({ tenantId, userId: req.userId, action: 'SUBMIT_COST_APPROVAL', entityType: 'OPPORTUNITY', entityId: opportunityId, details: { title: opp.title, marginPct: result.marginPct, belowFloor: result.belowFloor } });

  res.json({ ...result, bomItems: bomResult, costItems: allCostItems, technicalStatus: 'PENDING_APPROVAL' });
}));

// Fırsat kartı — "kaç kez maliyet analizi yapıldı" kronolojik geçmişi (salt-okunur snapshot'lar).
router.get('/:id/cost-analysis-versions', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const opportunityId = String(req.params.id);
  const tenantId = req.tenantId;
  const opp = await prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId } });
  if (!opp) return res.status(404).json({ error: 'Fırsat bulunamadı.' });

  const versions = await prisma.costAnalysisVersion.findMany({
    where: { tenantId, opportunityId },
    orderBy: { version: 'desc' },
  });
  const parsed = versions.map((v) => ({
    ...v,
    bomItems: (() => { try { return JSON.parse(v.bomItems); } catch { return []; } })(),
    costItems: (() => { try { return JSON.parse(v.costItems); } catch { return []; } })(),
    costConfig: (() => { try { return JSON.parse(v.costConfig); } catch { return {}; } })(),
  }));
  res.json(parsed);
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

  // Faz 0 — kalıcı onay zinciri: Finans → İGB → Üst Yönetim (GM) → KSU
  // DoA: tenant onay matrisi tanımlıysa fırsat tutarına göre roller seçilir (opt-in).
  await ensureApprovalChain(tenantId, 'OPPORTUNITY', opportunityId, undefined, opp.value);

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

  // /cost-analysis'teki aynı kural: usul seçilmemişse veya fırsatta sabitlenmiş usulle
  // eşleşmiyorsa onaya gönderilemez; fırsatta usul belirtilmemişse eşleşme aranmaz.
  const storedConfig = opp.costConfig ? (() => { try { return JSON.parse(opp.costConfig as string) as SalesCostConfig; } catch { return null; } })() : null;
  if (!storedConfig?.procurementMethod) {
    return res.status(400).json({ error: 'Maliyet analizi için bir satınalma usulü seçilmelidir.' });
  }
  if (opp.procurementMethod && storedConfig.procurementMethod !== opp.procurementMethod) {
    return res.status(400).json({
      error: `Maliyet analizindeki satınalma usulü (${storedConfig.procurementMethod}) fırsatın usulüyle (${opp.procurementMethod}) eşleşmiyor. Onaya göndermeden önce maliyet analizini fırsatla aynı usulle yeniden kaydedin.`,
    });
  }

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

  // Görev Ayrılığı (SoD): fırsatı oluşturan kendi maliyet analizini onaylayamaz.
  const sod = await sodViolation(tenantId, req.userId, 'OPPORTUNITY', opportunityId);
  if (sod) return res.status(403).json({ error: sod });

  const newStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  // Optimistic locking: yalnız PENDING_APPROVAL iken geçiş (TOCTOU yarışını kapatır).
  const upd = await prisma.opportunity.updateMany({
    where: { id: opportunityId, technicalStatus: 'PENDING_APPROVAL' },
    data: { technicalStatus: newStatus },
  });
  if (upd.count === 0) return res.status(409).json({ error: 'Onay durumu değişmiş (eşzamanlı işlem). Sayfayı yenileyin.' });

  // İlgili onay görevini kapat
  await prisma.todoTask.updateMany({
    where: { tenantId, relatedModule: 'OPPORTUNITY', relatedItemId: opportunityId, title: { startsWith: 'Maliyet analizi onayı' }, status: 'PENDING' },
    data: { status: 'COMPLETED' },
  }).catch(() => {});

  // En güncel maliyet analizi versiyonuna kararı yansıt (geçmiş listesinde doğru statü görünsün)
  const latestVersion = await prisma.costAnalysisVersion.findFirst({ where: { tenantId, opportunityId }, orderBy: { version: 'desc' } });
  if (latestVersion) {
    await prisma.costAnalysisVersion.update({ where: { id: latestVersion.id }, data: { status: newStatus } }).catch(() => {});
  }

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

  // Görev Ayrılığı (SoD): oluşturan kendi fırsatını onaylayamaz.
  const sod = await sodViolation(tenantId, req.userId, 'OPPORTUNITY', opportunityId);
  if (sod) return res.status(403).json({ error: sod });

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

// ── Fırsat ilerleme teyidi (periyodik zorunlu check-in) ──────────────────────
router.post('/:id/progress-checkin', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const opportunityId = req.params.id as string;
  const tenantId = req.tenantId;
  const { probability, status, note } = req.body as { probability?: number; status?: string; note?: string };

  if (status !== undefined && !OPPORTUNITY_STATUSES.has(status)) {
    return res.status(400).json({ error: `Geçersiz status: '${status}'. İzinli değerler: ${[...OPPORTUNITY_STATUSES].join(', ')}` });
  }

  try {
    await recordProgressCheckIn(tenantId, opportunityId, req.userId, { probability, status, note });
  } catch (e) {
    if (e instanceof ProgressCheckInError) return res.status(400).json({ error: e.message });
    throw e;
  }

  const updated = await prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId }, include: { customer: true, assignedTo: true, createdBy: true } });
  res.json(updated);
}));

router.get('/:id/progress-log', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const opportunityId = req.params.id as string;
  const logs = await prisma.opportunityProgressLog.findMany({
    where: { tenantId: req.tenantId, opportunityId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(logs);
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

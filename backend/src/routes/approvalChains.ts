import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { autoSkipOrphanStages, getDelegatedRoles, resolveEffectiveApprover, resolveGroupAfterDecision } from '../services/approvalChainService';
import { continueProcess } from '../services/processEngine';
import { sweepApprovalSlaEscalations } from '../services/approvalSlaEscalation';
import { sodViolation } from '../services/governance';
import { logActivity } from '../services/activityLog';
import { ENTITY_TYPE_TAB } from '../utils/entityTypeTab';
import { logger } from '../utils/logger';

const router: Router = Router();

// GET /?entityType=PROPOSAL&entityId=xxx → tek zincir bulma (yoksa null)
// GET /?pendingForRole=FINANCE_MGR → o role ait, sırası gelmiş (PENDING) bekleyen onaylar
// "Sırası gelmiş" = kendinden önceki tüm aşamalar APPROVED olan ilk PENDING aşama bu role ait.
router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { entityType, entityId, pendingForRole } = req.query as { entityType?: string; entityId?: string; pendingForRole?: string };

  await sweepApprovalSlaEscalations(req.tenantId); // B-05 — SLA aşımı eskalasyonu (non-throwing)

  if (pendingForRole) {
    const chains = await prisma.approvalChain.findMany({
      where: { tenantId: req.tenantId, status: 'PENDING' },
      include: { stages: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' }
    });
    // Self-heal: tenant'ta aktif olmayan role sahip öncü aşamaları atla, böylece
    // "sırası gelmiş" aşama doğru role düşer ve kaldırılan rol swimlane'i tıkamaz.
    let healed = await Promise.all(chains.map(c => autoSkipOrphanStages(req.tenantId, c.id)));
    // Boş koltuklar çözüldükten sonra motor zincirlerinde sıradaki AUTO adımları
    // da yürüt: agent'la kapanan MANUAL ön-ekten sonra gelen sözleşme/proje/fatura
    // yaratma adımları normalde yalnız onay rotasındaki continueProcess ile
    // pompalanıyordu — worklist yüklemesi de aynı ilerlemeyi tetiklemeli.
    healed = await Promise.all(healed.map(async (c) => {
      if (!c || c.status !== 'PENDING' || !c.processKey) return c;
      await continueProcess(req.tenantId, c.entityType, c.entityId, c.processKey).catch(() => undefined);
      return autoSkipOrphanStages(req.tenantId, c.id);
    }));
    // B-08 — vekalet: kendi rolüne ek olarak, kendisine vekalet verilmiş rollerin
    // bekleyen onayları da "sırası gelmiş" listesine dahil edilir.
    const delegatedRoles = await getDelegatedRoles(req.tenantId, req.userId);
    const effectiveRoles = new Set([pendingForRole, ...delegatedRoles]);
    // Süreç Motoru (Faz A): unitId-scope'lu (role=null) aşamalar için kullanıcının
    // kendi birimi de eşleşme kriteri.
    const me = await prisma.user.findFirst({ where: { id: req.userId, tenantId: req.tenantId }, select: { unitId: true } });
    const myTurn = (healed.filter(Boolean) as NonNullable<typeof healed[number]>[]).filter(c => {
      if (c.status !== 'PENDING') return false;
      const pending = c.stages.filter(s => s.status === 'PENDING');
      if (!pending.length) return false;
      const minOrder = Math.min(...pending.map(s => s.order));
      // B-05 — SLA aşımıyla eskale edilmiş stage'ler, eskale edilen rolün de
      // "sırası gelmiş" listesinde görünmesini sağlar (orijinal rol de görmeye devam eder).
      // Çoklu-onaylayıcı: aynı order'daki HERHANGİ bir aşama eşleşirse görünür.
      return pending.some(s => s.order === minOrder && (
        (!!s.role && effectiveRoles.has(s.role)) ||
        (!s.role && !!s.unitId && s.unitId === me?.unitId) ||
        (!!s.escalatedToRole && effectiveRoles.has(s.escalatedToRole))
      ));
    });
    // B-05 düzeltmesi: yalnız OPPORTUNITY zincirleri fırsat başlığıyla eşleşiyordu
    // (frontend'de ayrıca çözülüyor); TENDER/CONTRACT_WORKFLOW_SIGNING/PURCHASE_REQUEST/
    // PROJECT kartlarında hiçbir ayırt edici isim yoktu — yoğun bir tenant'ta aynı role
    // ait birden fazla bekleyen kart varken hangisinin hangi kayda ait olduğu belli
    // olmuyordu. Burada tek tek sorgu yerine entityType'a göre gruplayıp toplu (batch)
    // okunuyor ve `entityLabel` alanı olarak zincire eklenip döndürülüyor.
    const idsByType = new Map<string, Set<string>>();
    for (const c of myTurn) {
      if (c.entityType === 'OPPORTUNITY') continue; // frontend zaten çözüyor
      if (!idsByType.has(c.entityType)) idsByType.set(c.entityType, new Set());
      idsByType.get(c.entityType)!.add(c.entityId);
    }
    const labelById = new Map<string, string>();
    const tenderIds = [...(idsByType.get('TENDER') ?? [])];
    if (tenderIds.length) {
      const rows = await prisma.tender.findMany({ where: { id: { in: tenderIds } }, select: { id: true, name: true, ikn: true } });
      rows.forEach((r) => labelById.set(r.id, r.ikn ? `${r.name} · İKN: ${r.ikn}` : r.name));
    }
    const cwIds = [...(idsByType.get('CONTRACT_WORKFLOW_SIGNING') ?? [])];
    if (cwIds.length) {
      const rows = await prisma.contractWorkflow.findMany({ where: { id: { in: cwIds } }, select: { id: true, title: true } });
      rows.forEach((r) => labelById.set(r.id, r.title));
    }
    const prIds = [...(idsByType.get('PURCHASE_REQUEST') ?? [])];
    if (prIds.length) {
      const rows = await prisma.purchaseRequest.findMany({ where: { id: { in: prIds } }, select: { id: true, title: true } });
      rows.forEach((r) => labelById.set(r.id, r.title));
    }
    const projIds = [...(idsByType.get('PROJECT') ?? [])];
    if (projIds.length) {
      const rows = await prisma.project.findMany({ where: { id: { in: projIds } }, select: { id: true, name: true, code: true } });
      rows.forEach((r) => labelById.set(r.id, r.code ? `${r.name} (${r.code})` : r.name));
    }
    const withLabels = myTurn.map((c) => ({ ...c, entityLabel: labelById.get(c.entityId) ?? null }));

    return res.json(withLabels);
  }

  const where: Record<string, unknown> = { tenantId: req.tenantId };
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  const chains = await prisma.approvalChain.findMany({
    where,
    include: { stages: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' }
  });
  res.json(chains);
}));

router.get('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const chain = await prisma.approvalChain.findFirst({
    where: { id, tenantId: req.tenantId },
    include: { stages: { orderBy: { order: 'asc' } } }
  });
  if (!chain) return res.status(404).json({ error: 'Onay zinciri bulunamadı.' });
  res.json(chain);
}));

// POST / → { entityType, entityId, stages: [{ role, order? }] }
router.post('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { entityType, entityId, stages } = req.body as {
    entityType: string;
    entityId: string;
    stages: { role: string; order?: number }[];
  };

  if (!entityType || !entityId || !Array.isArray(stages) || stages.length === 0) {
    return res.status(400).json({ error: 'entityType, entityId ve en az bir stage zorunludur.' });
  }

  const chain = await prisma.approvalChain.create({
    data: {
      entityType,
      entityId,
      tenantId: req.tenantId,
      stages: {
        create: stages.map((s, i) => ({ role: s.role, order: s.order ?? i }))
      }
    },
    include: { stages: { orderBy: { order: 'asc' } } }
  });
  res.json(chain);
}));

router.post('/:id/stages/:stageId/approve', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const stageId = String(req.params.stageId);
  const { note, assigneeUserId } = req.body as { note?: string; assigneeUserId?: string };

  const chain = await prisma.approvalChain.findFirst({
    where: { id, tenantId: req.tenantId },
    include: { stages: { orderBy: { order: 'asc' } } }
  });
  if (!chain) return res.status(404).json({ error: 'Onay zinciri bulunamadı.' });

  const stage = chain.stages.find(s => s.id === stageId);
  if (!stage) return res.status(404).json({ error: 'Onay aşaması bulunamadı.' });

  // Presales Müdürü teknik değerlendirmeyi onaylarken BoM'u kimin hazırlayacağını
  // (hangi mühendis) AÇIKÇA seçmeli — "birime bildir, kim bakarsa çalışsın" birim-
  // geneli yayını, birimde birden fazla/az sayıda mühendis olduğunda kimseye
  // ulaşmayabiliyordu (bkz. geri bildirim). Seçim burada zorunlu kılınır; sonuç
  // Opportunity.presalesId'e yazılır — ileride birim utilizasyonu bu alandan okunabilir.
  const isPresalesTechEval = chain.entityType === 'OPPORTUNITY' && chain.processKey === 'CRM_HANDOFF' && stage.role === 'PRESALES_MGR';
  let assignedEngineer: { id: string; name: string; unitId: string | null } | null = null;
  if (isPresalesTechEval) {
    if (!assigneeUserId) return res.status(400).json({ error: 'BoM hazırlayacak Presales Mühendisi seçilmelidir.' });
    assignedEngineer = await prisma.user.findFirst({
      where: { id: assigneeUserId, tenantId: req.tenantId, role: 'PRESALES_ENG', status: 'ACTIVE' },
      select: { id: true, name: true, unitId: true },
    });
    if (!assignedEngineer) return res.status(400).json({ error: 'Seçilen kullanıcı geçerli/aktif bir Presales Mühendisi değil.' });
  }

  // B-08 — yalnız aşamanın rolüne sahip kullanıcı ya da o role vekalet verilmiş kullanıcı onaylayabilir.
  // (approverId artık client body'den değil, kimliği doğrulanmış req.userId'den alınır.)
  // B-05 — SLA aşımıyla eskale edilmişse escalatedToRole de onaylayabilir (orijinal rolün
  // yetkisi kaldırılmaz, ikisinden ilk onaylayan geçerli olur — optimistic locking zaten var).
  const canApprove = (await resolveEffectiveApprover(req.tenantId, { role: stage.role, unitId: stage.unitId, delegateUserId: stage.delegateUserId }, req.userId))
    || (!!stage.escalatedToRole && await resolveEffectiveApprover(req.tenantId, stage.escalatedToRole, req.userId));
  if (!canApprove) return res.status(403).json({ error: 'Bu aşamayı onaylama yetkiniz yok.' });

  // Görev Ayrılığı (SoD): oluşturan kendi kaydını onaylayamaz.
  const sod = await sodViolation(req.tenantId, req.userId, chain.entityType, chain.entityId);
  if (sod) return res.status(403).json({ error: sod });

  // Optimistic locking: yalnız PENDING aşama onaylanır (eşzamanlı approve/reject yarışı).
  const upd = await prisma.approvalStage.updateMany({
    where: { id: stageId, status: 'PENDING' },
    data: { status: 'APPROVED', approverId: req.userId, note, approvedAt: new Date() }
  });
  if (upd.count === 0) return res.status(409).json({ error: 'Bu aşama zaten işlenmiş (eşzamanlı işlem).' });

  // Çoklu-onaylayıcı (Süreç Motoru, Faz A): aynı order'ı paylaşan kardeş
  // aşamaları ANY/ALL moduna göre çözer (grup tamamlanmadıysa zincir PENDING kalır).
  await resolveGroupAfterDecision(req.tenantId, id);
  // Kalan aşamalarda tenant'ta aktif olmayan rolleri/birimleri atla; geriye
  // PENDING kalmazsa zincir COMPLETED olur (SKIPPED aşamalar bloklamaz).
  let updated = await autoSkipOrphanStages(req.tenantId, id);
  // Süreç Motoru — zincir motor tarafından üretildiyse (processKey doluysa)
  // sıradaki aşama grubunun alıcılarına TodoTask+Notification üretir / AUTO
  // adımları çalıştırır (bir AUTO adım zinciri burada COMPLETED'a taşıyabilir
  // — dönüş değeri `updated`'a yansıtılır ki hem yanıt hem B-09 senkronu güncel
  // durumu görsün, `autoSkipOrphanStages`'in DÖNÜŞ ANINDAKİ eski görüntüsünü değil).
  if (updated) {
    // B-10 düzeltmesi: bir AUTO adım burada patlarsa (approve işlemi başarılıyken)
    // eskiden tamamen sessizce yutuluyordu — hiçbir yerde iz kalmıyordu. Onaylayan
    // kişinin yanıtı yine bloklanmaz (aşama onayı geçerli), ama hata artık en azından
    // sunucu loguna düşer.
    const continued = await continueProcess(req.tenantId, updated.entityType, updated.entityId, updated.processKey).catch((e) => {
      logger.error('continueProcess AUTO adımı başarısız', { chainId: id, entityType: updated?.entityType, entityId: updated?.entityId, processKey: updated?.processKey, error: e instanceof Error ? e.message : e });
      return null;
    });
    if (continued) updated = continued.chain;
  }
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'STAGE_APPROVE', entityType: 'APPROVAL_STAGE', entityId: stageId, details: { chainId: id, role: stage.role, chainStatus: updated?.status } });

  // B-09 — legacy tek-tıkla onay (Opportunity.technicalStatus) ile aşama-bazlı
  // swimlane iki bağımsız kayıt tutuyordu (legacy→chain zaten bağlıydı, chain→legacy
  // eksikti). Swimlane burada COMPLETED olduğunda legacy alanı da senkronize edilir —
  // hangi ekrandan onaylanırsa onaylansın iki mekanizma birbirinden sapmaz.
  // processKey filtresi zorunlu: OPPORTUNITY entityType'ı CRM_HANDOFF/PRESALES_HANDOFF
  // gibi başka süreçlerle de paylaşılıyor — filtresiz haliyle bu blok, henüz hiçbir
  // maliyet analizi/BoM yapılmamışken salt teknik değerlendirme onaylandığında bile
  // fırsatı yanlışlıkla 'PROPOSAL'a taşıyıp technicalStatus'ü 'APPROVED' işaretliyordu.
  if (updated?.status === 'COMPLETED' && chain.entityType === 'OPPORTUNITY' && chain.processKey === 'OPPORTUNITY_APPROVAL') {
    await prisma.opportunity.updateMany({
      where: { id: chain.entityId, technicalStatus: { not: 'APPROVED' } },
      data: { technicalStatus: 'APPROVED' },
    });
    // B-12 düzeltmesi: bu, opportunities.ts POST /:id/approve'daki AYNI senkronun
    // burada (generic /approval-chains onay ucu — gerçek UI'nin (PendingChainApprovals)
    // kullandığı yol) unutulan bir kopyasıydı. status'u koşulsuz 'PROPOSAL'a çekmek,
    // fırsat bu onaya gelmeden ÖNCE zaten WON/LOST/WITHDRAWN işaretlenmişse o kararı
    // sessizce geri alıyordu — status yalnız hâlâ teklif-öncesi aşamadaysa ilerletilir.
    await prisma.opportunity.updateMany({
      where: { id: chain.entityId, status: { notIn: ['WON', 'LOST', 'WITHDRAWN'] } },
      data: { status: 'PROPOSAL' },
    });
  }

  // Presales Müdürü teknik değerlendirmeyi onayladığında: Satış Müdürü onayı
  // görebilsin diye bilgilendirilir; Presales Mühendisi'ne BoM hazırlama görevi
  // açılır (bkz. opportunities.ts POST /:id/bom — bu görev tamamlanmadan BoM
  // girişi zaten backend'de engelleniyor, burada iş sırasının başlatılması).
  if (updated?.status === 'COMPLETED' && chain.entityType === 'OPPORTUNITY' && chain.processKey === 'CRM_HANDOFF' && assignedEngineer) {
    const opp = await prisma.opportunity.findFirst({ where: { id: chain.entityId, tenantId: req.tenantId } });
    if (opp) {
      const salesMgrs = await prisma.user.findMany({ where: { tenantId: req.tenantId, role: 'SALES_MGR', status: 'ACTIVE' } });
      await Promise.all(salesMgrs.map((u) => prisma.notification.create({
        data: { tenantId: req.tenantId, userId: u.id, type: 'SUCCESS', title: 'Teknik değerlendirme onaylandı', message: `"${opp.title}" fırsatı Presales Müdürü tarafından teknik olarak onaylandı. BoM hazırlığı ${assignedEngineer.name}'e devredildi.`, relatedModule: ENTITY_TYPE_TAB.OPPORTUNITY, relatedItemId: opp.id },
      }).catch(() => undefined)));
      // Birim-geneli yayın yerine seçilen mühendise doğrudan atama — hem bildirim
      // hem görev garanti ulaşır, hem de presalesId ileride birim utilizasyonu
      // ("kim kaç BoM üstlendi") raporlanabilir hale gelir.
      await prisma.notification.create({
        // Presales ekranına (BoM sekmesi) doğrudan gider — mühendisin yapması
        // gereken eylem tam olarak orada (crm-opportunities değil).
        data: { tenantId: req.tenantId, userId: assignedEngineer.id, type: 'APPROVAL', title: 'BoM hazırlığı size devredildi', message: `"${opp.title}" fırsatı teknik değerlendirmeden geçti. BoM hazırlayabilirsiniz.`, relatedModule: 'presales', relatedItemId: opp.id },
      }).catch(() => undefined);
      await prisma.todoTask.create({ data: {
        title: `BoM Hazırla: ${opp.title}`,
        description: 'Presales Müdürü teknik değerlendirmeyi onayladı ve bu fırsatı size devretti. BoM hazırlayın.',
        unitId: assignedEngineer.unitId || stage.unitId || '', assignedToUserId: assignedEngineer.id,
        assignedBy: req.userId || 'system', tenantId: req.tenantId,
        // actionKey=BOM_PREPARE → "Git" butonu presales'e (BoM ekranı) gider,
        // relatedModule=OPPORTUNITY fallback'inin götürdüğü crm-opportunities'e değil.
        actionKey: 'BOM_PREPARE',
        relatedModule: 'OPPORTUNITY', relatedItemId: opp.id, priority: 'HIGH', status: 'PENDING',
      } }).catch(() => undefined);
      await prisma.opportunity.update({ where: { id: opp.id }, data: { presalesId: assignedEngineer.id } }).catch(() => undefined);
      await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'TECH_EVAL_APPROVED', entityType: 'OPPORTUNITY', entityId: opp.id, details: { assignedEngineerId: assignedEngineer.id, assignedEngineerName: assignedEngineer.name } });
    }
  }

  res.json(updated);
}));

router.post('/:id/stages/:stageId/reject', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const stageId = String(req.params.stageId);
  const { note } = req.body as { note?: string };

  // Bir red her zaman bir gerekçe taşımalı — onaylayanın/reddedenin niyetini
  // kaydeden tek yer bu alan; gerekçesiz red, ilgili tarafların "neden?" sorusunu
  // yanıtsız bırakır (bkz. CRM_HANDOFF özel akışı aşağıda — gerekçe hem Satış
  // Müdürü/GM bildirimine hem Alınan Dersler kaydına taşınır).
  if (!note || !note.trim()) {
    return res.status(400).json({ error: 'Red gerekçesi zorunludur.' });
  }

  const chain = await prisma.approvalChain.findFirst({
    where: { id, tenantId: req.tenantId },
    include: { stages: { orderBy: { order: 'asc' } } }
  });
  if (!chain) return res.status(404).json({ error: 'Onay zinciri bulunamadı.' });

  const stage = chain.stages.find(s => s.id === stageId);
  if (!stage) return res.status(404).json({ error: 'Onay aşaması bulunamadı.' });

  // B-08 — approve ile simetrik: yalnız rol sahibi ya da vekili reddedebilir.
  // B-05 — eskalasyon durumunda escalatedToRole de reddedebilir (approve ile simetrik).
  const canReject = (await resolveEffectiveApprover(req.tenantId, { role: stage.role, unitId: stage.unitId, delegateUserId: stage.delegateUserId }, req.userId))
    || (!!stage.escalatedToRole && await resolveEffectiveApprover(req.tenantId, stage.escalatedToRole, req.userId));
  if (!canReject) return res.status(403).json({ error: 'Bu aşamayı reddetme yetkiniz yok.' });

  // Optimistic locking: yalnız PENDING aşama reddedilebilir (eşzamanlı yarış).
  const upd = await prisma.approvalStage.updateMany({
    where: { id: stageId, status: 'PENDING' },
    data: { status: 'REJECTED', approverId: req.userId, note, approvedAt: new Date() }
  });
  if (upd.count === 0) return res.status(409).json({ error: 'Bu aşama zaten işlenmiş (eşzamanlı işlem).' });
  await prisma.approvalChain.update({ where: { id }, data: { status: 'REJECTED' } });

  const updated = await prisma.approvalChain.findFirst({
    where: { id },
    include: { stages: { orderBy: { order: 'asc' } } }
  });
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'STAGE_REJECT', entityType: 'APPROVAL_STAGE', entityId: stageId, details: { chainId: id, note: note || null } });

  // Presales Müdürü teknik değerlendirmeyi reddettiğinde: Satış Müdürü + Üst
  // Yönetim (GM) gerekçeyle bilgilendirilir ve gerekçe Kurumsal Yönetişim →
  // Alınan Dersler'e otomatik işlenir ki Kalite birimi görüp aksiyon alsın.
  if (chain.entityType === 'OPPORTUNITY' && chain.processKey === 'CRM_HANDOFF') {
    const opp = await prisma.opportunity.findFirst({ where: { id: chain.entityId, tenantId: req.tenantId } });
    if (opp) {
      const [salesMgrs, gms, rejector] = await Promise.all([
        prisma.user.findMany({ where: { tenantId: req.tenantId, role: 'SALES_MGR', status: 'ACTIVE' } }),
        prisma.user.findMany({ where: { tenantId: req.tenantId, role: 'GENERAL_MANAGER', status: 'ACTIVE' } }),
        prisma.user.findFirst({ where: { id: req.userId, tenantId: req.tenantId }, select: { name: true } }),
      ]);
      const msg = `"${opp.title}" fırsatı teknik değerlendirmede reddedildi. Gerekçe: ${note}`;
      await Promise.all([
        ...salesMgrs.map((u) => prisma.notification.create({ data: { tenantId: req.tenantId, userId: u.id, type: 'WARNING', title: 'Teknik değerlendirme reddedildi', message: msg, relatedModule: ENTITY_TYPE_TAB.OPPORTUNITY, relatedItemId: opp.id } }).catch(() => undefined)),
        ...gms.map((u) => prisma.notification.create({ data: { tenantId: req.tenantId, userId: u.id, type: 'WARNING', title: 'Teknik değerlendirme reddedildi', message: msg, relatedModule: ENTITY_TYPE_TAB.OPPORTUNITY, relatedItemId: opp.id } }).catch(() => undefined)),
      ]);
      await prisma.lessonsLearned.create({
        data: {
          tenantId: req.tenantId,
          title: `Teknik değerlendirme reddi: ${opp.title}`,
          category: 'TECHNICAL',
          situation: msg,
          rootCause: note,
          status: 'OPEN',
          impact: 'MEDIUM',
          createdById: req.userId,
          createdByName: rejector?.name || null,
        },
      }).catch(() => undefined);
      await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'TECH_EVAL_REJECTED', entityType: 'OPPORTUNITY', entityId: opp.id, details: { note } });
    }
  }

  res.json(updated);
}));

router.delete('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const chain = await prisma.approvalChain.findFirst({ where: { id, tenantId: req.tenantId } });
  if (!chain) return res.status(404).json({ error: 'Onay zinciri bulunamadı.' });

  await prisma.approvalChain.delete({ where: { id } });
  res.json({ message: 'Onay zinciri silindi.' });
}));

export default router;

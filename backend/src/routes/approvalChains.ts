import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { autoSkipOrphanStages, getDelegatedRoles, resolveEffectiveApprover, resolveGroupAfterDecision } from '../services/approvalChainService';
import { continueProcess } from '../services/processEngine';
import { sweepApprovalSlaEscalations } from '../services/approvalSlaEscalation';
import { sodViolation } from '../services/governance';
import { logActivity } from '../services/activityLog';

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
    const healed = await Promise.all(chains.map(c => autoSkipOrphanStages(req.tenantId, c.id)));
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
    return res.json(myTurn);
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
  const { note } = req.body as { note?: string };

  const chain = await prisma.approvalChain.findFirst({
    where: { id, tenantId: req.tenantId },
    include: { stages: { orderBy: { order: 'asc' } } }
  });
  if (!chain) return res.status(404).json({ error: 'Onay zinciri bulunamadı.' });

  const stage = chain.stages.find(s => s.id === stageId);
  if (!stage) return res.status(404).json({ error: 'Onay aşaması bulunamadı.' });

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
    const continued = await continueProcess(req.tenantId, updated.entityType, updated.entityId, updated.processKey).catch(() => null);
    if (continued) updated = continued.chain;
  }
  await logActivity({ tenantId: req.tenantId, userId: req.userId, action: 'STAGE_APPROVE', entityType: 'APPROVAL_STAGE', entityId: stageId, details: { chainId: id, role: stage.role, chainStatus: updated?.status } });

  // B-09 — legacy tek-tıkla onay (Opportunity.technicalStatus) ile aşama-bazlı
  // swimlane iki bağımsız kayıt tutuyordu (legacy→chain zaten bağlıydı, chain→legacy
  // eksikti). Swimlane burada COMPLETED olduğunda legacy alanı da senkronize edilir —
  // hangi ekrandan onaylanırsa onaylansın iki mekanizma birbirinden sapmaz.
  if (updated?.status === 'COMPLETED' && chain.entityType === 'OPPORTUNITY') {
    await prisma.opportunity.updateMany({
      where: { id: chain.entityId, technicalStatus: { not: 'APPROVED' } },
      data: { technicalStatus: 'APPROVED', status: 'PROPOSAL' },
    });
  }

  res.json(updated);
}));

router.post('/:id/stages/:stageId/reject', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const stageId = String(req.params.stageId);
  const { note } = req.body as { note?: string };

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

import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { ensureDefaultWorkflow, resolveNextStep } from '../services/workflowTemplateService';

const router: Router = Router();

interface IncomingStep {
  unitId: string;
  type: string;
  description: string;
  nextStepId?: string | null;
  enabled?: boolean;
  requiresCompletion?: boolean;
  completionNote?: string | null;
}

const mapStep = (step: IncomingStep, index: number) => ({
  unitId: step.unitId,
  order: index,
  type: step.type,
  description: step.description,
  nextStepId: step.nextStepId ?? null,
  enabled: step.enabled ?? true,
  requiresCompletion: step.requiresCompletion ?? false,
  completionNote: step.completionNote ?? null
});

router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const workflows = await prisma.workflow.findMany({
    where: { tenantId: req.tenantId },
    include: { steps: { orderBy: { order: 'asc' } } }
  });
  res.json(workflows);
}));

// Tüm birimleri kapsayan varsayılan şablonu döner (yoksa oluşturur). /:id'den ÖNCE tanımlı olmalı.
router.get('/default', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const workflow = await ensureDefaultWorkflow(req.tenantId);
  res.json(workflow);
}));

// Skip-logic: bir adımdan sonra görevin aktarılacağı sıradaki aktif birimi çözer + uyarı verisi döner.
router.get('/:id/steps/:stepId/resolve-next', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const stepId = req.params.stepId as string;

  const workflow = await prisma.workflow.findFirst({
    where: { id, tenantId: req.tenantId },
    include: { steps: { orderBy: { order: 'asc' }, include: { unit: true } } }
  });
  if (!workflow) return res.status(404).json({ error: 'İş akışı bulunamadı' });

  const { nextStep, fallbackUsed, removedStepId } = resolveNextStep(workflow.steps, stepId);
  const nextStepFull = nextStep ? workflow.steps.find(s => s.id === nextStep.id) : null;
  const removedStep = removedStepId ? workflow.steps.find(s => s.id === removedStepId) : null;

  res.json({
    nextStep: nextStepFull
      ? { id: nextStepFull.id, unitId: nextStepFull.unitId, unitName: nextStepFull.unit?.name ?? null, description: nextStepFull.description }
      : null,
    fallbackUsed,
    removedUnitName: removedStep?.unit?.name ?? null
  });
}));

router.post('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, description, steps } = req.body;
  const workflow = await prisma.workflow.create({
    data: {
      name,
      description,
      tenantId: req.tenantId,
      steps: {
        create: (steps as IncomingStep[]).map(mapStep)
      }
    },
    include: { steps: { orderBy: { order: 'asc' } } }
  });
  res.json(workflow);
}));

router.put('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, description, steps } = req.body;
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.workflow.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const updatedWorkflow = await prisma.$transaction(async (tx) => {
    await tx.workflowStep.deleteMany({ where: { workflowId: id } });

    return tx.workflow.update({
      where: { id },
      data: {
        name,
        description,
        steps: {
          create: (steps as IncomingStep[]).map(mapStep)
        }
      },
      include: { steps: { orderBy: { order: 'asc' } } }
    });
  });

  res.json(updatedWorkflow);
}));

export default router;

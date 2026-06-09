import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';

const router: Router = Router();

router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const workflows = await prisma.workflow.findMany({
    where: { tenantId: req.tenantId },
    include: { steps: { orderBy: { order: 'asc' } } }
  });
  res.json(workflows);
}));

router.post('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, description, steps } = req.body;
  const workflow = await prisma.workflow.create({
    data: {
      name,
      description,
      tenantId: req.tenantId,
      steps: {
        create: (steps as Array<{ unitId: string; type: string; description: string; nextStepId?: string }>).map((step, index) => ({
          unitId: step.unitId,
          order: index,
          type: step.type,
          description: step.description,
          nextStepId: step.nextStepId
        }))
      }
    },
    include: { steps: true }
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
          create: (steps as Array<{ unitId: string; type: string; description: string; nextStepId?: string }>).map((step, index) => ({
            unitId: step.unitId,
            order: index,
            type: step.type,
            description: step.description,
            nextStepId: step.nextStepId
          }))
        }
      },
      include: { steps: true }
    });
  });

  res.json(updatedWorkflow);
}));

export default router;

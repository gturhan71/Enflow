import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware, withRetry } from '../middleware';

const router: Router = Router();

router.post('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const { tasks, opportunities } = req.body;

  const result = await withRetry(async () => {
    return await prisma.$transaction(async (tx) => {
      for (const task of (tasks || [])) {
        if (task.id) {
          await tx.todoTask.upsert({
            where: { id: task.id },
            update: { status: task.status, progressNotes: task.progressNotes },
            create: { ...task, tenantId }
          });
        }
      }
      for (const opp of (opportunities || [])) {
        if (opp.id) {
          await tx.opportunity.update({
            where: { id: opp.id },
            data: { status: opp.status, technicalStatus: opp.technicalStatus }
          });
        }
      }
      return { success: true };
    });
  });

  res.json(result);
}));

export default router;

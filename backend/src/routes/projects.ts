import { Router, Request, Response } from 'express';
import { prisma } from '../prismaClient';
import { asyncHandler, tenantMiddleware } from '../middleware';

const router: Router = Router();

router.get('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const projects = await prisma.project.findMany({ where: { tenantId: req.tenantId } });
  res.json(projects);
}));

router.post('/', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { deadline, procurementNotes, ...rest } = req.body;
  const project = await prisma.project.create({
    data: {
      ...rest,
      deadline: new Date(deadline as string),
      procurementNotes: typeof procurementNotes === 'string' ? procurementNotes : JSON.stringify(procurementNotes || []),
      tenantId: req.tenantId
    }
  });
  res.json(project);
}));

router.put('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { deadline, procurementNotes, ...rest } = req.body;
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.project.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const data: Record<string, unknown> = { ...rest };
  if (deadline) data.deadline = new Date(deadline as string);
  if (procurementNotes !== undefined) {
    data.procurementNotes = typeof procurementNotes === 'string' ? procurementNotes : JSON.stringify(procurementNotes);
  }
  const project = await prisma.project.update({ where: { id }, data });
  res.json(project);
}));

router.delete('/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.tenantId;
  const id = req.params.id as string;

  const record = await prisma.project.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.project.delete({ where: { id } });
  res.json({ message: 'Proje silindi.' });
}));

export default router;

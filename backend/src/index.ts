import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'file:./dev.db';
const adapter = new PrismaLibSql({ url: connectionString });
const prisma = new PrismaClient({ adapter });

const app = express();
const port = 3002;

app.use(express.json());
app.use(cors());

// Utility: Async Route Wrapper to catch errors
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Middleware: Tenant Isolation
const tenantMiddleware = asyncHandler(async (req: Request, res: Response, next: any) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) return res.status(400).json({ error: 'x-tenant-id header is required' });
  
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
  
  (req as any).tenantId = tenantId;
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- TENANTS ---
app.get('/api/tenants', asyncHandler(async (req: Request, res: Response) => {
  const tenants = await prisma.tenant.findMany({ orderBy: { name: 'asc' } });
  res.json(tenants);
}));

// --- AUTH ---
app.post('/api/auth/login', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email }, include: { tenant: true } });
  if (!user) return res.status(401).json({ error: 'Geçersiz bilgiler.' });
  res.json({ user, token: 'mock-jwt-token' });
}));

app.post('/api/auth/forgot-password', asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
  res.json({ message: 'Şifre sıfırlama bağlantısı gönderildi.' });
}));

// --- UNITS ---
app.get('/api/units', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const units = await prisma.unit.findMany({ where: { tenantId: (req as any).tenantId }, include: { users: true } });
  res.json(units);
}));

app.post('/api/units', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, description, managerId } = req.body;
  const unit = await prisma.unit.create({
    data: { name, description, managerId, tenantId: (req as any).tenantId }
  });
  res.json(unit);
}));

// --- USERS ---
app.get('/api/users', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({ 
    where: { tenantId: (req as any).tenantId },
    include: { unit: true }
  });
  res.json(users);
}));

app.post('/api/users', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, email, role, unitId, permissions } = req.body;
  const user = await prisma.user.create({
    data: {
      name, email, role, unitId: unitId || null,
      tenantId: (req as any).tenantId,
      permissions: typeof permissions === 'string' ? permissions : JSON.stringify(permissions || ['DASHBOARD_VIEW']),
      status: 'ACTIVE'
    }
  });
  res.json(user);
}));

app.put('/api/users/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, email, role, unitId, permissions, status } = req.body;
  const data: any = { name, email, role, unitId, status };
  if (permissions) {
    data.permissions = typeof permissions === 'string' ? permissions : JSON.stringify(permissions);
  }
  const user = await prisma.user.update({
    where: { id: (req.params.id as string), tenantId: (req as any).tenantId },
    data
  });
  res.json(user);
}));

app.delete('/api/users/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  await prisma.user.delete({ where: { id: (req.params.id as string), tenantId: (req as any).tenantId } });
  res.json({ message: 'Kullanıcı silindi.' });
}));

// --- CUSTOMERS ---
app.get('/api/customers', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const customers = await prisma.customer.findMany({ where: { tenantId: (req as any).tenantId }, orderBy: { name: 'asc' } });
  res.json(customers);
}));

app.post('/api/customers', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const customer = await prisma.customer.create({ data: { ...req.body, tenantId: (req as any).tenantId } });
  res.json(customer);
}));

app.put('/api/customers/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const customer = await prisma.customer.update({
    where: { id: (req.params.id as string), tenantId: (req as any).tenantId },
    data: req.body
  });
  res.json(customer);
}));

app.delete('/api/customers/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  await prisma.customer.delete({ where: { id: (req.params.id as string), tenantId: (req as any).tenantId } });
  res.json({ message: 'Müşteri silindi.' });
}));

// --- OPPORTUNITIES ---
app.get('/api/opportunities', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const opps = await prisma.opportunity.findMany({ 
    where: { tenantId: (req as any).tenantId }, 
    include: { customer: true, assignedTo: true, createdBy: true } 
  });
  res.json(opps);
}));

app.post('/api/opportunities', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { title, value, probability, customerId, assignedToId, description, expectedCloseDate, status } = req.body;
  const opp = await prisma.opportunity.create({
    data: {
      title, value, probability, customerId, assignedToId, description,
      expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
      createdById: assignedToId,
      tenantId: (req as any).tenantId,
      status: status || 'NEW'
    }
  });
  res.json(opp);
}));

app.put('/api/opportunities/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { expectedCloseDate, ...rest } = req.body;
  const data = { ...rest };
  if (expectedCloseDate) data.expectedCloseDate = new Date(expectedCloseDate);
  const opp = await prisma.opportunity.update({
    where: { id: (req.params.id as string), tenantId: (req as any).tenantId },
    data
  });
  res.json(opp);
}));

app.delete('/api/opportunities/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  await prisma.opportunity.delete({ where: { id: (req.params.id as string), tenantId: (req as any).tenantId } });
  res.json({ message: 'Fırsat silindi.' });
}));

// --- PROJECTS ---
app.get('/api/projects', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const projects = await prisma.project.findMany({ 
    where: { tenantId: (req as any).tenantId },
    include: { tasks: true }
  });
  res.json(projects);
}));

app.post('/api/projects', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { deadline, procurementNotes, ...rest } = req.body;
  const project = await prisma.project.create({
    data: {
      ...rest,
      deadline: new Date(deadline),
      procurementNotes: typeof procurementNotes === 'string' ? procurementNotes : JSON.stringify(procurementNotes || []),
      tenantId: (req as any).tenantId
    }
  });
  res.json(project);
}));

app.put('/api/projects/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { deadline, procurementNotes, ...rest } = req.body;
  const data = { ...rest };
  if (deadline) data.deadline = new Date(deadline);
  if (procurementNotes !== undefined) {
    data.procurementNotes = typeof procurementNotes === 'string' ? procurementNotes : JSON.stringify(procurementNotes);
  }
  const project = await prisma.project.update({
    where: { id: (req.params.id as string), tenantId: (req as any).tenantId },
    data
  });
  res.json(project);
}));

app.delete('/api/projects/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  await prisma.project.delete({ where: { id: (req.params.id as string), tenantId: (req as any).tenantId } });
  res.json({ message: 'Proje silindi.' });
}));

// --- TODO TASKS ---
app.get('/api/tasks', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tasks = await prisma.todoTask.findMany({ where: { tenantId: (req as any).tenantId } });
  res.json(tasks);
}));

app.post('/api/tasks', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { dueDate, progressNotes, ...rest } = req.body;
  const task = await prisma.todoTask.create({
    data: {
      ...rest,
      dueDate: dueDate ? new Date(dueDate) : null,
      progressNotes: typeof progressNotes === 'string' ? progressNotes : JSON.stringify(progressNotes || []),
      tenantId: (req as any).tenantId
    }
  });
  res.json(task);
}));

app.put('/api/tasks/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { dueDate, progressNotes, ...rest } = req.body;
  const data = { ...rest };
  if (dueDate) data.dueDate = new Date(dueDate);
  if (progressNotes !== undefined) {
    data.progressNotes = typeof progressNotes === 'string' ? progressNotes : JSON.stringify(progressNotes);
  }
  const task = await prisma.todoTask.update({
    where: { id: (req.params.id as string), tenantId: (req as any).tenantId },
    data
  });
  res.json(task);
}));

app.delete('/api/tasks/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  await prisma.todoTask.delete({ where: { id: (req.params.id as string), tenantId: (req as any).tenantId } });
  res.json({ message: 'Görev silindi.' });
}));

// --- CONTRACTS ---
app.get('/api/contracts', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const contracts = await prisma.contract.findMany({ where: { tenantId: (req as any).tenantId } });
  res.json(contracts);
}));

app.post('/api/contracts', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { signedDate, endDate, guaranteeExpiry, ...rest } = req.body;
  const contract = await prisma.contract.create({
    data: {
      ...rest,
      signedDate: signedDate ? new Date(signedDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      guaranteeExpiry: guaranteeExpiry ? new Date(guaranteeExpiry) : null,
      tenantId: (req as any).tenantId
    }
  });
  res.json(contract);
}));

app.put('/api/contracts/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { signedDate, endDate, guaranteeExpiry, ...rest } = req.body;
  const data = { ...rest };
  if (signedDate) data.signedDate = new Date(signedDate);
  if (endDate) data.endDate = new Date(endDate);
  if (guaranteeExpiry) data.guaranteeExpiry = new Date(guaranteeExpiry);
  const contract = await prisma.contract.update({
    where: { id: (req.params.id as string), tenantId: (req as any).tenantId },
    data
  });
  res.json(contract);
}));

app.delete('/api/contracts/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  await prisma.contract.delete({ where: { id: (req.params.id as string), tenantId: (req as any).tenantId } });
  res.json({ message: 'Sözleşme silindi.' });
}));

// --- ARCHIVE ITEMS ---
app.get('/api/archive', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const items = await prisma.archiveItem.findMany({ where: { tenantId: (req as any).tenantId } });
  res.json(items);
}));

app.post('/api/archive', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { date, tags, ...rest } = req.body;
  const item = await prisma.archiveItem.create({
    data: {
      ...rest,
      date: date ? new Date(date) : new Date(),
      tags: typeof tags === 'string' ? tags : JSON.stringify(tags || []),
      tenantId: (req as any).tenantId
    }
  });
  res.json(item);
}));

app.put('/api/archive/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { date, tags, ...rest } = req.body;
  const data = { ...rest };
  if (date) data.date = new Date(date);
  if (tags !== undefined) {
    data.tags = typeof tags === 'string' ? tags : JSON.stringify(tags);
  }
  const item = await prisma.archiveItem.update({
    where: { id: (req.params.id as string), tenantId: (req as any).tenantId },
    data
  });
  res.json(item);
}));

app.delete('/api/archive/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  await prisma.archiveItem.delete({ where: { id: (req.params.id as string), tenantId: (req as any).tenantId } });
  res.json({ message: 'Arşiv kaydı silindi.' });
}));

// --- NOTIFICATIONS ---
app.get('/api/notifications', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const notifications = await prisma.notification.findMany({ 
    where: { tenantId: (req as any).tenantId },
    orderBy: { timestamp: 'desc' }
  });
  res.json(notifications);
}));

app.post('/api/notifications', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const notification = await prisma.notification.create({
    data: { ...req.body, tenantId: (req as any).tenantId }
  });
  res.json(notification);
}));

app.put('/api/notifications/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const notification = await prisma.notification.update({
    where: { id: (req.params.id as string), tenantId: (req as any).tenantId },
    data: req.body
  });
  res.json(notification);
}));

app.delete('/api/notifications/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  await prisma.notification.delete({ where: { id: (req.params.id as string), tenantId: (req as any).tenantId } });
  res.json({ message: 'Bildirim silindi.' });
}));

// --- CORPORATE DOCUMENTS ---
app.get('/api/documents', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const docs = await prisma.corporateDocument.findMany({ where: { tenantId: (req as any).tenantId } });
  res.json(docs);
}));

app.post('/api/documents', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { expiryDate, tags, ...rest } = req.body;
  const doc = await prisma.corporateDocument.create({
    data: {
      ...rest,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      tags: typeof tags === 'string' ? tags : JSON.stringify(tags || []),
      tenantId: (req as any).tenantId
    }
  });
  res.json(doc);
}));

app.put('/api/documents/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { expiryDate, tags, ...rest } = req.body;
  const data = { ...rest };
  if (expiryDate) data.expiryDate = new Date(expiryDate);
  if (tags !== undefined) {
    data.tags = typeof tags === 'string' ? tags : JSON.stringify(tags);
  }
  const doc = await prisma.corporateDocument.update({
    where: { id: (req.params.id as string), tenantId: (req as any).tenantId },
    data
  });
  res.json(doc);
}));

app.delete('/api/documents/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  await prisma.corporateDocument.delete({ where: { id: (req.params.id as string), tenantId: (req as any).tenantId } });
  res.json({ message: 'Doküman silindi.' });
}));

// --- WORKFLOWS ---
app.get('/api/workflows', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const workflows = await prisma.workflow.findMany({ 
    where: { tenantId: (req as any).tenantId },
    include: { steps: { orderBy: { order: 'asc' } } }
  });
  res.json(workflows);
}));

app.post('/api/workflows', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, description, steps } = req.body;
  const workflow = await prisma.workflow.create({
    data: {
      name,
      description,
      tenantId: (req as any).tenantId,
      steps: {
        create: steps.map((step: any, index: number) => ({
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

app.put('/api/workflows/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { name, description, steps } = req.body;
  
  // Simple approach: Delete old steps and create new ones (transactional)
  const updatedWorkflow = await prisma.$transaction(async (tx) => {
    await tx.workflowStep.deleteMany({ where: { workflowId: (req.params.id as string) } });
    
    return tx.workflow.update({
      where: { id: (req.params.id as string), tenantId: (req as any).tenantId },
      data: {
        name,
        description,
        steps: {
          create: steps.map((step: any, index: number) => ({
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

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('[API Error]', err);
  res.status(err.status || 500).json({ 
    error: err.message || 'Sunucu hatası.',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.listen(port, () => {
  console.log(`[Enflow Backend] Server is running at http://localhost:${port}`);
});

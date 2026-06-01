import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { prisma } from './prismaClient';

dotenv.config();

const app = express();
const port = 3002;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));

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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/logs/notifications', (req, res) => {
  const { userId, timestamp, action } = req.body;
  const logMessage = `[${timestamp}] User ${userId} ${action}\n`;
  const logPath = path.join(process.cwd(), 'notifications_access.log');
  
  fs.appendFile(logPath, logMessage, (err) => {
    if (err) {
      console.error('Logging failed:', err);
      return res.status(500).json({ error: 'Logging failed' });
    }
    res.json({ success: true });
  });
});

app.get('/api/logs/notifications', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  // Only allow if user is an admin (simplified check for this mock env)
  const logPath = path.join(process.cwd(), 'notifications_access.log');
  
  if (!fs.existsSync(logPath)) {
    return res.json({ logs: [] });
  }

  fs.readFile(logPath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Read failed' });
    const logs = data.split('\n').filter(Boolean).map(line => {
      const match = line.match(/\[(.*?)\] User (.*?) (.*)/);
      return match ? { timestamp: match[1], userId: match[2], action: match[3] } : null;
    }).filter(Boolean);
    res.json({ logs: logs.reverse() }); // Newest first
  });
}));

// --- TENANTS ---
app.get('/api/tenants', asyncHandler(async (req: Request, res: Response) => {
  const tenants = await prisma.tenant.findMany({ orderBy: { name: 'asc' } });
  res.json(tenants);
}));

app.put('/api/tenants/:id/subscription', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = req.params.id;
  const { plan } = req.body; // STARTER, PROFESSIONAL, ENTERPRISE

  if (!['STARTER', 'PROFESSIONAL', 'ENTERPRISE'].includes(plan)) {
    return res.status(400).json({ error: 'Geçersiz plan tipi.' });
  }

  const subscription = await prisma.subscription.upsert({
    where: { tenantId: tenantId as string },
    update: { plan },
    create: { tenantId: tenantId as string, plan }
  });

  res.json(subscription);
}));

app.get('/api/subscription', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const subscription = await prisma.subscription.findUnique({ 
    where: { tenantId: (req as any).tenantId } 
  });
  res.json(subscription || { plan: 'STARTER' });
}));

app.get('/api/usage', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const period = new Date().toISOString().slice(0, 7);
  const usage = await prisma.usageMetric.findMany({ where: { tenantId, period } });
  res.json(usage);
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
  const tenantId = (req as any).tenantId;
  const id = req.params.id as string;

  const record = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const data: any = { name, email, role, unitId, status };
  if (permissions) {
    data.permissions = typeof permissions === 'string' ? permissions : JSON.stringify(permissions);
  }
  const user = await prisma.user.update({
    where: { id },
    data
  });
  res.json(user);
}));

app.delete('/api/users/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const id = req.params.id as string;

  const record = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.user.delete({ where: { id } });
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
  const tenantId = (req as any).tenantId;
  const id = req.params.id as string;

  const record = await prisma.customer.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const customer = await prisma.customer.update({
    where: { id },
    data: req.body
  });
  res.json(customer);
}));

app.delete('/api/customers/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const id = req.params.id as string;

  const record = await prisma.customer.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.customer.delete({ where: { id } });
  res.json({ message: 'Müşteri silindi.' });
}));

// --- OPPORTUNITIES ---
app.get('/api/opportunities', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const opps = await prisma.opportunity.findMany({ 
    where: { tenantId: (req as any).tenantId }, 
    include: { 
      customer: true, 
      assignedTo: true, 
      createdBy: true,
      bomItems: true,
      costItems: true
    } 
  });
  res.json(opps);
}));

app.post('/api/opportunities/:id/costs', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const opportunityId = req.params.id as string;
  const tenantId = (req as any).tenantId;
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
          amount: parseFloat(String(item.amount)) || 0
        }
      });
      created.push(createdItem);
    }
    return created;
  });
  res.json(result);
}));

app.post('/api/opportunities', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  console.log('[Backend] New Opportunity Request Body:', JSON.stringify(req.body, null, 2));
  console.log('[Backend] Tenant ID:', (req as any).tenantId);
  const { title, value, probability, customerId, assignedToId, description, expectedCloseDate, status } = req.body;
  const tenantId = (req as any).tenantId;
  
  if (!title || !customerId) {
    return res.status(400).json({ error: 'Başlık ve Müşteri seçimi zorunludur.' });
  }

  // Find a fallback user if assignedToId is missing or invalid
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
app.put('/api/opportunities/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { title, value, probability, customerId, description, status, expectedCloseDate, updatedBy } = req.body;
  const tenantId = (req as any).tenantId;
  const opportunityId = req.params.id as string;

  const oldOpp = await prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId } });
  if (!oldOpp) return res.status(404).json({ error: 'Fırsat bulunamadı.' });

  // Sadece modelde olan alanları içeren temiz bir data objesi kuruyoruz
  const updateData: any = {};
  if (title !== undefined) updateData.title = title;
  if (value !== undefined) updateData.value = parseFloat(value as string) || 0;
  if (probability !== undefined) updateData.probability = parseInt(probability as string) || 0;
  if (description !== undefined) updateData.description = description;
  if (status !== undefined) updateData.status = status;
  if (expectedCloseDate !== undefined) updateData.expectedCloseDate = new Date(expectedCloseDate);
  
  // İlişkisel alan (customerId) güncelleme
  if (customerId !== undefined) {
    updateData.customerId = customerId;
  }

  const updated = await prisma.opportunity.update({
    where: { id: opportunityId },
    data: updateData,
    include: { customer: true, assignedTo: true, createdBy: true }
  });

  await prisma.activityLog.create({
    data: {
      action: 'UPDATE',
      entityType: 'OPPORTUNITY',
      entityId: opportunityId,
      userId: updatedBy || updated.assignedToId,      tenantId,
      details: JSON.stringify({
        before: { title: oldOpp.title, value: oldOpp.value, status: oldOpp.status },
        after: { title: updated.title, value: updated.value, status: updated.status }
      })
    }
  });

  res.json(updated);
}));

// --- BOM ITEMS ---
app.post('/api/opportunities/:id/bom', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const opportunityId = req.params.id as string;
  const { items } = req.body;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Geçersiz BoM listesi.' });
  }

  // Transaction: Delete existing and create new in one go
  const result = await prisma.$transaction(async (tx) => {
    // 1. Eski kalemleri sil
    await tx.boMItem.deleteMany({ where: { opportunityId } });

    // 2. Yeni kalemleri oluştur
    const created = [];
    for (const item of items) {
      const qty = parseInt(String(item.qty || item.quantity)) || 0;
      const cost = parseFloat(String(item.cost || item.purchaseCost)) || 0;
      const margin = parseFloat(String(item.margin || item.marginPercentage)) || 15;

      const newItem = await tx.boMItem.create({
        data: {
          opportunityId,
          partNumber: String(item.pn || item.partNumber || 'N/A'),
          description: String(item.desc || item.description || ''),
          quantity: qty,
          purchaseCost: cost,
          marginPercentage: margin,
          vendor: String(item.vendor || '')
        }
      });
      created.push(newItem);
    }
    return created;
  });

  res.json(result);
}));

// --- WORKFLOW & APPROVALS ---
app.post('/api/opportunities/:id/request-approval', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const opportunityId = req.params.id as string;
  const tenantId = (req as any).tenantId;
  const { note, managerId } = req.body;

  const record = await prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const opp = await prisma.opportunity.update({
    where: { id: opportunityId },
    data: { technicalStatus: 'WAITING_APPROVAL' }
  });

  // Yöneticiye görev oluştur (Yönetim birimini bul)
  const managementUnit = await prisma.unit.findFirst({ 
    where: { 
      tenantId,
      name: { contains: 'Yönetim' } 
    } 
  });

  await prisma.todoTask.create({
    data: {
      title: `Teklif Onayı: ${opp.title}`,
      description: note || 'Teklif incelenip onaylanmayı bekliyor.',
      unitId: managementUnit?.id || 'system', // Fallback to system if not found
      assignedBy: opp.assignedToId,
      tenantId,
      relatedModule: 'OPPORTUNITY',
      relatedItemId: opportunityId,
      priority: 'HIGH',
      status: 'PENDING'
    }
  });

  // Log tut
  await prisma.workflowLog.create({
    data: {
      fromUnitId: 'u2', // Presales (Can be made dynamic later)
      toUnitId: managementUnit?.id || 'u4',
      assignedBy: opp.assignedToId,
      assignedTo: managerId || 'system',
      note: note || 'Onaya sunuldu.',
      opportunityId,
      status: 'PENDING'
    }
  });

  res.json({ message: 'Teklif onay sürecine gönderildi.' });
}));

app.post('/api/opportunities/:id/approve', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const opportunityId = req.params.id as string;
  const tenantId = (req as any).tenantId;
  const { note } = req.body;

  const record = await prisma.opportunity.findFirst({ where: { id: opportunityId, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const updated = await prisma.opportunity.update({
    where: { id: opportunityId },
    data: { 
      technicalStatus: 'APPROVED',
      status: 'PROPOSAL' // Artık teklif aşamasında
    }
  });

  // Logu güncelle
  await prisma.workflowLog.updateMany({
    where: { opportunityId, status: 'PENDING' },
    data: { status: 'APPROVED', note: note || 'Onaylandı.' }
  });

  res.json(updated);
}));

// --- PROJECTS ---
app.post('/api/opportunities/:id/revert-approval', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const opportunityId = req.params.id as string;
  const tenantId = (req as any).tenantId;

  const updated = await prisma.opportunity.update({
    where: { id: opportunityId },
    data: { 
      technicalStatus: 'PENDING'
    }
  });

  // Opsiyonel: Mevcut onay görevlerini iptal et veya log düş
  await prisma.activityLog.create({
    data: {
      action: 'REVERT_APPROVAL',
      entityType: 'OPPORTUNITY',
      entityId: opportunityId,
      userId: (req as any).userId || 'system',
      tenantId,
      details: JSON.stringify({ message: 'Teknik onay kullanıcı tarafından geri çekildi.' })
    }
  });

  res.json(updated);
}));

app.get('/api/projects', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const projects = await prisma.project.findMany({ 
    where: { tenantId: (req as any).tenantId }
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
  const tenantId = (req as any).tenantId;
  const id = req.params.id as string;

  const record = await prisma.project.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const data = { ...rest };
  if (deadline) data.deadline = new Date(deadline);
  if (procurementNotes !== undefined) {
    data.procurementNotes = typeof procurementNotes === 'string' ? procurementNotes : JSON.stringify(procurementNotes);
  }
  const project = await prisma.project.update({
    where: { id },
    data
  });
  res.json(project);
}));

app.delete('/api/projects/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const id = req.params.id as string;

  const record = await prisma.project.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.project.delete({ where: { id } });
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
  const tenantId = (req as any).tenantId;
  const id = req.params.id as string;

  const record = await prisma.todoTask.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const data = { ...rest };
  if (dueDate) data.dueDate = new Date(dueDate);
  if (progressNotes !== undefined) {
    data.progressNotes = typeof progressNotes === 'string' ? progressNotes : JSON.stringify(progressNotes);
  }
  const task = await prisma.todoTask.update({
    where: { id },
    data
  });
  res.json(task);
}));

app.delete('/api/tasks/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const id = req.params.id as string;

  const record = await prisma.todoTask.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.todoTask.delete({ where: { id } });
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
  const tenantId = (req as any).tenantId;
  const id = req.params.id as string;

  const record = await prisma.contract.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const data = { ...rest };
  if (signedDate) data.signedDate = new Date(signedDate);
  if (endDate) data.endDate = new Date(endDate);
  if (guaranteeExpiry) data.guaranteeExpiry = new Date(guaranteeExpiry);
  const contract = await prisma.contract.update({
    where: { id },
    data
  });
  res.json(contract);
}));

app.delete('/api/contracts/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const id = req.params.id as string;

  const record = await prisma.contract.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.contract.delete({ where: { id } });
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
  const tenantId = (req as any).tenantId;
  const id = req.params.id as string;

  const record = await prisma.archiveItem.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const data = { ...rest };
  if (date) data.date = new Date(date);
  if (tags !== undefined) {
    data.tags = typeof tags === 'string' ? tags : JSON.stringify(tags);
  }
  const item = await prisma.archiveItem.update({
    where: { id },
    data
  });
  res.json(item);
}));

app.delete('/api/archive/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const id = req.params.id as string;

  const record = await prisma.archiveItem.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.archiveItem.delete({ where: { id } });
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
  const tenantId = (req as any).tenantId;
  const id = req.params.id as string;

  const record = await prisma.notification.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const notification = await prisma.notification.update({
    where: { id },
    data: req.body
  });
  res.json(notification);
}));

app.delete('/api/notifications/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const id = req.params.id as string;

  const record = await prisma.notification.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.notification.delete({ where: { id } });
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
  const tenantId = (req as any).tenantId;
  const id = req.params.id as string;

  const record = await prisma.corporateDocument.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const data = { ...rest };
  if (expiryDate) data.expiryDate = new Date(expiryDate);
  if (tags !== undefined) {
    data.tags = typeof tags === 'string' ? tags : JSON.stringify(tags);
  }
  const doc = await prisma.corporateDocument.update({
    where: { id },
    data
  });
  res.json(doc);
}));

app.delete('/api/documents/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const id = req.params.id as string;

  const record = await prisma.corporateDocument.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.corporateDocument.delete({ where: { id } });
  res.json({ message: 'Doküman silindi.' });
}));

// --- PROPOSALS ---
app.get('/api/proposals', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const proposals = await prisma.proposal.findMany({ 
    where: { tenantId: (req as any).tenantId },
    include: { opportunity: { include: { customer: true } } }
  });
  res.json(proposals);
}));

app.post('/api/proposals', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { opportunityId, status, content, ...rest } = req.body;
  const tenantId = (req as any).tenantId;

  if (!opportunityId) {
    return res.status(400).json({ error: 'Fırsat seçimi zorunludur.' });
  }

  // Find the latest version for this opportunity
  const latestProposal = await prisma.proposal.findFirst({
    where: { opportunityId, tenantId },
    orderBy: { version: 'desc' }
  });

  const nextVersion = latestProposal ? latestProposal.version + 1 : 1;

  // If content is not explicitly provided, use the rest of the body as content
  const proposalContent = content || rest;

  const proposal = await prisma.proposal.create({
    data: {
      opportunityId,
      content: typeof proposalContent === 'string' ? proposalContent : JSON.stringify(proposalContent),
      status: status || 'DRAFT',
      version: nextVersion,
      tenantId
    },
    include: { opportunity: { include: { customer: true } } }
  });

  // If status is SENT or similar, update opportunity status
  if (status === 'SENT' || status === 'ACCEPTED') {
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: 'PROPOSAL' }
    });
  } else if (proposalContent && (proposalContent.openForNegotiation === true || proposalContent.openForNegotiation === 'true')) {
    await prisma.opportunity.update({
      where: { id: opportunityId },
      data: { status: 'NEGOTIATION' }
    });
  }

  res.json(proposal);
}));

app.put('/api/proposals/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const { content, status } = req.body;
  const tenantId = (req as any).tenantId;
  const id = req.params.id as string;

  const record = await prisma.proposal.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  const data: any = {};
  if (content) data.content = typeof content === 'string' ? content : JSON.stringify(content);
  if (status) data.status = status;

  const proposal = await prisma.proposal.update({
    where: { id },
    data,
    include: { opportunity: { include: { customer: true } } }
  });

  res.json(proposal);
}));

app.delete('/api/proposals/:id', tenantMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const tenantId = (req as any).tenantId;
  const id = req.params.id as string;

  const record = await prisma.proposal.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });

  await prisma.proposal.delete({ where: { id } });
  res.json({ message: 'Teklif silindi.' });
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
  const tenantId = (req as any).tenantId;
  const id = req.params.id as string;

  const record = await prisma.workflow.findFirst({ where: { id, tenantId } });
  if (!record) return res.status(404).json({ error: 'Yetkisiz erişim' });
  
  // Simple approach: Delete old steps and create new ones (transactional)
  const updatedWorkflow = await prisma.$transaction(async (tx) => {
    await tx.workflowStep.deleteMany({ where: { workflowId: id } });
    
    return tx.workflow.update({
      where: { id },
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
  console.error('[API Error Detail]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Dahili Sunucu Hatası',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.listen(port, () => {
  console.log(`[Enflow Backend] Server is running at http://localhost:${port}`);
});

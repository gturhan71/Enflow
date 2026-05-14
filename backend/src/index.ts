import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'file:./dev.db';
const libsql = createClient({
  url: connectionString,
});
const adapter = new PrismaLibSql({ client: libsql });
const prisma = new PrismaClient({ adapter });

const app = express();
const port = 3002;

app.use(express.json());
app.use(cors());

// Middleware: Tenant Isolation
const tenantMiddleware = async (req: Request, res: Response, next: any) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) {
    return res.status(400).json({ error: 'x-tenant-id header is required' });
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    return res.status(404).json({ error: 'Tenant not found' });
  }
  (req as any).tenantId = tenantId;
  next();
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- TENANTS ---
app.get('/api/tenants', async (req, res) => {
  const tenants = await prisma.tenant.findMany({ orderBy: { name: 'asc' } });
  res.json(tenants);
});

// --- AUTH ---
app.post('/api/auth/login', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { email }, include: { tenant: true } });
    if (!user) return res.status(401).json({ error: 'Geçersiz bilgiler.' });
    res.json({ user, token: 'mock-jwt-token' });
  } catch (error) {
    res.status(500).json({ error: 'Login hatası.' });
  }
});

// --- UNITS ---
app.get('/api/units', tenantMiddleware, async (req, res) => {
  const units = await prisma.unit.findMany({ where: { tenantId: (req as any).tenantId }, include: { users: true } });
  res.json(units);
});

app.post('/api/units', tenantMiddleware, async (req, res) => {
  const { name, description, managerId } = req.body;
  const unit = await prisma.unit.create({
    data: { name, description, managerId, tenantId: (req as any).tenantId }
  });
  res.json(unit);
});

// --- USERS ---
app.post('/api/users', tenantMiddleware, async (req, res) => {
  const { name, email, role, unitId, permissions, tenantId } = req.body;
  try {
    const user = await prisma.user.create({
      data: {
        name, email, role, unitId: unitId || null,
        tenantId: tenantId || (req as any).tenantId,
        permissions: JSON.stringify(permissions || ['DASHBOARD_VIEW']),
        status: 'ACTIVE'
      }
    });
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: 'Kullanıcı oluşturulamadı.', details: error.message });
  }
});

app.delete('/api/users/:id', tenantMiddleware, async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ message: 'Kullanıcı silindi.' });
  } catch (error) {
    res.status(400).json({ error: 'Silinemedi.' });
  }
});

// --- CUSTOMERS ---
app.get('/api/customers', tenantMiddleware, async (req, res) => {
  const customers = await prisma.customer.findMany({ where: { tenantId: (req as any).tenantId }, orderBy: { name: 'asc' } });
  res.json(customers);
});

app.post('/api/customers', tenantMiddleware, async (req, res) => {
  const customer = await prisma.customer.create({ data: { ...req.body, tenantId: (req as any).tenantId } });
  res.json(customer);
});

// --- OPPORTUNITIES ---
app.get('/api/opportunities', tenantMiddleware, async (req, res) => {
  const opps = await prisma.opportunity.findMany({ where: { tenantId: (req as any).tenantId }, include: { customer: true, assignedTo: true } });
  res.json(opps);
});

app.post('/api/opportunities', tenantMiddleware, async (req, res) => {
  const { title, value, probability, customerId, assignedToId, description } = req.body;
  const opp = await prisma.opportunity.create({
    data: {
      title, value, probability, customerId, assignedToId, description,
      createdById: assignedToId, // Default same as assigned for now
      tenantId: (req as any).tenantId,
      status: 'NEW'
    }
  });
  res.json(opp);
});

// --- PROJECTS ---
app.get('/api/projects', tenantMiddleware, async (req, res) => {
  const projects = await prisma.project.findMany({ where: { tenantId: (req as any).tenantId } });
  res.json(projects);
});

app.listen(port, () => {
  console.log(`[Enflow Backend] Server is running at http://localhost:${port}`);
});

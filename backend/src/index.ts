import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'file:./dev.db';
const adapter = new PrismaLibSql({
  url: connectionString,
});
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

// Tenant Routes
app.get('/api/tenants', async (req, res) => {
  const tenants = await prisma.tenant.findMany({
    orderBy: { name: 'asc' }
  });
  res.json(tenants);
});

app.post('/api/auth/login', async (req, res) => {
  const { email } = req.body;
  try {
    const user = await prisma.user.findUnique({ 
      where: { email },
      include: { tenant: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Geçersiz bilgiler.' });
    }

    res.json({ user, token: 'mock-jwt-token' });
  } catch (error) {
    res.status(500).json({ error: 'Login hatası.' });
  }
});

app.get('/api/units', tenantMiddleware, async (req, res) => {
  const units = await prisma.unit.findMany({
    where: { tenantId: (req as any).tenantId },
    include: { users: true }
  });
  res.json(units);
});

// Customer Routes
app.get('/api/customers', tenantMiddleware, async (req, res) => {
  const customers = await prisma.customer.findMany({
    where: { tenantId: (req as any).tenantId },
    orderBy: { name: 'asc' }
  });
  res.json(customers);
});

app.post('/api/customers', tenantMiddleware, async (req, res) => {
  const data = req.body;
  try {
    const customer = await prisma.customer.create({
      data: {
        ...data,
        tenantId: (req as any).tenantId
      }
    });
    res.json(customer);
  } catch (error: any) {
    res.status(400).json({ error: 'Müşteri oluşturulamadı.' });
  }
});

app.put('/api/customers/:id', tenantMiddleware, async (req, res) => {
  const id = req.params.id as string;
  const data = req.body;
  try {
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...data,
        tenantId: (req as any).tenantId
      }
    });
    res.json(customer);
  } catch (error: any) {
    res.status(400).json({ error: 'Müşteri güncellenemedi.' });
  }
});

// User Routes
app.post('/api/users', tenantMiddleware, async (req, res) => {
  const { name, email, role, unitId, permissions, tenantId } = req.body;
  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        role,
        unitId: unitId || null,
        tenantId: tenantId || (req as any).tenantId,
        permissions: JSON.stringify(permissions || ['DASHBOARD_VIEW']),
        status: 'ACTIVE'
      }
    });
    res.json(user);
  } catch (error: any) {
    console.error('[Prisma Error]:', error);
    res.status(400).json({ 
      error: 'Kullanıcı oluşturulamadı.',
      details: error.message 
    });
  }
});

app.delete('/api/users/:id', tenantMiddleware, async (req, res) => {
  const id = req.params.id as string;
  try {
    await prisma.user.delete({
      where: { id }
    });
    res.json({ message: 'Kullanıcı başarıyla silindi.' });
  } catch (error: any) {
    res.status(400).json({ error: 'Kullanıcı silinemedi.' });
  }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    return res.status(404).json({ error: 'Bu e-posta adresiyle kayıtlı bir kullanıcı bulunamadı.' });
  }
  
  res.json({ message: 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.' });
});

app.listen(port, () => {
  console.log(`[Enflow Backend] Server is running at http://localhost:${port}`);
});

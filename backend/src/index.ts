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
const port = process.env.PORT || 3001;

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

app.post('/api/auth/login', async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ 
    where: { email },
    include: { tenant: true }
  });

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({ user, token: 'mock-jwt-token' });
});

app.get('/api/units', tenantMiddleware, async (req, res) => {
  const units = await prisma.unit.findMany({
    where: { tenantId: (req as any).tenantId },
    include: { users: true }
  });
  res.json(units);
});

// User Routes
app.post('/api/users', tenantMiddleware, async (req, res) => {
  const { name, email, role, unitId, permissions } = req.body;
  try {
    const user = await prisma.user.create({
      data: {
        name,
        email,
        role,
        unitId,
        tenantId: (req as any).tenantId,
        permissions: JSON.stringify(permissions || ['DASHBOARD_VIEW']),
        status: 'ACTIVE'
      }
    });
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ error: 'Kullanıcı oluşturulamadı. E-posta zaten kullanımda olabilir.' });
  }
});

// Forgot Password Route
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    return res.status(404).json({ error: 'Bu e-posta adresiyle kayıtlı bir kullanıcı bulunamadı.' });
  }

  // Simulating email sending via Exchange service
  console.log(`[Backend] Reset link sent to ${email}`);
  
  res.json({ message: 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.' });
});

app.listen(port, () => {
  console.log(`[Enflow Backend] Server is running at http://localhost:${port}`);
});

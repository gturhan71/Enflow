/// <reference path="./types/express.d.ts" />
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import logsRouter from './routes/logs';
import authRouter from './routes/auth';
import tenantsRouter from './routes/tenants';
import subscriptionRouter from './routes/subscription';
import unitsRouter from './routes/units';
import usersRouter from './routes/users';
import customersRouter from './routes/customers';
import opportunitiesRouter from './routes/opportunities';
import syncRouter from './routes/sync';
import projectsRouter from './routes/projects';
import tasksRouter from './routes/tasks';
import contractsRouter from './routes/contracts';
import archiveRouter from './routes/archive';
import notificationsRouter from './routes/notifications';
import documentsRouter from './routes/documents';
import proposalsRouter from './routes/proposals';
import workflowsRouter from './routes/workflows';

dotenv.config();

const app = express();
const port = 3002;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5174'],
  credentials: true
}));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/logs/notifications', logsRouter);
app.use('/api/auth', authRouter);
app.use('/api/tenants', tenantsRouter);
app.use('/api', subscriptionRouter);
app.use('/api/units', unitsRouter);
app.use('/api/users', usersRouter);
app.use('/api/customers', customersRouter);
app.use('/api/opportunities', opportunitiesRouter);
app.use('/api/sync', syncRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/archive', archiveRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/proposals', proposalsRouter);
app.use('/api/workflows', workflowsRouter);

app.use((err: { status?: number; message?: string; stack?: string }, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[API Error Detail]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Dahili Sunucu Hatası',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

app.listen(port, () => {
  console.log(`[Enflow Backend] Server is running at http://localhost:${port}`);
});

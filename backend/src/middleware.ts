import { Request, Response, NextFunction } from 'express';
import { prisma } from './prismaClient';

// eslint-disable-next-line @typescript-eslint/ban-types
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const tenantMiddleware = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) return res.status(400).json({ error: 'x-tenant-id header is required' });

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  req.tenantId = tenantId;
  next();
});

export const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> => {
  try {
    return await fn();
  } catch (error: unknown) {
    const e = error as { code?: string; message?: string };
    if (e.code === 'P2028' || e.code === 'P2034' || e.message?.includes('database is locked')) {
      if (retries > 0) {
        console.warn(`[DB Lock] Retrying operation... ${retries} attempts left.`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return withRetry(fn, retries - 1, delay * 2);
      }
    }
    throw error;
  }
};

import { Request, Response, NextFunction } from 'express';
import { prisma } from './prismaClient';

// eslint-disable-next-line @typescript-eslint/ban-types
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const tenantMiddleware = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  if (!tenantId) return res.status(400).json({ error: 'x-tenant-id header zorunludur.' });

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) return res.status(404).json({ error: 'Tenant bulunamadı.' });

  // IDOR Koruması: token'dan kullanıcı kimliğini çöz, tenant eşleşmesini doğrula.
  // Token format: base64(userId) — auth route tarafından üretilir.
  const authHeader = req.headers['authorization'] as string | undefined;
  const token = authHeader?.replace('Bearer ', '').trim();

  if (token) {
    try {
      const userId = Buffer.from(token, 'base64').toString('utf-8');
      // Çözülen string'in gerçek bir kullanıcı ID'si olup olmadığını kontrol et.
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, tenantId: true, role: true } });
      if (user) {
        if (user.tenantId !== tenantId) {
          return res.status(403).json({ error: 'Bu tenant\'a erişim yetkiniz yok.' });
        }
        req.userId = user.id;
        req.userRole = user.role;
      }
    } catch { /* geçersiz base64 — kimlik doğrulamasız devam */ }
  }

  req.tenantId = tenantId;
  next();
});

// Salt-okunur roller: hiçbir modülde/veride mutasyon yapamaz.
// BACKUP_ADMIN tüm akışa dahil (GET) ama yalnız /api/backup altında yazabilir.
// App-düzeyinde (router'lardan ÖNCE) mount edilir; rolü token'dan kendisi çözer
// (yalnız mutasyon isteklerinde DB'ye bakar → ek yük minimal).
const READ_ONLY_ROLES = new Set(['BACKUP_ADMIN']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const enforceReadOnlyRoles = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const p = req.path || req.url || '';
  // Yedek/restore + oturum muaf
  if (p.startsWith('/api/backup') || p.startsWith('/backup') || p.startsWith('/api/auth') || p.startsWith('/auth')) return next();

  const token = (req.headers['authorization'] as string | undefined)?.replace('Bearer ', '').trim();
  if (!token) return next();
  let role: string | undefined;
  try {
    const userId = Buffer.from(token, 'base64').toString('utf-8');
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    role = user?.role;
  } catch { /* geçersiz token — guard atlanır, ilgili route kendi auth'unu uygular */ }

  if (role && READ_ONLY_ROLES.has(role)) {
    return res.status(403).json({ error: 'Salt-okunur rol: bu işlem için değişiklik yetkiniz yok (yalnız yedekleme).' });
  }
  next();
});

// Rol koruması: yalnızca izin verilen rollere sahip kullanıcılar geçer.
export const requireRole = (allowed: string[]) =>
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.userId) return res.status(401).json({ error: 'Kimlik doğrulama gerekli.' });
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { role: true } });
    if (!user || !allowed.includes(user.role)) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
    }
    next();
  });

// Eklenti/lisans koruması: modül ayrı lisanslıysa (PLUGIN_CATALOG) entitlement zorunlu.
// Lisans yoksa 402 (Payment Required — upsell sinyali). Tek kaynak: isPluginEntitled.
export const requireEntitlement = (pluginKey: string) =>
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { isPluginEntitled } = await import('./services/entitlementService');
    if (!(await isPluginEntitled(req.tenantId, pluginKey))) {
      return res.status(402).json({ error: `Bu modül için lisans (${pluginKey}) gerekli.`, plugin: pluginKey });
    }
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

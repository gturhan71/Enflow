import { Request, Response, NextFunction } from 'express';
import { prisma } from './prismaClient';
import { verifyAuthToken } from './services/auth';
import { logger } from './utils/logger';

// eslint-disable-next-line @typescript-eslint/ban-types
export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

function bearerToken(req: Request): string | undefined {
  const h = req.headers['authorization'] as string | undefined;
  if (!h || !h.startsWith('Bearer ')) return undefined;
  const t = h.slice(7).trim();
  return t || undefined;
}

// Kimlik doğrulama + tenant izolasyonu. İmzalı JWT ZORUNLU.
// Tenant kimliği yalnız TOKEN'dan (imzalı `tid`) türetilir — x-tenant-id header'ı
// yalnızca doğrulama içindir; uyuşmazlık 403. Böylece header-spoofing ile
// çapraz-tenant erişim (IDOR) kapatılır.
export const tenantMiddleware = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Kimlik doğrulama gerekli.' });

  const payload = verifyAuthToken(token);
  if (!payload) return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş oturum.' });

  // Kullanıcı hâlâ mevcut ve aktif mi? (token iptali/rol değişimi için canlı kontrol)
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, tenantId: true, role: true, status: true },
  });
  if (!user || user.status !== 'ACTIVE' || user.tenantId !== payload.tid) {
    return res.status(401).json({ error: 'Oturum geçersiz.' });
  }

  // İstemci x-tenant-id gönderdiyse token ile eşleşmeli (defans katmanı).
  const headerTenant = req.headers['x-tenant-id'] as string | undefined;
  if (headerTenant && headerTenant !== user.tenantId) {
    return res.status(403).json({ error: 'Bu tenant\'a erişim yetkiniz yok.' });
  }

  req.userId = user.id;
  req.userRole = user.role;
  req.tenantId = user.tenantId; // yetkili kaynak: imzalı token → DB doğrulaması
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

  const token = bearerToken(req);
  if (!token) return next();
  // İmzalı JWT'den rolü al (payload). Geçersiz token → guard atlanır, ilgili
  // route kendi auth'unu (tenantMiddleware) uygular.
  const role = verifyAuthToken(token)?.role;

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
        logger.warn(`[DB Lock] Retrying operation... ${retries} attempts left.`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return withRetry(fn, retries - 1, delay * 2);
      }
    }
    throw error;
  }
};

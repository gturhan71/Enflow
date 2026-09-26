// CSP ihlal raporu alıcısı (P0-3). Tarayıcı `report-uri` ile buraya POST eder; KİMLİKSİZ olmak zorunda
// (tarayıcı çerez/başlık eklemez) → kötüye kullanıma karşı: küçük gövde, hız sınırı, yalnız log satırı
// (DB'ye yazmaz, yanıt gövdesi yok). Loglar `[csp]` önekiyle → beklenmeyen bir modül ihlali izlenebilir.
import { Router, json, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger';

const router: Router = Router();

const limiter = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: true, legacyHeaders: false });
const parse = json({ type: ['application/csp-report', 'application/reports+json', 'application/json'], limit: '8kb' });

const clip = (v: unknown, n = 200) => (typeof v === 'string' ? v.slice(0, n) : undefined);

router.post('/', limiter, parse, (req: Request, res: Response) => {
  const raw = (req.body ?? {}) as Record<string, unknown>;
  const r = (raw['csp-report'] ?? raw) as Record<string, unknown>;
  logger.warn('[csp] ihlal', {
    directive: clip(r['violated-directive'] ?? r['effectiveDirective']),
    blocked: clip(r['blocked-uri'] ?? r['blockedURL'], 300),
    document: clip(r['document-uri'] ?? r['documentURL'], 300),
    source: clip(r['source-file'] ?? r['sourceFile'], 300),
    line: typeof r['line-number'] === 'number' ? r['line-number'] : undefined,
  });
  res.status(204).end();
});

export default router;

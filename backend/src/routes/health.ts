// /api/health — canlılık + hazırlık (ADR-001). Servis yöneticisi, upgrade-tool
// (yükseltme sonrası doğrulama) ve CI postgres job'u bunu yoklar. Kimlik
// doğrulamasız → hassas veri DÖNMEZ (yalnız durum, sürüm, çalışma süresi).
// DB `SELECT 1` 2 sn içinde yanıt vermezse 503 — süreç ayakta ama hizmet veremiyor.
import { Router } from 'express';
import fs from 'fs';
import path from 'path';

export interface HealthDeps {
  pingDb: () => Promise<unknown>;
  timeoutMs?: number;
  version?: string;
}

function readVersion(): string {
  try {
    // src/routes ve dist/routes aynı derinlikte → backend/package.json
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8')) as { version?: string };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function checkDb(pingDb: () => Promise<unknown>, timeoutMs: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); });
  try {
    await Promise.race([pingDb(), timeout]);
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function createHealthRouter(deps: HealthDeps): Router {
  const router = Router();
  const version = deps.version ?? readVersion();
  router.get('/', async (_req, res) => {
    const dbOk = await checkDb(deps.pingDb, deps.timeoutMs ?? 2000);
    res.status(dbOk ? 200 : 503).json({
      status: dbOk ? 'ok' : 'degraded',
      db: dbOk ? 'ok' : 'down',
      version,
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });
  return router;
}

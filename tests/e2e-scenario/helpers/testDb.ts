import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = fileURLToPath(new URL('.', import.meta.url));
export const BACKEND_DIR = join(HERE, '..', '..', '..', 'backend');
const TMP_DB_DIR = join(HERE, '..', '.tmp-db');

/**
 * Her senaryo dosyasi icin tek kullanimlik, izole bir SQLite dosyasi hazirlar.
 * DEV tenant-1 veritabanina (backend/dev.db) ASLA dokunulmaz — ayri bir dosya.
 * `databaseUrl` KASITLI olarak MUTLAK yoldur — goreceli bir `file:../..` yolu,
 * onu acan process'in cwd'sine gore FARKLI cozulur (spawn edilen backend cwd=
 * backend/, ama bu fonksiyonu cagiran vitest process'inin cwd'si tests/e2e-scenario/
 * — ayni string iki farkli dosyaya isaret ederdi). Mutlak yol bu belirsizligi ortadan kaldirir.
 */
export function createIsolatedTestDb(label: string): { absPath: string; databaseUrl: string } {
  if (!existsSync(TMP_DB_DIR)) mkdirSync(TMP_DB_DIR, { recursive: true });
  const fileName = `${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.db`;
  const absPath = join(TMP_DB_DIR, fileName);
  const databaseUrl = `file:${absPath}`;

  const push = spawnSync('npx', ['prisma', 'db', 'push', '--accept-data-loss'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    encoding: 'utf-8',
  });
  if (push.status !== 0) {
    throw new Error(`[testDb] prisma db push basarisiz (${label}):\n${push.stdout}\n${push.stderr}`);
  }

  return { absPath, databaseUrl };
}

export function destroyTestDb(absPath: string) {
  for (const suffix of ['', '-shm', '-wal']) {
    try { rmSync(absPath + suffix); } catch { /* zaten yoksa yut */ }
  }
}

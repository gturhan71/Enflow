// Enflow — SQLite → PostgreSQL geçiş aracı (tenant büyüdüğünde tek-dosya/tek-yazar
// kısıtından çıkış).
// ─────────────────────────────────────────────────────────────────────────────
// Kullanım: pnpm migrate:to-postgres  (backend/ içinde; ts-node --transpile-only)
//
// Akış: kaynağın SQLite olduğunu doğrula → hedef Postgres bilgisi al (+ opsiyonel
// otomatik rol/DB provizyon) → güvenlik snapshot (runBackup) → tüm platformu
// belleğe export et (exportLogicalData) → schema.prisma provider'ı postgresql'e
// çevir + `prisma db push` (boş şema) → ayrı bir PrismaClient ile hedefe yükle
// (loadModelsIntoTarget — restoreService.ts, döngüsel FK'ları Postgres-güvenli
// null+geri-yazma ile halleder) → model-bazlı satır sayısı doğrulaması →
// yalnız DOĞRULAMA geçerse backend/.env DATABASE_URL güncellenir.
//
// Güvenlik: kaynak `dev.db` hiçbir adımda değiştirilmez (yalnız okunur). Herhangi
// bir adım başarısız olursa schema.prisma sqlite'a geri alınır + yeniden generate
// edilir — repo her zaman çalışır SQLite durumuna döner, .env'e asla yarım-başarılı
// durumda dokunulmaz. `backend/uploads/` fiziksel dosyaları DB dışında yaşar,
// bu araçtan etkilenmez.

import { createInterface } from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { prisma as sourcePrisma } from '../prismaClient';
import { detectProvider, exportLogicalData, runBackup } from '../services/backupService';

const REPO_ROOT = resolve(__dirname, '../../..');
const BACKEND_DIR = join(REPO_ROOT, 'backend');
const SCHEMA_PATH = join(BACKEND_DIR, 'prisma', 'schema.prisma');
const ENV_PATH = join(BACKEND_DIR, '.env');
const isWin = process.platform === 'win32';

const log = (m = '') => console.log(m);
const ok = (m: string) => log(`✓ ${m}`);
const warn = (m: string) => log(`⚠ ${m}`);
const err = (m: string) => log(`✗ ${m}`);

const rl = createInterface({ input: process.stdin, output: process.stdout });
async function ask(q: string, def = ''): Promise<string> {
  const a = (await rl.question(`? ${q}${def ? ` [${def}]` : ''}: `)).trim();
  return a || def;
}
async function askYN(q: string, def = false): Promise<boolean> {
  const a = (await rl.question(`? ${q} (${def ? 'E/h' : 'e/H'}): `)).trim().toLowerCase();
  if (!a) return def;
  return ['e', 'y', 'evet', 'yes'].includes(a);
}

// ── schema.prisma provider anahtarlama (install/wizard.mjs ile aynı desen —
// install/ düz Node ESM, backend/ ts-node; iki farklı çalışma zamanı arasında
// paylaşılan modül kurmanın karmaşıklığı bu ~10 satırı ortak modüle çıkarmaya değmez) ──
function setSchemaProvider(provider: 'sqlite' | 'postgresql') {
  const s = readFileSync(SCHEMA_PATH, 'utf-8');
  const next = s.replace(/(datasource\s+db\s*\{[^}]*?provider\s*=\s*")(sqlite|postgresql)(")/s, `$1${provider}$3`);
  if (next !== s) writeFileSync(SCHEMA_PATH, next);
}
function prismaCli(args: string[], databaseUrl: string) {
  const r = spawnSync('pnpm', ['prisma', ...args], {
    cwd: BACKEND_DIR, stdio: 'inherit', shell: isWin,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  if (r.status !== 0) throw new Error(`prisma ${args.join(' ')} başarısız (exit ${r.status}).`);
}

// ── Postgres provizyon yardımcıları (install/wizard.mjs'den — sunucu zaten var
// varsayımıyla küçültülmüş: winget/brew otomatik kurulum YOK, yalnız rol+DB) ──
function commandExists(cmd: string): boolean {
  return spawnSync(isWin ? 'where' : 'which', [cmd], { shell: isWin }).status === 0;
}
function psql(admin: { host: string; port: string; user: string; pass: string }, command: string, db = 'postgres') {
  return spawnSync('psql', ['-h', admin.host, '-p', admin.port, '-U', admin.user, '-d', db, '-v', 'ON_ERROR_STOP=1', '-c', command], {
    encoding: 'utf-8', shell: isWin, env: { ...process.env, PGPASSWORD: admin.pass },
  });
}
function pgReachable(admin: { host: string; port: string; user: string; pass: string }): boolean {
  return psql(admin, 'SELECT 1;').status === 0;
}
function provisionPostgresDb(admin: { host: string; port: string; user: string; pass: string }, target: { db: string; appUser: string; appPass: string }): boolean {
  const esc = (v: string) => v.replace(/'/g, "''");
  psql(admin, `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${esc(target.appUser)}') THEN CREATE ROLE "${target.appUser}" WITH LOGIN PASSWORD '${esc(target.appPass)}'; END IF; END $$;`);
  psql(admin, `ALTER ROLE "${target.appUser}" WITH LOGIN PASSWORD '${esc(target.appPass)}';`);
  const exists = (psql(admin, `SELECT 1 FROM pg_database WHERE datname='${esc(target.db)}';`).stdout || '').includes('1');
  if (!exists) psql(admin, `CREATE DATABASE "${target.db}" OWNER "${target.appUser}";`);
  return psql(admin, `GRANT ALL PRIVILEGES ON DATABASE "${target.db}" TO "${target.appUser}";`).status === 0;
}

async function main() {
  log('Enflow — SQLite → PostgreSQL geçiş aracı\n');

  if (detectProvider() !== 'SQLITE') {
    err('Kaynak zaten PostgreSQL (backend/.env DATABASE_URL) — geçişe gerek yok.');
    process.exitCode = 1; return;
  }
  if (!existsSync(join(BACKEND_DIR, 'dev.db'))) {
    err('backend/dev.db bulunamadı — taşınacak SQLite veritabanı yok.');
    process.exitCode = 1; return;
  }

  const stopped = await askYN('Devam etmeden önce backend sürecini (pnpm dev / nodemon) DURDURDUNUZ mu?', false);
  if (!stopped) { warn('Önce backend\'i durdurun, sonra tekrar çalıştırın. (Şema geçici olarak değişecek — çalışan süreç eski client\'ı tutabilir.)'); return; }

  const firstTenant = await sourcePrisma.tenant.findFirst();
  if (!firstTenant) { warn('Veritabanı boş (hiç tenant yok) — taşınacak veri yok.'); return; }

  head('Hedef PostgreSQL bağlantısı');
  const host = await ask('Postgres host', 'localhost');
  const port = await ask('Postgres port', '5432');
  const db = await ask('Veritabanı adı', 'enflow');
  const appUser = await ask('Uygulama DB kullanıcısı (dbadmin)', 'enflow');
  const appPass = await ask('Uygulama DB şifresi', '');
  if (!appPass) { err('Şifre boş olamaz.'); process.exitCode = 1; return; }

  const provisionNow = await askYN('Rol/veritabanı superuser ile otomatik oluşturulsun mu? (Hayır = zaten var/elle kuruldu)', true);
  if (provisionNow) {
    const admin = {
      host, port,
      user: await ask('Postgres superuser', 'postgres'),
      pass: await ask('Postgres superuser şifresi', 'postgres'),
    };
    if (!commandExists('psql')) { err('psql bulunamadı — PostgreSQL istemcisini kurun.'); process.exitCode = 1; return; }
    if (!pgReachable(admin)) { err('PostgreSQL sunucusuna erişilemiyor (host/port/superuser bilgilerini kontrol edin).'); process.exitCode = 1; return; }
    const provisioned = provisionPostgresDb(admin, { db, appUser, appPass });
    if (!provisioned) { err('Rol/veritabanı oluşturulamadı.'); process.exitCode = 1; return; }
    ok(`PostgreSQL hazır: rol "${appUser}" + veritabanı "${db}".`);
  }

  const targetUrl = `postgresql://${appUser}:${appPass}@${host}:${port}/${db}?schema=public`;
  const sourceUrl = process.env.DATABASE_URL || 'file:./dev.db';

  head('1/5 · Güvenlik snapshot (kaynak SQLite)');
  const backup = await runBackup({
    tenantId: firstTenant.id, scope: 'PLATFORM', kind: 'DATA', targetType: 'LOCAL',
    location: null, trigger: 'MANUAL', startedByName: 'migrate-to-postgres script', settings: null,
  });
  ok(`Snapshot alındı (BackupJob ${backup.id}) — bir şey ters giderse geri yüklenebilir.`);

  head('2/5 · Kaynaktan export');
  const { data, counts } = await exportLogicalData('PLATFORM');
  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);
  ok(`${Object.keys(counts).length} model, ${totalRows} satır belleğe alındı.`);

  let switchedSchema = false;
  try {
    head('3/5 · Hedef şema (prisma db push)');
    setSchemaProvider('postgresql');
    switchedSchema = true;
    prismaCli(['generate'], targetUrl);
    prismaCli(['db', 'push', '--accept-data-loss'], targetUrl);
    ok('Hedef şema Postgres\'e kuruldu.');

    head('4/5 · Hedefe yükleme');
    // Ayrı süreçte çalıştırılır — bu süreç `@prisma/client`'ı export aşamasında
    // (sqlite iken) zaten require etmişti; require cache biraz önce diske yazılan
    // postgresql üretimini görmez. Taze bir süreç disk'teki güncel client'ı yükler.
    const dataFile = join(tmpdir(), `enflow-migrate-data-${Date.now()}.json`);
    const resultFile = `${dataFile}.result.json`;
    writeFileSync(dataFile, JSON.stringify({ data }));
    const load = spawnSync('pnpm', ['exec', 'ts-node', '--transpile-only', 'src/scripts/_migrateLoadTarget.ts', dataFile, resultFile], {
      cwd: BACKEND_DIR, stdio: 'inherit', shell: isWin,
      env: { ...process.env, DATABASE_URL: targetUrl },
    });
    if (load.status !== 0) { try { unlinkSync(dataFile); } catch { /* yut */ } throw new Error('Hedefe yükleme alt-süreci başarısız (yukarıdaki hataya bakın).'); }
    const restored = JSON.parse(readFileSync(resultFile, 'utf-8')) as Record<string, number>;
    try { unlinkSync(dataFile); unlinkSync(resultFile); } catch { /* yut */ }

    head('5/5 · Doğrulama');
    const mismatches = Object.entries(counts).filter(([name, expected]) => (restored[name] || 0) !== expected);
    if (mismatches.length > 0) {
      throw new Error(`Satır sayısı uyuşmazlığı: ${mismatches.map(([n, e]) => `${n} (beklenen ${e}, yüklenen ${restored[n] || 0})`).join(', ')}`);
    }
    ok(`Tüm ${Object.keys(counts).length} model doğrulandı — satır sayıları eşleşiyor.`);

    // Yalnız doğrulama geçince .env güncellenir (yalnız DATABASE_URL satırı — diğer değişkenler korunur)
    const envSrc = readFileSync(ENV_PATH, 'utf-8');
    const envNext = /^DATABASE_URL=.*$/m.test(envSrc)
      ? envSrc.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${targetUrl}"`)
      : envSrc.trimEnd() + `\nDATABASE_URL="${targetUrl}"\n`;
    writeFileSync(ENV_PATH, envNext);

    log(`
Geçiş tamamlandı 🎉
  Hedef: postgresql://${appUser}:***@${host}:${port}/${db}
  backend/.env güncellendi. Şimdi backend'i başlatın: cd backend && pnpm start (veya pnpm dev)
  backend/dev.db SİLİNMEDİ — rollback için elde tutuluyor, artık kullanılmıyor.`);
  } catch (e) {
    if (switchedSchema) {
      warn('Hata nedeniyle schema.prisma SQLite\'a geri alınıyor (backend/.env DOKUNULMADI, dev.db değişmedi)…');
      setSchemaProvider('sqlite');
      try { prismaCli(['generate'], sourceUrl); } catch { /* generate hatası ikincil — asıl hata zaten fırlatılacak */ }
    }
    throw e;
  }
}

function head(m: string) { log(`\n── ${m} ──`); }

main()
  .catch((e: unknown) => { err(e instanceof Error ? e.message : String(e)); process.exitCode = 1; })
  .finally(async () => { rl.close(); await sourcePrisma.$disconnect(); });

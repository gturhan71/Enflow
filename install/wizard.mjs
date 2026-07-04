#!/usr/bin/env node
/* Enflow — OS-bağımsız kurulum sihirbazı (Windows + Linux + macOS)
 * Bağımlılık YOK (yalnız Node yerleşik modülleri). install.sh / install.ps1
 * tarafından çağrılır; tek başına da çalışır: `node install/wizard.mjs --repo <dir>`.
 *
 * Adımlar: önkoşul denetimi → yapılandırma (port/DB/sır) → bağımlılık kurulumu
 *          → Prisma generate + migrate deploy → (ops.) seed → (ops.) build → özet.
 */
import { createInterface } from 'node:readline/promises';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync, readFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stdin, stdout, platform, exit } from 'node:process';

const C = { r: '\x1b[0m', b: '\x1b[1m', g: '\x1b[32m', y: '\x1b[33m', red: '\x1b[31m', c: '\x1b[36m', dim: '\x1b[2m' };
const log = (m = '') => console.log(m);
const ok = (m) => log(`${C.g}✓${C.r} ${m}`);
const warn = (m) => log(`${C.y}⚠${C.r}  ${m}`);
const err = (m) => log(`${C.red}✗${C.r} ${m}`);
const head = (m) => log(`\n${C.b}${C.c}━━ ${m} ━━${C.r}`);

// ── Argümanlar ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const has = (k) => args.includes(k);
const YES = has('--yes') || has('-y');
const DRY = has('--dry-run');
const RESET_DB = has('--reset-db'); // temiz kurulum: mevcut SQLite dev.db'yi sil
const isWin = platform === 'win32';
const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(getArg('--repo', join(SELF_DIR, '..')));

// ── Yardımcılar ──────────────────────────────────────────────────────────────
const rl = createInterface({ input: stdin, output: stdout });
async function ask(q, def) {
  if (YES) return def ?? '';
  const a = (await rl.question(`${C.c}?${C.r} ${q}${def ? ` ${C.dim}[${def}]${C.r}` : ''}: `)).trim();
  return a || def || '';
}
async function askYN(q, def = true) {
  if (YES) return def;
  const a = (await rl.question(`${C.c}?${C.r} ${q} ${C.dim}(${def ? 'E/h' : 'e/H'})${C.r}: `)).trim().toLowerCase();
  if (!a) return def;
  return ['e', 'y', 'evet', 'yes'].includes(a);
}
function run(cmd, cmdArgs, cwd) {
  log(`${C.dim}  $ ${cmd} ${cmdArgs.join(' ')}${C.r}`);
  if (DRY) { log(`${C.y}  [dry-run] atlandı${C.r}`); return; }
  const r = spawnSync(cmd, cmdArgs, { cwd, stdio: 'inherit', shell: isWin });
  if (r.status !== 0) throw new Error(`Komut başarısız: ${cmd} ${cmdArgs.join(' ')}`);
}
function capture(cmd, cmdArgs) {
  const r = spawnSync(cmd, cmdArgs, { encoding: 'utf-8', shell: isWin });
  return r.status === 0 ? (r.stdout || '').trim() : null;
}
const secret = (n = 48) => randomBytes(n).toString('base64url');

// ── PostgreSQL yardımcıları ──────────────────────────────────────────────────
const commandExists = (cmd) => {
  const r = spawnSync(isWin ? 'where' : 'which', [cmd], { encoding: 'utf-8', shell: isWin });
  return r.status === 0;
};
// schema.prisma datasource provider'ını sqlite ↔ postgresql arasında çevir.
function setSchemaProvider(prov) {
  const schemaPath = join(REPO, 'backend', 'prisma', 'schema.prisma');
  if (!existsSync(schemaPath)) return;
  let s = readFileSync(schemaPath, 'utf-8');
  const next = s.replace(/(datasource\s+db\s*\{[^}]*?provider\s*=\s*")(sqlite|postgresql)(")/s, `$1${prov}$3`);
  if (next !== s && !DRY) writeFileSync(schemaPath, next);
  log(`${C.dim}  schema.prisma datasource provider → ${prov}${C.r}`);
}
// psql ile bir SQL çalıştır (PGPASSWORD ile); status döner.
function psql(admin, sqlOrDb, { db = 'postgres', command = null } = {}) {
  const a = ['-h', admin.host, '-p', String(admin.port), '-U', admin.user, '-d', db, '-v', 'ON_ERROR_STOP=1'];
  if (command) a.push('-c', command); else a.push('-c', sqlOrDb);
  const r = spawnSync('psql', a, { encoding: 'utf-8', env: { ...process.env, PGPASSWORD: admin.pass || '' }, shell: isWin });
  return r;
}
const pgReachable = (admin) => psql(admin, 'SELECT 1;').status === 0;

// PostgreSQL sunucusunu garanti et (yoksa Windows'ta winget ile kur).
async function ensurePostgresServer(admin) {
  if (commandExists('psql') && pgReachable(admin)) { ok('PostgreSQL erişilebilir (mevcut sunucu kullanılacak).'); return true; }
  if (!isWin) { warn('PostgreSQL erişilemedi. Kurun (ör. `brew install postgresql` / `apt install postgresql`) ve tekrar çalıştırın.'); return false; }
  if (DRY) { warn('[dry-run] winget PostgreSQL kurulumu atlandı.'); return false; }
  head('PostgreSQL kurulumu (winget)');
  if (!commandExists('winget')) { warn('winget yok. PostgreSQL\'i elle kurun: https://www.postgresql.org/download/windows/'); return false; }
  run('winget', ['install', '-e', '--id', 'PostgreSQL.PostgreSQL', '--silent', '--accept-source-agreements', '--accept-package-agreements'], REPO);
  // PATH tazele + biraz bekle (servis ayağa kalksın)
  process.env.Path = (capture('powershell', ['-NoProfile', '-Command', '[Environment]::GetEnvironmentVariable("Path","Machine")+";"+[Environment]::GetEnvironmentVariable("Path","User")']) || process.env.Path);
  for (let i = 0; i < 20 && !pgReachable(admin); i++) { await new Promise(r => setTimeout(r, 1500)); }
  if (pgReachable(admin)) { ok('PostgreSQL kuruldu ve erişilebilir.'); return true; }
  warn('PostgreSQL kuruldu ama erişilemedi (superuser şifresi/servis?). Bilgileri doğrulayıp tekrar deneyin.');
  return false;
}

// enflow rolü (dbadmin) + veritabanını superuser ile oluştur (idempotent).
function provisionPostgresDb(admin, { db, appUser, appPass }) {
  const esc = (v) => String(v).replace(/'/g, "''");
  // rol
  psql(admin, null, { command: `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${esc(appUser)}') THEN CREATE ROLE "${appUser}" WITH LOGIN PASSWORD '${esc(appPass)}'; END IF; END $$;` });
  psql(admin, null, { command: `ALTER ROLE "${appUser}" WITH LOGIN PASSWORD '${esc(appPass)}';` });
  // veritabanı (CREATE DATABASE transaction-dışı; var mı diye bak)
  const exists = (psql(admin, null, { command: `SELECT 1 FROM pg_database WHERE datname='${esc(db)}';` }).stdout || '').includes('1');
  if (!exists) psql(admin, null, { command: `CREATE DATABASE "${db}" OWNER "${appUser}";` });
  const g = psql(admin, null, { command: `GRANT ALL PRIVILEGES ON DATABASE "${db}" TO "${appUser}";` });
  return g.status === 0;
}

// ── 0) Başlık ────────────────────────────────────────────────────────────────
log(`${C.b}${C.c}
  ███████╗███╗   ██╗███████╗██╗      ██████╗ ██╗    ██╗
  ██╔════╝████╗  ██║██╔════╝██║     ██╔═══██╗██║    ██║
  █████╗  ██╔██╗ ██║█████╗  ██║     ██║   ██║██║ █╗ ██║
  ██╔══╝  ██║╚██╗██║██╔══╝  ██║     ██║   ██║██║███╗██║
  ███████╗██║ ╚████║██║     ███████╗╚██████╔╝╚███╔███╔╝
  ╚══════╝╚═╝  ╚═══╝╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝${C.r}
  ${C.dim}Kurulum Sihirbazı · ${isWin ? 'Windows' : platform} · repo: ${REPO}${C.r}`);

async function main() {
  // ── 1) Önkoşul denetimi ────────────────────────────────────────────────────
  head('1/6 · Önkoşul denetimi');
  const nodeV = process.versions.node;
  const major = Number(nodeV.split('.')[0]);
  if (major < 20) { err(`Node ${nodeV} — en az 20 gerekli (öneri: 22 LTS+).`); exit(1); }
  ok(`Node ${nodeV}`);

  if (!capture('git', ['--version'])) warn('git bulunamadı — "en son sürümü indirme" için gerekli (kurulum yine de sürer).');
  else ok(capture('git', ['--version']));

  // pnpm — corepack ile etkinleştir
  let pnpmV = capture('pnpm', ['--version']);
  if (!pnpmV) {
    warn('pnpm bulunamadı — corepack ile etkinleştiriliyor…');
    spawnSync('corepack', ['enable'], { stdio: 'inherit', shell: isWin });
    spawnSync('corepack', ['prepare', 'pnpm@10.33.0', '--activate'], { stdio: 'inherit', shell: isWin });
    pnpmV = capture('pnpm', ['--version']);
  }
  if (!pnpmV) { err('pnpm kurulamadı. Elle: `npm i -g pnpm` veya `corepack enable`.'); exit(1); }
  ok(`pnpm ${pnpmV}`);

  if (!existsSync(join(REPO, 'package.json')) || !existsSync(join(REPO, 'backend'))) {
    err(`Proje kökü doğrulanamadı: ${REPO}\n  (install.sh/ps1 deposunu klonlamış olmalı; --repo <dir> ile de verebilirsiniz.)`);
    exit(1);
  }
  ok('Proje kökü doğrulandı');

  // ── 2) Yapılandırma ─────────────────────────────────────────────────────────
  head('2/6 · Yapılandırma (boş bırakırsanız varsayılan)');
  const backendPort = await ask('Backend portu', '3002');
  const frontendPort = await ask('Frontend portu', '3000');

  let dbUrl = 'file:./dev.db';
  const usePg = await askYN('PostgreSQL kullanılsın mı? (Hayır = SQLite, varsayılan)', false);
  if (usePg) {
    const host = await ask('Postgres host', 'localhost');
    const port = await ask('Postgres port', '5432');
    const db = await ask('Veritabanı adı', 'enflow');
    const appUser = await ask('Uygulama DB kullanıcısı (dbadmin)', 'enflow');
    let appPass = await ask('Uygulama DB şifresi (boş = otomatik üret)', '');
    if (!appPass) { appPass = secret(18); ok('Uygulama DB şifresi otomatik üretildi (özet sonunda gösterilecek).'); }

    // Superuser (postgres) — sunucu kurulumu + rol/DB oluşturmak için. Zaten kuruluysa
    // mevcut superuser bilgileri kullanılır; değilse winget ile kurulur.
    const admin = {
      host, port,
      user: await ask('Postgres superuser (rol/DB oluşturmak için)', 'postgres'),
      pass: await ask('Postgres superuser şifresi', 'postgres'),
    };
    const serverOk = await ensurePostgresServer(admin);
    if (serverOk) {
      const provisioned = DRY ? true : provisionPostgresDb(admin, { db, appUser, appPass });
      if (provisioned) ok(`PostgreSQL hazır: rol "${appUser}" + veritabanı "${db}" (mevcutsa korunur).`);
      else warn('DB/rol otomatik oluşturulamadı — superuser bilgilerini/erişimi kontrol edip elle oluşturun.');
    } else {
      warn('PostgreSQL sağlanamadı — .env yine de yazılır; sunucuyu hazırlayıp `pnpm prisma db push` çalıştırın.');
    }
    dbUrl = `postgresql://${appUser}:${appPass}@${host}:${port}/${db}?schema=public`;
    setSchemaProvider('postgresql'); // Prisma provider'ını Postgres'e çevir
    // Özette gösterilecek not
    globalThis.__pgSummary = { host, port, db, appUser, appPass, superuser: admin.user };
  } else {
    setSchemaProvider('sqlite'); // SQLite yolunda provider'ı geri al (önceki PG denemesi kalmışsa)
  }

  const jwt = secret(48);
  const pluginSecret = secret(48);
  ok('JWT_SECRET ve PLUGIN_LICENSE_SECRET güvenli rastgele üretildi');

  const aiBase = await ask('YZ Base URL (ops. — boş geç, uygulamadan da girilebilir)', '');
  const aiKey = aiBase ? await ask('YZ API Key (ops.)', '') : '';
  const aiModel = aiBase ? await ask('YZ Model (ops.)', '') : '';

  // ── 3) .env yaz ─────────────────────────────────────────────────────────────
  head('3/6 · Ortam dosyaları');
  const envLines = [
    `PORT=${backendPort}`,
    `DATABASE_URL="${dbUrl}"`,
    `JWT_SECRET=${jwt}`,
    `PLUGIN_LICENSE_SECRET=${pluginSecret}`,
    `NODE_ENV=production`,
  ];
  if (aiBase) { envLines.push(`AI_BASE_URL=${aiBase}`, `AI_API_KEY=${aiKey}`, `AI_MODEL=${aiModel}`); }
  const backendEnv = join(REPO, 'backend', '.env');
  if (DRY) {
    warn('[dry-run] backend/.env yazılmayacak. İçerik önizlemesi:');
    log(C.dim + envLines.map(l => '    ' + l.replace(/(SECRET=).*/, '$1********')).join('\n') + C.r);
  } else if (existsSync(backendEnv) && !YES && !(await askYN('backend/.env zaten var — üzerine yazılsın mı?', false))) {
    warn('Mevcut backend/.env korundu.');
  } else {
    writeFileSync(backendEnv, envLines.join('\n') + '\n');
    // Frontend dev portu — vite --port ile geçilir; .env.local opsiyonel
    writeFileSync(join(REPO, '.env.local'), `VITE_BACKEND_PORT=${backendPort}\n`);
    ok(`backend/.env yazıldı (${backendEnv})`);
  }

  // ── 4) Bağımlılıklar ─────────────────────────────────────────────────────────
  head('4/6 · Bağımlılık kurulumu (pnpm)');
  run('pnpm', ['install'], REPO);
  run('pnpm', ['install'], join(REPO, 'backend'));
  ok('Bağımlılıklar kuruldu (frontend + backend)');

  // ── 5) Veritabanı ─────────────────────────────────────────────────────────────
  head('5/6 · Veritabanı (Prisma)');
  const env = { ...process.env, DATABASE_URL: dbUrl };
  const prismaRun = (a) => {
    log(`${C.dim}  $ pnpm prisma ${a.join(' ')}${C.r}`);
    if (DRY) { log(`${C.y}  [dry-run] atlandı${C.r}`); return; }
    const r = spawnSync('pnpm', ['prisma', ...a], { cwd: join(REPO, 'backend'), stdio: 'inherit', shell: isWin, env });
    if (r.status !== 0) throw new Error(`prisma ${a.join(' ')} başarısız`);
  };
  // Temiz kurulum güvencesi: önceki kurulumdan kalan SQLite dev.db veriyle gelir
  // (git rm --cached izlemeyi bıraktı ama yerel dosya silinmez). Varsa sor/sıfırla.
  if (!usePg && !DRY) {
    const dbFile = join(REPO, 'backend', 'dev.db');
    if (existsSync(dbFile)) {
      const doReset = RESET_DB || (!YES && await askYN('Mevcut veritabani (backend/dev.db) bulundu. TEMIZ kurulum icin SIFIRLANSIN mi? (Hayir = mevcut veri/kullanicilar korunur)', false));
      if (doReset) {
        for (const ext of ['', '-shm', '-wal']) { try { if (existsSync(dbFile + ext)) unlinkSync(dbFile + ext); } catch { /* yut */ } }
        ok('Mevcut veritabani sifirlandi → bos kurulum (ilk acilista Kurulum Sihirbazi gelir).');
      } else {
        warn('Mevcut veritabani korundu — eski veri/kullanicilar gelir. (Temiz icin: --reset-db)');
      }
    }
  }

  prismaRun(['generate']);
  if (usePg) {
    // PostgreSQL: mevcut migration'lar SQLite lehçesinde → şema modellerden `db push`
    // ile kurulur (migration geçmişi yok). Postgres migration seti sonra üretilecek
    // (bkz. install/POSTGRES_MIGRATION_PLAN.md).
    prismaRun(['db', 'push', '--accept-data-loss']);
  } else {
    prismaRun(['migrate', 'deploy']);
  }
  ok(DRY ? 'Prisma adımları (dry-run) listelendi' : (usePg ? 'Prisma client üretildi + şema Postgres\'e db push edildi' : 'Prisma client üretildi + migration\'lar uygulandı'));

  // NOT: Hiçbir kullanıcı/tenant tohumlanmaz. Veritabanı BOŞ kalmalı ki ilk açılışta
  // tarayıcıdaki Kurulum Sihirbazı şirket + ilk yönetici + lisansı tanımlasın.
  // (Yedek Yöneticisi gibi ek kullanıcılar sonradan Ayarlar → Kullanıcılar'dan eklenir.)

  // ── 6) Derleme (opsiyonel — üretim) ────────────────────────────────────────────
  head('6/6 · Frontend derleme');
  const build = await askYN('Frontend üretim derlemesi (pnpm build → dist) yapılsın mı?', true);
  if (build) { run('pnpm', ['build'], REPO); ok('Frontend derlendi → dist/'); }
  else warn('Derleme atlandı (geliştirme modunda `pnpm dev` kullanın).');

  // ── Özet ───────────────────────────────────────────────────────────────────
  head('Kurulum tamamlandı 🎉');
  const py = isWin ? 'pwsh/cmd' : 'bash';
  log(`
${C.b}Başlatma:${C.r}
  ${C.c}# Backend (port ${backendPort})${C.r}
  cd "${join(REPO, 'backend')}" && pnpm start

  ${C.c}# Frontend — geliştirme (port ${frontendPort})${C.r}
  cd "${REPO}" && pnpm dev --port ${frontendPort}

  ${C.c}# Üretim — backend derlenmiş dist'i TEK ORIGIN sunar (build + backend yeter):${C.r}
  cd "${join(REPO, 'backend')}" && pnpm start   ${C.dim}# → http://localhost:${backendPort} (hem UI hem API)${C.r}

${C.b}İlk açılış:${C.r} tarayıcı → http://localhost:${frontendPort}
  ${C.dim}Veritabanı BOŞTUR → ekrana KURULUM SİHİRBAZI gelir:${C.r}
  ${C.dim}şirket + ilk yönetici (GM) + lisans (yoksa 30 günlük deneme). Tamamlanınca otomatik giriş.${C.r}
${C.dim}Ek kullanıcı (Yedek Yöneticisi vb.) · YZ entegrasyonu sonradan Ayarlar'dan eklenir.${C.r}
${C.dim}Sırlar backend/.env içinde (JWT_SECRET, PLUGIN_LICENSE_SECRET). Üretimde gizli tutun.${C.r}
${C.dim}(Kabuk: ${py})${C.r}`);

  const pg = globalThis.__pgSummary;
  if (pg) {
    log(`
${C.b}${C.y}PostgreSQL — DB erişim bilgileri (GÜVENLE SAKLAYIN):${C.r}
  Sunucu    : ${pg.host}:${pg.port}
  Veritabanı: ${pg.db}
  DB kullanıcı (dbadmin): ${pg.appUser}
  DB şifre  : ${C.b}${pg.appPass}${C.r}
  ${C.dim}Bu bilgiler backend/.env → DATABASE_URL içinde de var. Şema "db push" ile kuruldu
  (Postgres migration seti sonra: install/POSTGRES_MIGRATION_PLAN.md).${C.r}`);
  }
}

main().then(() => { rl.close(); }).catch((e) => { rl.close(); err(e.message || String(e)); exit(1); });

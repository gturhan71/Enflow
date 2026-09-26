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
import { existsSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stdin, stdout, platform, exit } from 'node:process';
import { pgReachable, provisionPostgresDb, grantRuntimePrivileges } from './lib/pg.mjs';

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
// Şema/migration klasörü backend/prisma.config.ts'te DATABASE_URL'e göre seçilir
// (ADR-002) — izlenen schema.prisma artık ASLA yerinde değiştirilmez.

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

// Postgres rol/DB provizyonu + runtime GRANT'leri → install/lib/pg.mjs (CI ile ortak).

// Uygulama sunucusunun gelen trafiğini SSH + backend portuna kısıtlar — yalnız
// operatör AÇIKÇA onaylarsa çalışır (varsayılan HAYIR), mevcut kuralları SİLMEZ,
// yalnız ekler. Adım 0 madde 3: DB/Studio portu ASLA internete açık olmamalı.
async function offerFirewallHardening(backendPort) {
  head('Ağ sertleştirmesi (opsiyonel)');
  if (!isWin && commandExists('ufw')) {
    const yes = await askYN(
      `ufw ile bu sunucuda gelen trafiği yalnız SSH(22) + backend portuna (${backendPort}) izin verecek şekilde kısıtlayalım mı? (Postgres/Prisma Studio portu dahil diğer HER ŞEY reddedilir — mevcut kurallar silinmez, yalnız eklenir)`,
      false,
    );
    if (yes) {
      run('sudo', ['ufw', 'allow', '22/tcp'], REPO);
      run('sudo', ['ufw', 'allow', `${backendPort}/tcp`], REPO);
      run('sudo', ['ufw', 'default', 'deny', 'incoming'], REPO);
      run('sudo', ['ufw', '--force', 'enable'], REPO);
      ok(`ufw etkin: yalnız 22 + ${backendPort} gelen trafiğe açık.`);
    } else {
      warn(`ufw atlandı. Elle: sudo ufw allow 22/tcp && sudo ufw allow ${backendPort}/tcp && sudo ufw default deny incoming && sudo ufw enable`);
    }
  } else if (isWin) {
    const yes = await askYN(
      `Windows Firewall ile gelen trafiği yalnız RDP/SSH(varsayılan) + backend portuna (${backendPort}) izin verecek şekilde kısıtlayalım mı? (mevcut kurallar silinmez, yalnız eklenir)`,
      false,
    );
    if (yes) {
      run('powershell', ['-NoProfile', '-Command', `New-NetFirewallRule -DisplayName 'Enflow-Backend' -Direction Inbound -Protocol TCP -LocalPort ${backendPort} -Action Allow`], REPO);
      ok(`Windows Firewall kuralı eklendi: yalnız ${backendPort}/TCP (+ mevcut RDP/SSH kuralları) gelen trafiğe açık.`);
      warn('Postgres portu (varsayılan 5432) için AYRI bir Inbound kural YOK — yalnız izin verilenler dışında her şey varsayılan Windows Firewall politikasına göre engellenir; "Genel" profilde varsayılanın "Bloke" olduğunu doğrulayın (Windows Defender Firewall → Özellikler).');
    } else {
      warn(`Atlandı. Elle: New-NetFirewallRule -DisplayName 'Enflow-Backend' -Direction Inbound -Protocol TCP -LocalPort ${backendPort} -Action Allow`);
    }
  } else {
    warn('ufw bulunamadı (macOS/diğer) — güvenlik duvarını elle yapılandırın: yalnız SSH(22) ve backend portu ('
      + backendPort + ') gelen trafiğe açık olmalı, Postgres (5432) ve Prisma Studio (5555) ASLA internete açılmamalı.');
  }
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
  head('1/7 · Önkoşul denetimi');
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
  head('2/7 · Yapılandırma (boş bırakırsanız varsayılan)');
  const backendPort = await ask('Backend portu', '3002');
  const frontendPort = await ask('Frontend portu', '3000');

  // Kapasite teyidi — SQLite'ın asıl sınırı eşzamanlı YAZMA (tek-dosya/tek-yazar),
  // ham depolama değil; ikinci soru ikincil bir sinyal olarak eklenir. Eşik aşılırsa
  // aşağıdaki Postgres sorusunun varsayılanı true'ya çevrilir — sert engel YOK,
  // yalnız gerekçeli öneri (kullanıcı yine de "hayır" diyebilir).
  const SQLITE_MAX_USERS = 20;      // ~20 üzeri kullanıcıda eşzamanlı yazma çakışması belirginleşir
  const SQLITE_MAX_STORAGE_GB = 5;  // ikincil sinyal
  head('2b/7 · Kapasite teyidi');
  const expectedUsers = Number(await ask('Beklenen toplam kullanıcı sayısı?', '10')) || 10;
  const expectedStorageGB = Number(await ask('Yaklaşık 1 yıl içinde birikmesi beklenen veri (GB)?', '1')) || 1;
  const overCapacity = expectedUsers > SQLITE_MAX_USERS || expectedStorageGB > SQLITE_MAX_STORAGE_GB;
  if (overCapacity) {
    warn(`Beklenen ölçek (${expectedUsers} kullanıcı, ${expectedStorageGB} GB) SQLite'ın rahat sınırını aşıyor (~${SQLITE_MAX_USERS} kullanıcı) — PostgreSQL öneriliyor.`);
  }

  let dbUrl = 'file:./dev.db';
  let migratorUrl = null; // yalnız usePg true ise dolar — migrate deploy İÇİN, .env'e YAZILMAZ
  const usePg = await askYN('PostgreSQL kullanılsın mı? (Hayır = SQLite)', overCapacity);
  if (!usePg && overCapacity) {
    warn('SQLite ile devam ediliyor. Büyüdüğünüzde sorunsuz geçiş için: `pnpm migrate:to-postgres` (backend/ içinde).');
  }
  if (usePg) {
    const host = await ask('Postgres host', 'localhost');
    const port = await ask('Postgres port', '5432');
    const db = await ask('Veritabanı adı', 'enflow');
    const appUser = await ask('Uygulama DB kullanıcısı (runtime, en az yetkili — yalnız SELECT/INSERT/UPDATE/DELETE)', 'enflow');
    let appPass = await ask('Uygulama DB şifresi (boş = otomatik üret)', '');
    if (!appPass) { appPass = secret(18); ok('Uygulama DB şifresi otomatik üretildi (özet sonunda gösterilecek).'); }
    // Migrator rolü otomatik türetilir (elle sorulmaz) — yalnız kurulum/upgrade sırasında
    // DDL için kullanılır, backend/.env'e asla yazılmaz (Adım 0 madde 5, en az yetki).
    const migratorUser = `${appUser}_migrator`;
    const migratorPass = secret(18);

    if (host !== 'localhost' && host !== '127.0.0.1') {
      warn(`UZAK Postgres sunucusu tespit edildi (${host}). Bu DB portu (${port}) ASLA genel internete açık olmamalı —`
        + ' yalnız uygulama sunucusunun bulunduğu private network/VPC içinden erişilebilir olmalı. Doğrulama:');
      log(`${C.dim}  nmap -p ${port} ${host}   ${C.y}# Beklenen: port kapalı/filtered (internetten)${C.r}`);
    }

    // Superuser (postgres) — sunucu kurulumu + rol/DB oluşturmak için. Zaten kuruluysa
    // mevcut superuser bilgileri kullanılır; değilse winget ile kurulur.
    const admin = {
      host, port,
      user: await ask('Postgres superuser (rol/DB oluşturmak için)', 'postgres'),
      pass: await ask('Postgres superuser şifresi', 'postgres'),
    };
    const serverOk = await ensurePostgresServer(admin);
    if (serverOk) {
      const provisioned = DRY ? true : provisionPostgresDb(admin, { db, appUser, appPass, migratorUser, migratorPass });
      if (provisioned) ok(`PostgreSQL hazır: migrator rolü "${migratorUser}" (DDL) + runtime rolü "${appUser}" (DML-only) + veritabanı "${db}" (mevcutsa korunur).`);
      else warn('DB/rol otomatik oluşturulamadı — superuser bilgilerini/erişimi kontrol edip elle oluşturun.');
    } else {
      warn('PostgreSQL sağlanamadı — .env yine de yazılır; sunucuyu hazırlayıp `pnpm prisma migrate deploy` (migrator kimlik bilgileriyle, backend/ içinde) çalıştırın.');
    }
    dbUrl = `postgresql://${appUser}:${appPass}@${host}:${port}/${db}?schema=public`;
    migratorUrl = `postgresql://${migratorUser}:${migratorPass}@${host}:${port}/${db}?schema=public`;
    // Özette gösterilecek not
    globalThis.__pgSummary = { host, port, db, appUser, appPass, migratorUser, migratorPass, superuser: admin.user };
    globalThis.__pgGrant = { admin, db, appUser, migratorUser }; // 5/7'de migrate deploy sonrası grantRuntimePrivileges için
  }

  const jwt = secret(48);
  ok('AUTH_JWT_SECRET güvenli rastgele üretildi');

  // Tenant verisi şifreleme master key — tam 32 byte, base64 (base64url DEĞİL; backend
  // tenantEncryption.ts 'base64' ile decode ediyor, encoding'ler tutarlı olmalı).
  const dataEncryptionKey = randomBytes(32).toString('base64');
  ok('DATA_ENCRYPTION_MASTER_KEY güvenli rastgele üretildi');

  const aiBase = await ask('YZ Base URL (ops. — boş geç, uygulamadan da girilebilir)', '');
  const aiKey = aiBase ? await ask('YZ API Key (ops.)', '') : '';
  const aiModel = aiBase ? await ask('YZ Model (ops.)', '') : '';

  // ── 3) .env yaz ─────────────────────────────────────────────────────────────
  head('3/7 · Ortam dosyaları');
  const envLines = [
    `PORT=${backendPort}`,
    `DATABASE_URL="${dbUrl}"`,
    // Kimlik doğrulama JWT imza anahtarı — backend (services/auth.ts) bunu okur;
    // üretimde (NODE_ENV=production) ZORUNLUdur, yoksa backend açılışta durur.
    `AUTH_JWT_SECRET=${jwt}`,
    // Tenant verisi (YZ apiKey, IBAN, vergi no) alan-bazlı şifreleme master key'i —
    // backend (services/tenantEncryption.ts) bunu okur; üretimde ZORUNLUdur.
    `DATA_ENCRYPTION_MASTER_KEY=${dataEncryptionKey}`,
    `NODE_ENV=production`,
  ];
  if (aiBase) { envLines.push(`AI_BASE_URL=${aiBase}`, `AI_API_KEY=${aiKey}`, `AI_MODEL=${aiModel}`); }
  const backendEnv = join(REPO, 'backend', '.env');
  if (DRY) {
    warn('[dry-run] backend/.env yazılmayacak. İçerik önizlemesi:');
    log(C.dim + envLines.map(l => '    ' + l.replace(/(SECRET=|MASTER_KEY=).*/, '$1********')).join('\n') + C.r);
  } else if (existsSync(backendEnv) && !YES && !(await askYN('backend/.env zaten var — üzerine yazılsın mı?', false))) {
    warn('Mevcut backend/.env korundu.');
  } else {
    writeFileSync(backendEnv, envLines.join('\n') + '\n');
    // Frontend dev portu — vite --port ile geçilir; .env.local opsiyonel
    writeFileSync(join(REPO, '.env.local'), `VITE_BACKEND_PORT=${backendPort}\n`);
    ok(`backend/.env yazıldı (${backendEnv})`);
  }

  // ── 4) Bağımlılıklar ─────────────────────────────────────────────────────────
  head('4/7 · Bağımlılık kurulumu (pnpm)');
  run('pnpm', ['install'], REPO);
  run('pnpm', ['install'], join(REPO, 'backend'));
  ok('Bağımlılıklar kuruldu (frontend + backend)');

  // ── 5) Veritabanı ─────────────────────────────────────────────────────────────
  head('5/7 · Veritabanı (Prisma)');
  // Postgres'te şema DDL'i (migrate deploy) migrator kimlik bilgileriyle çalışır — runtime
  // (appUser) rolünün DDL yetkisi yok (en az yetki, Adım 0 madde 5). SQLite'ta tek
  // rol kavramı olmadığı için dbUrl zaten doğrudan kullanılır.
  const env = { ...process.env, DATABASE_URL: usePg ? migratorUrl : dbUrl };
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
    // PostgreSQL: kendi migration hattı (prisma/migrations-postgres, ADR-002) —
    // prisma.config.ts DATABASE_URL'den Postgres şemasını seçer. Migrator (DDL) ile.
    prismaRun(['migrate', 'deploy']);
    // Tablolar migrator sahipliğinde oluşur — runtime rolüne (appUser) yalnız DML
    // (+ gelecekteki tablolar için ALTER DEFAULT PRIVILEGES).
    const grantInfo = globalThis.__pgGrant;
    if (grantInfo && !DRY) {
      const grantOk = grantRuntimePrivileges(grantInfo.admin, grantInfo);
      if (grantOk) ok(`Runtime rolü "${grantInfo.appUser}" yalnız DML yetkisiyle yapılandırıldı (DDL/DROP/ALTER YOK).`);
      else warn('Runtime yetkilendirmesi otomatik uygulanamadı — GRANT komutlarını elle çalıştırın (bkz. install/POSTGRES_MIGRATION_PLAN.md).');
    }

    // Row-Level Security (Faz 3, docs/VERITABANI_GUVENLIGI_PLAN.md) — DB-seviyesi
    // tenant izolasyonu. CI `postgres` job'unda gerçek Postgres 16'ya karşı her PR'da
    // doğrulanır (scripts/ci-postgres.sh). Opt-in, varsayılan HAYIR (davranış korunur).
    if (!DRY) {
      const applyRls = await askYN(
        'PostgreSQL Row-Level Security (RLS) uygulansın mı? (DB seviyesinde ikinci tenant izolasyon katmanı; kurulum sonunda `pnpm verify:postgres-rls` ile canlı doğrulayabilirsiniz)',
        false,
      );
      if (applyRls) {
        log(`${C.dim}  $ pnpm apply:postgres-rls${C.r}`);
        const r = spawnSync('pnpm', ['apply:postgres-rls'], {
          cwd: join(REPO, 'backend'), stdio: 'inherit', shell: isWin,
          env: { ...process.env, DATABASE_URL: migratorUrl },
        });
        if (r.status === 0) ok('RLS politikaları uygulandı. ÖNERİ: `cd backend && pnpm verify:postgres-rls` ile canlı doğrulayın.');
        else warn('RLS uygulanamadı — elle: `cd backend && DATABASE_URL=<migrator-url> pnpm apply:postgres-rls`.');
      } else {
        warn('RLS atlandı. Tenant izolasyonu yalnız uygulama katmanında (mevcut davranış). Sonradan: `cd backend && DATABASE_URL=<migrator-url> pnpm apply:postgres-rls`.');
      }
    }
  } else {
    prismaRun(['migrate', 'deploy']);
  }
  ok(DRY ? 'Prisma adımları (dry-run) listelendi' : (usePg ? 'Prisma client üretildi + Postgres migration\'ları uygulandı' : 'Prisma client üretildi + migration\'lar uygulandı'));

  // NOT: Hiçbir kullanıcı/tenant tohumlanmaz. Veritabanı BOŞ kalmalı ki ilk açılışta
  // tarayıcıdaki Kurulum Sihirbazı şirket + ilk yönetici + lisansı tanımlasın.
  // (Yedek Yöneticisi gibi ek kullanıcılar sonradan Ayarlar → Kullanıcılar'dan eklenir.)

  // ── 6) Ağ sertleştirmesi (opsiyonel — Adım 0 madde 3) ──────────────────────────
  head('6/7 · Ağ sertleştirmesi');
  await offerFirewallHardening(backendPort);
  if (usePg) {
    log(`${C.dim}  Postgres portu (${globalThis.__pgSummary?.port}) yalnız uygulama sunucusunun private`
      + ` network'ünden erişilebilir olmalı — genel internete ASLA açılmamalı.${C.r}`);
  }
  warn('`npx prisma studio` bu sunucuda ASLA çalıştırılmamalı — yalnız yerel geliştirmede kullanın (uzaktan bakmak gerekiyorsa SSH tüneli kullanın).');

  // ── 7) Derleme (opsiyonel — üretim) ────────────────────────────────────────────
  head('7/7 · Derleme');
  // Backend derlemesi ZORUNLU — `pnpm start` artık derlenmiş `backend/dist/index.js`'i
  // çalıştırır (ADR-001; ts-node yalnız geliştirmede, `pnpm dev`).
  run('pnpm', ['build'], join(REPO, 'backend')); ok('Backend derlendi → backend/dist/');
  const build = await askYN('Frontend üretim derlemesi (pnpm build → dist) yapılsın mı?', true);
  if (build) { run('pnpm', ['build'], REPO); ok('Frontend derlendi → dist/'); }
  else warn('Frontend derlemesi atlandı (geliştirme modunda `pnpm dev` kullanın).');

  // ── Özet ───────────────────────────────────────────────────────────────────
  head('Kurulum tamamlandı 🎉');
  const py = isWin ? 'pwsh/cmd' : 'bash';
  log(`
${C.b}Başlatma:${C.r}
  ${C.c}# Backend (port ${backendPort}) — derlenmiş çıktı; kod değişince önce: pnpm build${C.r}
  cd "${join(REPO, 'backend')}" && pnpm start

  ${C.c}# Frontend — geliştirme (port ${frontendPort})${C.r}
  cd "${REPO}" && pnpm dev --port ${frontendPort}

  ${C.c}# Üretim — backend derlenmiş dist'i TEK ORIGIN sunar (build + backend yeter):${C.r}
  cd "${join(REPO, 'backend')}" && pnpm start   ${C.dim}# → http://localhost:${backendPort} (hem UI hem API)${C.r}

${C.b}İlk açılış:${C.r} tarayıcı → http://localhost:${frontendPort}
  ${C.dim}Veritabanı BOŞTUR → ekrana KURULUM SİHİRBAZI gelir:${C.r}
  ${C.dim}şirket + ilk yönetici (GM) + lisans (yoksa 30 günlük deneme). Tamamlanınca otomatik giriş.${C.r}
${C.dim}Ek kullanıcı (Yedek Yöneticisi vb.) · YZ entegrasyonu sonradan Ayarlar'dan eklenir.${C.r}
${C.dim}Sırlar backend/.env içinde (AUTH_JWT_SECRET, DATA_ENCRYPTION_MASTER_KEY). Üretimde gizli tutun.${C.r}
${C.dim}(Kabuk: ${py})${C.r}`);

  const pg = globalThis.__pgSummary;
  if (pg) {
    log(`
${C.b}${C.y}PostgreSQL — DB erişim bilgileri (GÜVENLE SAKLAYIN):${C.r}
  Sunucu    : ${pg.host}:${pg.port}
  Veritabanı: ${pg.db}
  ${C.b}Runtime rolü${C.r} (backend/.env → DATABASE_URL bunu kullanır; yalnız DML — SELECT/INSERT/UPDATE/DELETE):
    Kullanıcı: ${pg.appUser}
    Şifre    : ${C.b}${pg.appPass}${C.r}
  ${C.b}Migrator rolü${C.r} (DDL — yalnız gelecekteki şema güncellemelerinde/upgrade'de kullanılır, .env'de YOK):
    Kullanıcı: ${pg.migratorUser}
    Şifre    : ${C.b}${pg.migratorPass}${C.r}
  ${C.dim}Migrator şifresini de güvenle saklayın — bir sonraki şema güncellemesi/upgrade
  için gerekecek (bkz. install/POSTGRES_MIGRATION_PLAN.md). Postgres portu (${pg.port}) ASLA
  genel internete açılmamalı.${C.r}`);
  }
}

main().then(() => { rl.close(); }).catch((e) => { rl.close(); err(e.message || String(e)); exit(1); });

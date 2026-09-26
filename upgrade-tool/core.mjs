// Enflow Upgrade Tool — çekirdek (bağımlılıksız, yalnız Node built-in).
// On-prem kurulumun git deposunu inceler, uzak "en son yayınlanan" sürümü
// belirler (tag varsa semver tag, yoksa origin/main commit) ve istenirse
// güvenli sıra ile yükseltir. UYGULAMANIN İÇİNDE DEĞİL — ayrı süreç.
import { execFileSync, execFile } from 'node:child_process';
import { readFileSync, writeFileSync, renameSync, existsSync, copyFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRestartCommand } from '../install/lib/service.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = 'gturhan71/Enflow'; // GitHub owner/repo (API best-effort)

// ── Yardımcılar ───────────────────────────────────────────────────────────────
function git(home, args) {
  return execFileSync('git', ['-C', home, ...args], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function gitSafe(home, args) {
  try { return git(home, args); } catch { return ''; }
}

/** ENFLOW_HOME: env > aracın üst dizini (repo kökü, license-tool gibi repo içinde). */
export function resolveHome() {
  if (process.env.ENFLOW_HOME) return resolve(process.env.ENFLOW_HOME);
  const parent = resolve(HERE, '..');
  if (existsSync(join(parent, 'package.json')) && existsSync(join(parent, 'backend'))) return parent;
  return process.cwd();
}

/** semver "vX.Y.Z" / "X.Y.Z" → [X,Y,Z] | null (semver olmayan tag'ler elenir). */
function parseSemver(tag) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag.trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function cmpSemver(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

// ── Sürüm tespiti ───────────────────────────────────────────────────────────────
export function currentVersion(home) {
  const sha = gitSafe(home, ['rev-parse', 'HEAD']);
  const date = gitSafe(home, ['show', '-s', '--format=%cI', 'HEAD']);
  const tag = gitSafe(home, ['describe', '--tags', '--abbrev=0']) || null;
  let pkg = null;
  try { pkg = JSON.parse(readFileSync(join(home, 'backend', 'package.json'), 'utf-8')).version || null; } catch { /* yut */ }
  return { sha: sha || null, shortSha: sha ? sha.slice(0, 7) : null, date: date || null, tag, pkgVersion: pkg };
}

/** GitHub API'den commit/release meta (best-effort; ağ yoksa null). */
function githubJson(path) {
  return new Promise((res) => {
    import('node:https').then(({ request }) => {
      const req = request(
        { host: 'api.github.com', path, method: 'GET', headers: { 'User-Agent': 'enflow-upgrade-tool', Accept: 'application/vnd.github+json' }, timeout: 6000 },
        (r) => { let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => { try { res(JSON.parse(d)); } catch { res(null); } }); }
      );
      req.on('error', () => res(null));
      req.on('timeout', () => { req.destroy(); res(null); });
      req.end();
    }).catch(() => res(null));
  });
}

/**
 * En son yayınlanan sürüm. channel: 'auto'|'tag'|'commit'.
 * 'auto' (varsayılan, kullanıcı kararı): tag varsa semver tag, yoksa commit.
 */
export async function latestVersion(home, channel = 'auto') {
  gitSafe(home, ['fetch', '--tags', '--quiet', 'origin']);
  const branch = gitSafe(home, ['rev-parse', '--abbrev-ref', 'HEAD']) || 'main';

  // Uzak tag'ler (semver)
  let bestTag = null;
  if (channel === 'auto' || channel === 'tag') {
    const out = gitSafe(home, ['ls-remote', '--tags', '--refs', 'origin']);
    const tags = out.split('\n').map((l) => l.split('\t')[1]).filter(Boolean)
      .map((r) => r.replace('refs/tags/', '')).map((t) => ({ t, v: parseSemver(t) })).filter((x) => x.v);
    if (tags.length) bestTag = tags.sort((a, b) => cmpSemver(a.v, b.v)).at(-1).t;
  }
  if (bestTag) {
    let notes = null, publishedAt = null;
    const rel = await githubJson(`/repos/${REPO}/releases/tags/${bestTag}`);
    if (rel && !rel.message) { notes = rel.body || rel.name || null; publishedAt = rel.published_at || null; }
    return { kind: 'tag', target: bestTag, ref: bestTag, notes, publishedAt };
  }

  // Commit kanalı: uzak branch HEAD
  const lsout = gitSafe(home, ['ls-remote', 'origin', branch]);
  const remoteSha = lsout.split('\t')[0] || null;
  let notes = null, publishedAt = null;
  const c = await githubJson(`/repos/${REPO}/commits/${branch}`);
  if (c && c.commit) { notes = c.commit.message ? c.commit.message.split('\n')[0] : null; publishedAt = c.commit.committer?.date || null; }
  return { kind: 'commit', target: remoteSha ? remoteSha.slice(0, 7) : null, ref: remoteSha, notes, publishedAt };
}

/** Yerel ile uzak karşılaştır → güncelleme var mı. */
export function compare(home, current, latest) {
  if (!latest.ref) return { available: false, reason: 'remote-unknown' };
  if (latest.kind === 'commit') {
    if (current.sha === latest.ref) return { available: false };
    // Yerel HEAD, uzak ref'in atası mı? (yani geride miyiz)
    const isAncestor = (() => { try { git(home, ['merge-base', '--is-ancestor', current.sha, latest.ref]); return true; } catch { return false; } })();
    return { available: current.sha !== latest.ref, behind: isAncestor, ...latest };
  }
  // tag: yereldeki en yakın tag ile uzak en yüksek tag karşılaştır
  const curV = current.tag ? parseSemver(current.tag) : null;
  const remV = parseSemver(latest.target);
  if (!remV) return { available: false, reason: 'bad-remote-tag' };
  if (!curV) return { available: true, ...latest };
  return { available: cmpSemver(remV, curV) > 0, ...latest };
}

// ── Durum dosyası köprüsü (uygulama bunu okur) ──────────────────────────────────
export function statusPath(home) { return join(home, 'update-status.json'); }

export function writeStatus(home, status) {
  const p = statusPath(home);
  const tmp = p + '.tmp';
  writeFileSync(tmp, JSON.stringify(status, null, 2));
  renameSync(tmp, p); // atomik
  return p;
}
export function readStatus(home) {
  try { return JSON.parse(readFileSync(statusPath(home), 'utf-8')); } catch { return null; }
}

/** Kontrol et + durum dosyası yaz. Döner: tam durum nesnesi. */
export async function checkAndWrite(home, channel = 'auto') {
  const current = currentVersion(home);
  const latest = await latestVersion(home, channel);
  const cmp = compare(home, current, latest);
  const status = {
    checkedAt: new Date().toISOString(),
    current,
    update: {
      available: !!cmp.available,
      kind: latest.kind,
      target: latest.target,
      ref: latest.ref,
      notes: latest.notes || null,
      publishedAt: latest.publishedAt || null,
    },
  };
  writeStatus(home, status);
  return status;
}

// ── Yükseltme (yıkıcı — ön-yedek + rollback) ────────────────────────────────────
function readBackendEnv(home) {
  const out = {};
  try {
    for (const line of readFileSync(join(home, 'backend', '.env'), 'utf-8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/.exec(line);
      if (m) out[m[1]] = m[2];
    }
  } catch { /* yut */ }
  return out;
}

function dbProvider(home) {
  const url = readBackendEnv(home).DATABASE_URL;
  if (url && /^postgres/i.test(url)) return { kind: 'postgres', url };
  if (url && /^file:/i.test(url)) return { kind: 'sqlite', file: url.replace(/^file:/, '') };
  // Varsayılan dev: backend/dev.db
  if (existsSync(join(home, 'backend', 'dev.db'))) return { kind: 'sqlite', file: './dev.db' };
  return { kind: 'unknown' };
}

// Prisma-özel URL parametreleri (ör. ?schema=public) libpq araçlarında (pg_dump/psql) hata verir.
const PRISMA_ONLY_PARAMS = ['schema', 'connection_limit', 'pool_timeout', 'pgbouncer', 'statement_cache_size', 'socket_timeout'];
export function toLibpqUrl(url) {
  try { const u = new URL(url); for (const p of PRISMA_ONLY_PARAMS) u.searchParams.delete(p); return u.toString(); } catch { return url; }
}
/** Log/ipucu için parola maskeleme. */
export function redactUrl(url) {
  try { const u = new URL(url); if (u.password) u.password = '****'; return u.toString(); } catch { return '<url>'; }
}

// FORCE RLS altında pg_dump varsayılan olarak durur → --enable-row-security + app.bypass_rls=on
const PG_RLS_ENV = () => ({ ...process.env, PGOPTIONS: `${process.env.PGOPTIONS ?? ''} -c app.bypass_rls=on`.trim() });

function backupDb(home, log, opts) {
  const db = dbProvider(home);
  if (db.kind === 'sqlite') {
    const abs = resolve(join(home, 'backend'), db.file);
    if (!existsSync(abs)) return null;
    const stamp = Date.now();
    const files = [];
    // WAL modunda son yazılanlar -wal'dadır → üçü birlikte kopyalanır
    for (const ext of ['', '-wal', '-shm']) {
      if (existsSync(abs + ext)) { copyFileSync(abs + ext, `${abs}.pre-upgrade-${stamp}${ext}`); files.push(ext); }
    }
    log(`ön-yedek: SQLite → ${abs}.pre-upgrade-${stamp} (${files.map((e) => e || '.db').join(', ')})`);
    return { kind: 'sqlite', src: abs, stamp, files };
  }
  if (db.kind === 'postgres') {
    const dumpUrl = toLibpqUrl(opts.migratorUrl || db.url);
    const dir = join(home, 'backend', 'backups');
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `pre-upgrade-${Date.now()}.dump`);
    try {
      execFileSync('pg_dump', ['-Fc', '--enable-row-security', '-f', file, dumpUrl], { stdio: ['ignore', 'ignore', 'pipe'], env: PG_RLS_ENV() });
    } catch (e) {
      const why = e.code === 'ENOENT' ? 'pg_dump bulunamadı' : String(e.stderr || e.message).trim().slice(0, 300);
      if (opts.skipPgBackup) { log(`UYARI: Postgres ön-yedeği alınamadı (${why}) — skipPgBackup ile devam.`); return null; }
      throw new Error(`Postgres ön-yedeği alınamadı (${why}). PostgreSQL istemci araçlarını kurun veya bilinçli olarak skipPgBackup ile atlayın.`);
    }
    log(`ön-yedek: Postgres → ${file}`);
    return { kind: 'postgres', backup: file, url: dumpUrl };
  }
  return null;
}

function restoreDb(snap, log) {
  if (snap?.kind === 'sqlite') {
    for (const ext of ['', '-wal', '-shm']) {
      const bak = `${snap.src}.pre-upgrade-${snap.stamp}${ext}`;
      if (snap.files.includes(ext)) copyFileSync(bak, snap.src + ext);
      else if (ext && existsSync(snap.src + ext)) rmSync(snap.src + ext); // yedekte yoksa yeni sürümün WAL'ı kalmasın
    }
    log(`geri yükleme: SQLite ← ${snap.src}.pre-upgrade-${snap.stamp}`);
  } else if (snap?.kind === 'postgres') {
    // Postgres otomatik geri yüklenmez (ADR-002) — operatöre hazır komut
    log('Postgres VERİTABANI OTOMATİK GERİ YÜKLENMEDİ. Gerekirse (servis durdurulmuşken, migrator/superuser ile):');
    log(`  PGOPTIONS="-c app.bypass_rls=on" pg_restore --clean --if-exists --no-owner -d "${redactUrl(snap.url)}" "${snap.backup}"`);
  }
}

function run(home, cmd, args, log, opts = {}) {
  return new Promise((res, rej) => {
    log(`$ ${cmd} ${args.join(' ')}`);
    const child = execFile(cmd, args, { cwd: opts.cwd || home, env: opts.env || process.env, maxBuffer: 64 * 1024 * 1024 });
    child.stdout?.on('data', (d) => log(String(d).trimEnd()));
    child.stderr?.on('data', (d) => log(String(d).trimEnd()));
    child.on('close', (code) => (code === 0 ? res() : rej(new Error(`${cmd} ${args[0]} çıkış kodu ${code}`))));
    child.on('error', rej);
  });
}

/** /api/health 200 + db:ok gelene dek yoklar. true=sağlıklı. */
export async function waitForHealth(url, { timeoutMs = 60_000, intervalMs = 2_000, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now } = {}) {
  const deadline = now() + timeoutMs;
  while (now() < deadline) {
    try {
      const r = await fetchImpl(url, { signal: AbortSignal.timeout(Math.min(intervalMs * 2, 5_000)) });
      if (r.ok) {
        const body = await r.json().catch(() => ({}));
        if (body.db === undefined || body.db === 'ok') return true;
      }
    } catch { /* henüz ayakta değil */ }
    await sleep(intervalMs);
  }
  return false;
}

/** Yeniden başlatır → true (health yoklanmalı) | false (mekanizma yok, elle). Hata fırlatır. */
function restartBackend(home, opts, log) {
  if (opts.restartCommand) {
    log(`restart: ${opts.restartCommand}`);
    if (process.platform === 'win32') execFileSync('cmd.exe', ['/d', '/s', '/c', opts.restartCommand], { stdio: 'inherit' });
    else execFileSync('sh', ['-c', opts.restartCommand], { stdio: 'inherit' });
    return true;
  }
  const svc = resolveRestartCommand({ home });
  if (svc) {
    log(`restart (servis): ${svc.cmd} ${svc.args.join(' ')}`);
    execFileSync(svc.cmd, svc.args, { stdio: 'inherit' });
    return true;
  }
  log('NOT: kurulu servis bulunamadı ve restartCommand ayarlı değil — backend\'i elle yeniden başlatın (sağlık kontrolü atlandı).');
  return false;
}

function pgRlsInstalled(url) {
  try {
    const out = execFileSync('psql', [url, '-tAc', "SELECT count(*) FROM pg_policies WHERE policyname = 'tenant_isolation'"], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
    return Number(out.trim()) > 0;
  } catch { return null; } // psql yok/erişim yok → bilinmiyor
}

/**
 * Güvenli yükseltme. opts: { channel, log, allowDirty, restartCommand, migratorUrl,
 * skipPgBackup, healthTimeoutMs }. Hata (sağlıksız açılış dahil) → kod geri alınır,
 * SQLite geri yüklenir, Postgres için pg_restore komutu loglanır. Döner: { ok, from, to, error? }.
 */
export async function runUpgrade(home, opts = {}) {
  const log = opts.log || (() => {});
  const channel = opts.channel || 'auto';
  const from = currentVersion(home);
  const prevRef = from.sha;
  const backend = join(home, 'backend');

  // 1) preflight: temiz çalışma ağacı (.env, uploads, *.db git-ignore → porcelain'da görünmez)
  const dirty = gitSafe(home, ['status', '--porcelain']);
  if (dirty && !opts.allowDirty) {
    return { ok: false, from, error: 'Çalışma ağacı kirli (git status). allowDirty ile zorla ya da temizle.\n' + dirty };
  }

  // Postgres: şema DDL'i yalnız migrator rolüyle (runtime rolünde DDL yok) — değişiklikten ÖNCE kontrol
  const db = dbProvider(home);
  const migratorUrl = opts.migratorUrl || process.env.ENFLOW_MIGRATOR_URL || null;
  if (db.kind === 'postgres' && !migratorUrl) {
    return { ok: false, from, error: 'Postgres yükseltmesi migrator (DDL) kimliği gerektirir: ENFLOW_MIGRATOR_URL ortam değişkeni veya upgrade-tool/config.json → migratorUrl. Hiçbir değişiklik yapılmadı.' };
  }
  const prismaEnv = db.kind === 'postgres' ? { ...process.env, DATABASE_URL: migratorUrl } : process.env;
  const healthUrl = `http://127.0.0.1:${readBackendEnv(home).PORT || 3002}/api/health`;
  const healthOpts = { timeoutMs: opts.healthTimeoutMs ?? 60_000 };

  // 2) hedef
  const latest = await latestVersion(home, channel);
  const cmp = compare(home, from, latest);
  if (!cmp.available) { log('Zaten güncel.'); return { ok: true, from, to: from, noop: true }; }

  let snap = null;
  try {
    // 2b) ön-yedek
    snap = backupDb(home, log, { migratorUrl, skipPgBackup: opts.skipPgBackup });

    // 3) kaynak güncelle
    await run(home, 'git', ['fetch', '--all', '--tags', '--prune'], log);
    if (latest.kind === 'tag') await run(home, 'git', ['checkout', latest.target], log);
    else await run(home, 'git', ['pull', '--ff-only'], log);

    // 4) bağımlılıklar
    await run(home, 'pnpm', ['install'], log);
    await run(home, 'pnpm', ['install'], log, { cwd: backend });

    // 5) DB şeması — prisma.config.ts DATABASE_URL'den sağlayıcıya göre şema/migration klasörü seçer
    await run(home, 'pnpm', ['prisma', 'generate'], log, { cwd: backend, env: prismaEnv });
    await run(home, 'pnpm', ['prisma', 'migrate', 'deploy'], log, { cwd: backend, env: prismaEnv });

    // 6) build — backend (`pnpm start` = derlenmiş dist, ADR-001) + frontend
    await run(home, 'pnpm', ['build'], log, { cwd: backend });
    await run(home, 'pnpm', ['build'], log);

    // 6b) Postgres RLS kuruluysa yeni tablolar için politikaları yeniden uygula (idempotent)
    if (db.kind === 'postgres') {
      const rls = pgRlsInstalled(toLibpqUrl(migratorUrl));
      if (rls) await run(home, 'node', ['dist/scripts/apply-postgres-rls.js'], log, { cwd: backend, env: prismaEnv });
      else if (rls === null) log('UYARI: RLS durumu okunamadı (psql?) — RLS kullanıyorsanız elle: DATABASE_URL=<migrator> node dist/scripts/apply-postgres-rls.js');
    }

    // 7) restart + sağlık doğrulaması
    if (restartBackend(home, opts, log)) {
      log(`sağlık kontrolü: ${healthUrl} (en fazla ${Math.round(healthOpts.timeoutMs / 1000)} sn)`);
      if (!(await waitForHealth(healthUrl, healthOpts))) {
        throw new Error(`Yükseltme sonrası backend ${Math.round(healthOpts.timeoutMs / 1000)} sn içinde sağlıklı açılmadı (${healthUrl}).`);
      }
      log('✓ backend sağlıklı.');
    }

    const to = currentVersion(home);
    writeStatus(home, { checkedAt: new Date().toISOString(), current: to, update: { available: false, applied: true, from: prevRef?.slice(0, 7), to: to.shortSha, appliedAt: new Date().toISOString() } });
    return { ok: true, from, to };
  } catch (e) {
    log('HATA: ' + e.message);
    log('↩ ROLLBACK başlıyor...');
    try { if (prevRef) await run(home, 'git', ['reset', '--hard', prevRef], log); } catch (er) { log('git reset hata: ' + er.message); }
    restoreDb(snap, log);
    try {
      await run(home, 'pnpm', ['install'], log);
      await run(home, 'pnpm', ['install'], log, { cwd: backend });
      // Geri alınan koda yeni sürümün client'ı/dist'i eşlik etmesin
      await run(home, 'pnpm', ['prisma', 'generate'], log, { cwd: backend, env: prismaEnv });
      await run(home, 'pnpm', ['build'], log, { cwd: backend });
      await run(home, 'pnpm', ['build'], log);
      if (restartBackend(home, opts, log)) {
        log((await waitForHealth(healthUrl, healthOpts)) ? '✓ önceki sürüm sağlıklı açıldı.' : 'UYARI: önceki sürüm de sağlıklı açılmadı — elle müdahale gerekli.');
      }
    } catch (er) { log('rollback adımı hata: ' + er.message); }
    writeStatus(home, { checkedAt: new Date().toISOString(), current: currentVersion(home), update: { available: true, failed: true, error: e.message, ref: latest.ref, target: latest.target } });
    return { ok: false, from, error: e.message };
  }
}

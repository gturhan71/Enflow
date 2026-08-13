// Enflow Upgrade Tool — çekirdek (bağımlılıksız, yalnız Node built-in).
// On-prem kurulumun git deposunu inceler, uzak "en son yayınlanan" sürümü
// belirler (tag varsa semver tag, yoksa origin/main commit) ve istenirse
// güvenli sıra ile yükseltir. UYGULAMANIN İÇİNDE DEĞİL — ayrı süreç.
import { execFileSync, execFile } from 'node:child_process';
import { readFileSync, writeFileSync, renameSync, existsSync, copyFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
function dbProvider(home) {
  try {
    const env = readFileSync(join(home, 'backend', '.env'), 'utf-8');
    const m = /DATABASE_URL\s*=\s*"?([^"\n]+)"?/.exec(env);
    if (m && /^postgres/i.test(m[1])) return { kind: 'postgres', url: m[1] };
    if (m && /^file:/i.test(m[1])) return { kind: 'sqlite', file: m[1].replace(/^file:/, '') };
  } catch { /* yut */ }
  // Varsayılan dev: backend/dev.db
  if (existsSync(join(home, 'backend', 'dev.db'))) return { kind: 'sqlite', file: './dev.db' };
  return { kind: 'unknown' };
}

function backupDb(home, log) {
  const db = dbProvider(home);
  if (db.kind === 'sqlite') {
    const abs = resolve(join(home, 'backend'), db.file);
    if (existsSync(abs)) {
      const dest = abs + '.pre-upgrade-' + Date.now();
      copyFileSync(abs, dest);
      log(`ön-yedek: SQLite → ${dest}`);
      return { kind: 'sqlite', src: abs, backup: dest };
    }
  } else if (db.kind === 'postgres') {
    log('ön-yedek: Postgres — pg_dump operatör sorumluluğunda (atlanıyor).');
  }
  return null;
}
function restoreDb(snap, log) {
  if (snap?.kind === 'sqlite' && existsSync(snap.backup)) {
    copyFileSync(snap.backup, snap.src);
    log(`geri yükleme: SQLite ← ${snap.backup}`);
  }
}

function run(home, cmd, args, log, opts = {}) {
  return new Promise((res, rej) => {
    log(`$ ${cmd} ${args.join(' ')}`);
    const child = execFile(cmd, args, { cwd: opts.cwd || home, env: process.env, maxBuffer: 64 * 1024 * 1024 });
    child.stdout?.on('data', (d) => log(String(d).trimEnd()));
    child.stderr?.on('data', (d) => log(String(d).trimEnd()));
    child.on('close', (code) => (code === 0 ? res() : rej(new Error(`${cmd} ${args[0]} çıkış kodu ${code}`))));
    child.on('error', rej);
  });
}

/**
 * Güvenli yükseltme. opts: { channel, log, allowDirty, restartCommand }.
 * Hata → git reset + DB geri yükleme (rollback). Döner: { ok, from, to, error? }.
 */
export async function runUpgrade(home, opts = {}) {
  const log = opts.log || (() => {});
  const channel = opts.channel || 'auto';
  const from = currentVersion(home);
  const prevRef = from.sha;

  // 1) preflight: temiz çalışma ağacı (.env, uploads, *.db git-ignore → porcelain'da görünmez)
  const dirty = gitSafe(home, ['status', '--porcelain']);
  if (dirty && !opts.allowDirty) {
    return { ok: false, from, error: 'Çalışma ağacı kirli (git status). allowDirty ile zorla ya da temizle.\n' + dirty };
  }

  // 2) hedef
  const latest = await latestVersion(home, channel);
  const cmp = compare(home, from, latest);
  if (!cmp.available) { log('Zaten güncel.'); return { ok: true, from, to: from, noop: true }; }

  let snap = null;
  try {
    // 2b) ön-yedek
    snap = backupDb(home, log);

    // 3) kaynak güncelle
    await run(home, 'git', ['fetch', '--all', '--tags', '--prune'], log);
    if (latest.kind === 'tag') await run(home, 'git', ['checkout', latest.target], log);
    else await run(home, 'git', ['pull', '--ff-only'], log);

    // 4) bağımlılıklar
    await run(home, 'pnpm', ['install'], log);
    await run(home, 'pnpm', ['install'], log, { cwd: join(home, 'backend') });

    // 5) DB şeması
    await run(home, 'pnpm', ['prisma', 'generate'], log, { cwd: join(home, 'backend') });
    await run(home, 'pnpm', ['prisma', 'migrate', 'deploy'], log, { cwd: join(home, 'backend') });

    // 6) frontend build
    await run(home, 'pnpm', ['build'], log);

    const to = currentVersion(home);
    writeStatus(home, { checkedAt: new Date().toISOString(), current: to, update: { available: false, applied: true, from: prevRef?.slice(0, 7), to: to.shortSha, appliedAt: new Date().toISOString() } });

    // 7) restart (aracın başlatmadığı süreç → ayarlanabilir komut)
    if (opts.restartCommand) {
      log(`restart: ${opts.restartCommand}`);
      try {
        if (process.platform === 'win32') execFileSync('cmd.exe', ['/d', '/s', '/c', opts.restartCommand], { stdio: 'inherit' });
        else execFileSync('sh', ['-c', opts.restartCommand], { stdio: 'inherit' });
      } catch (e) { log('restart komutu hata verdi: ' + e.message); }
    } else {
      log('NOT: restartCommand ayarlı değil — backend/frontend süreçlerini elle yeniden başlatın.');
    }
    return { ok: true, from, to };
  } catch (e) {
    log('HATA: ' + e.message);
    log('↩ ROLLBACK başlıyor...');
    try { if (prevRef) await run(home, 'git', ['reset', '--hard', prevRef], log); } catch (er) { log('git reset hata: ' + er.message); }
    restoreDb(snap, log);
    try { await run(home, 'pnpm', ['install'], log); await run(home, 'pnpm', ['install'], log, { cwd: join(home, 'backend') }); } catch { /* yut */ }
    writeStatus(home, { checkedAt: new Date().toISOString(), current: currentVersion(home), update: { available: true, failed: true, error: e.message, ref: latest.ref, target: latest.target } });
    return { ok: false, from, error: e.message };
  }
}

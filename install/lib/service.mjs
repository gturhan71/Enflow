// OS-native servis tanımları (ADR-001) — kurulum sihirbazı (M3: şablon render +
// kurulum) ve upgrade-tool (yeniden başlatma) ORTAK kullanır. Bağımlılık YOK.
// Servis adları tek kaynak burada; şablonlar (install/service/*) bunlarla eşleşmeli.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path, { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';

export const SERVICE = {
  systemdUnit: 'enflow',                 // /etc/systemd/system/enflow.service
  launchdLabel: 'com.enflow.backend',    // /Library/LaunchDaemons/<label>.plist (sistem)
  winswId: 'enflow',                     // <home>/service/enflow-service.exe (+ .xml)
};

export const launchdDaemonPlist = () => `/Library/LaunchDaemons/${SERVICE.launchdLabel}.plist`;
export const launchdAgentPlist = () => join(homedir(), 'Library', 'LaunchAgents', `${SERVICE.launchdLabel}.plist`);
export const winswExePath = (home) => join(home, 'service', `${SERVICE.winswId}-service.exe`);

const defaultProbe = {
  exists: (p) => existsSync(p),
  status: (cmd, args) => spawnSync(cmd, args, { stdio: 'ignore' }).status,
  uid: () => (typeof process.getuid === 'function' ? process.getuid() : 0),
  isRoot: () => typeof process.getuid === 'function' && process.getuid() === 0,
};

/**
 * Kurulu Enflow servisinin yeniden başlatma komutları — DENEME SIRASIYLA ({ cmd, args }[]; boş = servis yok).
 * Sistem düzeyi servisler (systemd, LaunchDaemon) yeniden başlatmak için root ister; upgrade-tool normal
 * kullanıcıyla çalıştığından root değilse ikinci aday `sudo -n` (parolasız sudo, etkileşimsiz) olur.
 * Windows (WinSW) yönetici ister — sudo yoktur, yetki yoksa tek aday başarısız olur ve operatöre bildirilir.
 * Shell KULLANILMAZ (execFile) — argümanlar ayrı. `probe` testte enjekte edilir.
 */
export function resolveRestartCommands({ platform = process.platform, home, probe = defaultProbe } = {}) {
  const isRoot = typeof probe.isRoot === 'function' ? probe.isRoot() : false;
  const withSudo = (c) => (isRoot ? [c] : [c, { cmd: 'sudo', args: ['-n', c.cmd, ...c.args] }]);
  if (platform === 'linux') {
    if (probe.status('systemctl', ['is-enabled', SERVICE.systemdUnit]) === 0) {
      return withSudo({ cmd: 'systemctl', args: ['restart', SERVICE.systemdUnit] });
    }
    return [];
  }
  if (platform === 'darwin') {
    if (probe.exists(launchdDaemonPlist())) return withSudo({ cmd: 'launchctl', args: ['kickstart', '-k', `system/${SERVICE.launchdLabel}`] });
    if (probe.exists(launchdAgentPlist())) return [{ cmd: 'launchctl', args: ['kickstart', '-k', `gui/${probe.uid()}/${SERVICE.launchdLabel}`] }];
    return [];
  }
  if (platform === 'win32') {
    const exe = winswExePath(home);
    if (probe.exists(exe)) return [{ cmd: exe, args: ['restart'] }];
    return [];
  }
  return [];
}

/** Geriye uyumlu: ilk aday ya da null. */
export function resolveRestartCommand(opts = {}) {
  return resolveRestartCommands(opts)[0] ?? null;
}

// ── Şablon üretimi + kurulum planı (M3 / T14–T16) ─────────────────────────────────
const TEMPLATE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'service');
const TEMPLATE_FILES = {
  systemd: 'enflow.service.tmpl',
  launchd: 'com.enflow.backend.plist.tmpl',
  winsw: 'enflow-service.xml.tmpl',
};
const xmlEscape = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// systemd'de % özel karakter (specifier) → %% ile kaçırılır
const systemdEscape = (v) => String(v).replace(/%/g, '%%');
const USER_RE = /^[A-Za-z_][A-Za-z0-9_.-]*\$?$/;

/**
 * Şablonu doldurur. kind: 'systemd' | 'launchd' | 'winsw'. vars: { home, node, user? }.
 * Eksik/artık {{YER_TUTUCU}} kalırsa hata (sessizce bozuk servis dosyası üretme).
 */
export function renderServiceFile(kind, vars, { templateDir = TEMPLATE_DIR } = {}) {
  const file = TEMPLATE_FILES[kind];
  if (!file) throw new Error(`Bilinmeyen servis türü: ${kind}`);
  const { home, node, user } = vars;
  if (!home || !node) throw new Error('home ve node zorunlu.');
  if (user !== undefined && user !== '' && !USER_RE.test(user)) throw new Error(`Geçersiz kullanıcı adı: ${user}`);
  let map;
  if (kind === 'systemd') {
    if (!user) throw new Error('systemd için user zorunlu.');
    map = { USER: user, HOME: systemdEscape(home), NODE: systemdEscape(node) };
  } else if (kind === 'launchd') {
    map = {
      LABEL: SERVICE.launchdLabel, HOME: xmlEscape(home), NODE: xmlEscape(node), NODE_DIR: xmlEscape(path.posix.dirname(node)),
      USERNAME_KEY: user ? `  <key>UserName</key><string>${xmlEscape(user)}</string>\n` : '',
    };
  } else {
    map = { ID: SERVICE.winswId, HOME: xmlEscape(home), NODE: xmlEscape(node) };
  }
  const out = readFileSync(join(templateDir, file), 'utf-8').replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in map ? map[k] : m));
  const left = out.match(/\{\{[A-Z_]+\}\}/);
  if (left) throw new Error(`Şablonda doldurulmamış yer tutucu: ${left[0]}`);
  return out;
}

/**
 * İşletim sistemine göre kurulum PLANI (saf — hiçbir şey çalıştırmaz/yazmaz).
 * Wizard `files`'ı yazar, `commands`'ı sırayla çalıştırır. sudo:true → root değilse sudo ile.
 * mode (yalnız macOS): 'daemon' (sistem, açılışta; sudo) | 'agent' (kullanıcı oturumunda).
 */
export function planInstall({ platform = process.platform, home, node, user, mode = 'daemon', uid = 0, isRoot = false, templateDir } = {}) {
  const P = platform === 'win32' ? path.win32 : path.posix;
  const dir = P.join(home, 'service');
  const sudo = !isRoot;
  // dirs: wizard fs.mkdirSync ile açar (mkdir komutu Windows'ta yok); files: yazılacak dosyalar
  const plan = { platform, service: null, dirs: [P.join(home, 'logs')], files: [], commands: [], notes: [] };

  if (platform === 'linux') {
    const dest = `/etc/systemd/system/${SERVICE.systemdUnit}.service`;
    const src = P.join(dir, `${SERVICE.systemdUnit}.service`);
    plan.service = SERVICE.systemdUnit;
    plan.files.push({ path: src, content: renderServiceFile('systemd', { home, node, user }, { templateDir }) });
    plan.commands.push(
      { cmd: 'cp', args: [src, dest], sudo },
      { cmd: 'systemctl', args: ['daemon-reload'], sudo },
      { cmd: 'systemctl', args: ['enable', '--now', SERVICE.systemdUnit], sudo },
    );
    plan.notes.push(`Loglar: journalctl -u ${SERVICE.systemdUnit} -f`);
  } else if (platform === 'darwin') {
    const label = SERVICE.launchdLabel;
    const src = P.join(dir, `${label}.plist`);
    const daemon = mode !== 'agent';
    const dest = daemon ? launchdDaemonPlist() : launchdAgentPlist();
    const domain = daemon ? 'system' : `gui/${uid}`;
    plan.service = label;
    plan.files.push({ path: src, content: renderServiceFile('launchd', { home, node, user: daemon ? user : undefined }, { templateDir }) });
    if (daemon) {
      plan.commands.push(
        { cmd: 'launchctl', args: ['bootout', `${domain}/${label}`], sudo, ignoreFailure: true },
        { cmd: 'cp', args: [src, dest], sudo },
        { cmd: 'chown', args: ['root:wheel', dest], sudo },
        { cmd: 'chmod', args: ['644', dest], sudo },
        { cmd: 'launchctl', args: ['bootstrap', domain, dest], sudo },
      );
    } else {
      plan.commands.push(
        { cmd: 'launchctl', args: ['bootout', `${domain}/${label}`], sudo: false, ignoreFailure: true },
        { cmd: 'cp', args: [src, dest], sudo: false },
        { cmd: 'launchctl', args: ['bootstrap', domain, dest], sudo: false },
      );
      plan.dirs.push(dirname(dest)); // ~/Library/LaunchAgents yoksa oluştur
      plan.notes.push('LaunchAgent yalnız kullanıcı oturum açtığında çalışır — sunucu için "daemon" modunu seçin.');
    }
    plan.notes.push(`Loglar: ${P.join(home, 'logs', 'backend.log')} (döndürme yok — newsyslog ile yönetin)`);
  } else if (platform === 'win32') {
    const exe = winswExePath(home);
    plan.service = SERVICE.winswId;
    plan.needsWinsw = { exe };
    plan.requiresAdmin = true;
    plan.files.push({ path: P.join(dir, `${SERVICE.winswId}-service.xml`), content: renderServiceFile('winsw', { home, node }, { templateDir }) });
    plan.commands.push(
      { cmd: exe, args: ['install'], sudo: false },
      { cmd: exe, args: ['start'], sudo: false },
    );
    plan.notes.push('Yönetici olarak açılmış PowerShell/CMD gerekir. Loglar: ' + P.join(home, 'logs'));
  } else {
    throw new Error(`Desteklenmeyen platform: ${platform}`);
  }
  return plan;
}

// ── WinSW indirme (T15) — sabit sürüm + SHA256; doğrulanmadan ASLA diske yazılmaz ────
export function loadWinswLock({ lockPath = join(TEMPLATE_DIR, 'winsw.lock.json') } = {}) {
  return JSON.parse(readFileSync(lockPath, 'utf-8'));
}

/**
 * WinSW exe'yi lock'taki URL'den indirir; boyut + SHA256 eşleşmezse HATA (dosya yazılmaz).
 * sha256 boşsa indirme reddedilir. fetchImpl testte enjekte edilir.
 */
export async function downloadWinsw(exePath, { lock = loadWinswLock(), fetchImpl = fetch } = {}) {
  if (!lock.sha256 || !/^[0-9a-f]{64}$/i.test(lock.sha256)) {
    throw new Error('winsw.lock.json içinde geçerli sha256 yok — indirme reddedildi. WinSW\'yi elle kurun: ' + lock.url);
  }
  const res = await fetchImpl(lock.url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`WinSW indirilemedi (HTTP ${res.status}).`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (lock.size && buf.length !== lock.size) throw new Error(`WinSW boyutu beklenenden farklı (${buf.length} ≠ ${lock.size}) — indirme reddedildi.`);
  const got = createHash('sha256').update(buf).digest('hex');
  if (got.toLowerCase() !== lock.sha256.toLowerCase()) throw new Error(`WinSW SHA256 uyuşmuyor (beklenen ${lock.sha256}, gelen ${got}) — indirme reddedildi, dosya yazılmadı.`);
  mkdirSync(dirname(exePath), { recursive: true });
  const part = exePath + '.part';
  try { writeFileSync(part, buf); renameSync(part, exePath); } catch (e) { try { rmSync(part, { force: true }); } catch { /* yut */ } throw e; }
  return { version: lock.version, sha256: got, bytes: buf.length };
}

// ── Planı uygulama (T16) — wizard kullanır; exec/mkdir/write enjekte edilebilir ─────
const quoteArg = (a) => (/\s/.test(a) ? `"${a}"` : a);
/** İnsan-okur komut satırı (elle kurulum talimatı için). */
export function formatCommand(c) {
  return `${c.sudo ? 'sudo ' : ''}${[c.cmd, ...c.args].map(quoteArg).join(' ')}`;
}

/**
 * planInstall çıktısını uygular: dizinler → dosyalar → komutlar (sırayla).
 * Komut hatasında DURUR; kalan komutlar `manual`'da (operatöre elle çalıştırması için).
 * dry=true → hiçbir şey yazmaz/çalıştırmaz, yalnız log. Döner: { ok, failed?, manual? }.
 */
export function executePlan(plan, {
  run = (cmd, args) => spawnSync(cmd, args, { stdio: 'inherit' }).status,
  mkdir = (d) => mkdirSync(d, { recursive: true }),
  write = (f, c) => { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, c); },
  log = () => {},
  dry = false,
} = {}) {
  for (const d of plan.dirs ?? []) { log(`dizin: ${d}`); if (!dry) mkdir(d); }
  for (const f of plan.files) { log(`yaz: ${f.path}`); if (!dry) write(f.path, f.content); }
  for (let i = 0; i < plan.commands.length; i++) {
    const c = plan.commands[i];
    log(`$ ${formatCommand(c)}`);
    if (dry) continue;
    const [cmd, args] = c.sudo ? ['sudo', [c.cmd, ...c.args]] : [c.cmd, c.args];
    const status = run(cmd, args);
    if (status !== 0 && !c.ignoreFailure) {
      return { ok: false, failed: formatCommand(c), manual: plan.commands.slice(i).map(formatCommand) };
    }
  }
  return { ok: true };
}

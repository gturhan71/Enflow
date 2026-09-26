// OS-native servis tanımları (ADR-001) — kurulum sihirbazı (M3: şablon render +
// kurulum) ve upgrade-tool (yeniden başlatma) ORTAK kullanır. Bağımlılık YOK.
// Servis adları tek kaynak burada; şablonlar (install/service/*) bunlarla eşleşmeli.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path, { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

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
};

/**
 * Kurulu Enflow servisinin yeniden başlatma komutu → { cmd, args } | null (servis yok).
 * Shell KULLANILMAZ (execFile) — argümanlar ayrı. `probe` testte enjekte edilir.
 */
export function resolveRestartCommand({ platform = process.platform, home, probe = defaultProbe } = {}) {
  if (platform === 'linux') {
    if (probe.status('systemctl', ['is-enabled', SERVICE.systemdUnit]) === 0) {
      return { cmd: 'systemctl', args: ['restart', SERVICE.systemdUnit] };
    }
    return null;
  }
  if (platform === 'darwin') {
    if (probe.exists(launchdDaemonPlist())) return { cmd: 'launchctl', args: ['kickstart', '-k', `system/${SERVICE.launchdLabel}`] };
    if (probe.exists(launchdAgentPlist())) return { cmd: 'launchctl', args: ['kickstart', '-k', `gui/${probe.uid()}/${SERVICE.launchdLabel}`] };
    return null;
  }
  if (platform === 'win32') {
    const exe = winswExePath(home);
    if (probe.exists(exe)) return { cmd: exe, args: ['restart'] };
    return null;
  }
  return null;
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
      LABEL: SERVICE.launchdLabel, HOME: xmlEscape(home), NODE: xmlEscape(node),
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

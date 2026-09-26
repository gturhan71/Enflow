// OS-native servis tanımları (ADR-001) — kurulum sihirbazı (M3: şablon render +
// kurulum) ve upgrade-tool (yeniden başlatma) ORTAK kullanır. Bağımlılık YOK.
// Servis adları tek kaynak burada; şablonlar (install/service/*) bunlarla eşleşmeli.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
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

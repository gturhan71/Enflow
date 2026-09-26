import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRestartCommand, launchdDaemonPlist, launchdAgentPlist, winswExePath } from './service.mjs';

const probe = ({ exists = [], systemctlOk = false, uid = 501 } = {}) => ({
  exists: (p) => exists.includes(p),
  status: (cmd, args) => (cmd === 'systemctl' && args[0] === 'is-enabled' && systemctlOk ? 0 : 1),
  uid: () => uid,
});

test('linux: systemd etkinse restart', () => {
  assert.deepEqual(resolveRestartCommand({ platform: 'linux', probe: probe({ systemctlOk: true }) }), { cmd: 'systemctl', args: ['restart', 'enflow'] });
  assert.equal(resolveRestartCommand({ platform: 'linux', probe: probe() }), null);
});

test('darwin: sistem daemon önce, sonra kullanıcı agent', () => {
  assert.deepEqual(resolveRestartCommand({ platform: 'darwin', probe: probe({ exists: [launchdDaemonPlist()] }) }).args, ['kickstart', '-k', 'system/com.enflow.backend']);
  assert.deepEqual(resolveRestartCommand({ platform: 'darwin', probe: probe({ exists: [launchdAgentPlist()], uid: 42 }) }).args, ['kickstart', '-k', 'gui/42/com.enflow.backend']);
  assert.equal(resolveRestartCommand({ platform: 'darwin', probe: probe() }), null);
});

test('win32: WinSW exe varsa restart', () => {
  const exe = winswExePath('C:\\enflow');
  assert.deepEqual(resolveRestartCommand({ platform: 'win32', home: 'C:\\enflow', probe: probe({ exists: [exe] }) }), { cmd: exe, args: ['restart'] });
  assert.equal(resolveRestartCommand({ platform: 'win32', home: 'C:\\enflow', probe: probe() }), null);
});

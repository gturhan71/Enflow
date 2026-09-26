import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

// ── Şablon üretimi + kurulum planı ───────────────────────────────────────────────
import { renderServiceFile, planInstall } from './service.mjs';

test('render systemd: yer tutucular dolu, % kaçırılır', () => {
  const out = renderServiceFile('systemd', { home: '/opt/en%flow', node: '/usr/bin/node', user: 'enflow' });
  assert.match(out, /^User=enflow$/m);
  assert.match(out, /^WorkingDirectory=\/opt\/en%%flow\/backend$/m);
  assert.match(out, /^ExecStart="\/usr\/bin\/node" dist\/index\.js$/m);
  assert.doesNotMatch(out, /\{\{/);
});

test('render systemd: user zorunlu, geçersiz kullanıcı adı reddedilir', () => {
  assert.throws(() => renderServiceFile('systemd', { home: '/h', node: '/n' }), /user zorunlu/);
  assert.throws(() => renderServiceFile('systemd', { home: '/h', node: '/n', user: 'a b; rm -rf /' }), /Geçersiz kullanıcı/);
});

test('render launchd: XML kaçışı + UserName yalnız verilirse', () => {
  const withUser = renderServiceFile('launchd', { home: '/Users/a&b/Enflow', node: '/opt/homebrew/bin/node', user: 'ali' });
  assert.match(withUser, /<string>\/Users\/a&amp;b\/Enflow\/backend<\/string>/);
  assert.match(withUser, /<key>UserName<\/key><string>ali<\/string>/);
  assert.match(withUser, /<key>Label<\/key><string>com\.enflow\.backend<\/string>/);
  assert.doesNotMatch(renderServiceFile('launchd', { home: '/h', node: '/n' }), /UserName/);
});

test('render winsw: id, XML kaçışı, backslash yolu', () => {
  const out = renderServiceFile('winsw', { home: 'C:\\Enflow & Co', node: 'C:\\Program Files\\nodejs\\node.exe' });
  assert.match(out, /<id>enflow<\/id>/);
  assert.match(out, /<workingdirectory>C:\\Enflow &amp; Co\\backend<\/workingdirectory>/);
  assert.match(out, /<executable>C:\\Program Files\\nodejs\\node\.exe<\/executable>/);
});

test('render: doldurulmamış yer tutucu hata verir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tmpl-'));
  writeFileSync(join(dir, 'enflow.service.tmpl'), 'User={{USER}} X={{BILINMEYEN}}');
  assert.throws(() => renderServiceFile('systemd', { home: '/h', node: '/n', user: 'u' }, { templateDir: dir }), /BILINMEYEN/);
});

test('plan linux: dosya + sudo\'lu komutlar; root ise sudo yok', () => {
  const p = planInstall({ platform: 'linux', home: '/opt/enflow', node: '/usr/bin/node', user: 'enflow' });
  assert.equal(p.files[0].path, '/opt/enflow/service/enflow.service');
  assert.deepEqual(p.commands.map((c) => [c.cmd, ...c.args].join(' ')), [
    'cp /opt/enflow/service/enflow.service /etc/systemd/system/enflow.service',
    'systemctl daemon-reload',
    'systemctl enable --now enflow',
  ]);
  assert.ok(p.commands.every((c) => c.sudo === true));
  const root = planInstall({ platform: 'linux', home: '/opt/enflow', node: '/usr/bin/node', user: 'enflow', isRoot: true });
  assert.ok(root.commands.every((c) => c.sudo === false));
});

test('plan darwin daemon: eski servisi boşalt (hata yut) → kopyala → root sahipliği → bootstrap system', () => {
  const p = planInstall({ platform: 'darwin', home: '/Users/a/Enflow', node: '/opt/homebrew/bin/node', user: 'a' });
  const lines = p.commands.map((c) => [c.cmd, ...c.args].join(' '));
  assert.equal(lines[0], 'launchctl bootout system/com.enflow.backend');
  assert.equal(p.commands[0].ignoreFailure, true);
  assert.equal(lines.at(-1), 'launchctl bootstrap system /Library/LaunchDaemons/com.enflow.backend.plist');
  assert.ok(lines.includes('chown root:wheel /Library/LaunchDaemons/com.enflow.backend.plist'));
  assert.match(p.files[0].content, /UserName/);
  assert.ok(p.dirs.includes('/Users/a/Enflow/logs'));
});

test('plan darwin agent: sudo yok, gui/<uid> domain, UserName yok', () => {
  const p = planInstall({ platform: 'darwin', mode: 'agent', uid: 501, home: '/Users/a/Enflow', node: '/opt/homebrew/bin/node', user: 'a' });
  assert.ok(p.commands.every((c) => c.sudo === false));
  assert.match(p.commands.at(-1).args.join(' '), /^bootstrap gui\/501 .*\/Library\/LaunchAgents\/com\.enflow\.backend\.plist$/);
  assert.doesNotMatch(p.files[0].content, /UserName/);
});

test('plan win32: WinSW exe/xml eşleşen ad, yönetici gerekli', () => {
  const p = planInstall({ platform: 'win32', home: 'C:\\Enflow', node: 'C:\\nodejs\\node.exe' });
  assert.equal(p.needsWinsw.exe, winswExePath('C:\\Enflow'));
  assert.equal(p.files[0].path, 'C:\\Enflow\\service\\enflow-service.xml');
  assert.equal(p.requiresAdmin, true);
  assert.deepEqual(p.commands.map((c) => c.args[0]), ['install', 'start']);
});

test('plan: desteklenmeyen platform', () => {
  assert.throws(() => planInstall({ platform: 'freebsd', home: '/h', node: '/n', user: 'u' }), /Desteklenmeyen/);
});

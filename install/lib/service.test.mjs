import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveRestartCommand, resolveRestartCommands, launchdDaemonPlist, launchdAgentPlist, winswExePath } from './service.mjs';

const probe = ({ exists = [], systemctlOk = false, uid = 501, root = false } = {}) => ({
  isRoot: () => root,
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
  assert.match(withUser, /<key>PATH<\/key><string>\/opt\/homebrew\/bin:\/opt\/homebrew\/bin:/);
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

// ── WinSW indirme doğrulaması ───────────────────────────────────────────────────
import { downloadWinsw } from './service.mjs';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const payload = Buffer.from('sahte-winsw-ikilisi');
const okLock = { version: 'vT', url: 'https://x/y.exe', size: payload.length, sha256: createHash('sha256').update(payload).digest('hex') };
const fakeFetch = (buf, ok = true, status = 200) => async () => ({ ok, status, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) });

test('downloadWinsw: hash eşleşirse yazar', async () => {
  const exe = join(mkdtempSync(join(tmpdir(), 'wsw-')), 'service', 'enflow-service.exe');
  const r = await downloadWinsw(exe, { lock: okLock, fetchImpl: fakeFetch(payload) });
  assert.equal(r.sha256, okLock.sha256);
  assert.deepEqual(readFileSync(exe), payload);
  assert.equal(existsSync(exe + '.part'), false);
});

test('downloadWinsw: hash uyuşmazsa reddeder ve dosya YAZMAZ', async () => {
  const exe = join(mkdtempSync(join(tmpdir(), 'wsw-')), 'enflow-service.exe');
  const tampered = Buffer.from('sahte-winsw-ikilisX');
  await assert.rejects(downloadWinsw(exe, { lock: okLock, fetchImpl: fakeFetch(tampered) }), /SHA256 uyuşmuyor/);
  assert.equal(existsSync(exe), false);
});

test('downloadWinsw: boyut farkı, HTTP hatası ve boş hash reddedilir', async () => {
  const exe = join(mkdtempSync(join(tmpdir(), 'wsw-')), 'e.exe');
  await assert.rejects(downloadWinsw(exe, { lock: { ...okLock, size: 1 }, fetchImpl: fakeFetch(payload) }), /boyutu/);
  await assert.rejects(downloadWinsw(exe, { lock: okLock, fetchImpl: fakeFetch(payload, false, 404) }), /HTTP 404/);
  await assert.rejects(downloadWinsw(exe, { lock: { ...okLock, sha256: '' }, fetchImpl: fakeFetch(payload) }), /geçerli sha256 yok/);
  assert.equal(existsSync(exe), false);
});

test('winsw.lock.json: sabit v2.12.0 + 64 hex sha256 + resmi github URL', () => {
  const lock = JSON.parse(readFileSync(new URL('../service/winsw.lock.json', import.meta.url), 'utf-8'));
  assert.match(lock.sha256, /^[0-9a-f]{64}$/);
  assert.match(lock.url, /^https:\/\/github\.com\/winsw\/winsw\/releases\/download\/v2\.12\.0\//);
  assert.equal(lock.size, 18243033);
});

// ── executePlan ─────────────────────────────────────────────────────────────────
import { executePlan, formatCommand } from './service.mjs';

const linuxPlan = () => planInstall({ platform: 'linux', home: '/opt/enflow', node: '/usr/bin/node', user: 'enflow' });

test('executePlan: dizin → dosya → komut sırası; sudo öneki', () => {
  const calls = [];
  const r = executePlan(linuxPlan(), {
    run: (cmd, args) => { calls.push([cmd, ...args].join(' ')); return 0; },
    mkdir: (d) => calls.push(`mkdir ${d}`),
    write: (f) => calls.push(`write ${f}`),
  });
  assert.equal(r.ok, true);
  assert.deepEqual(calls, [
    'mkdir /opt/enflow/logs',
    'write /opt/enflow/service/enflow.service',
    'sudo cp /opt/enflow/service/enflow.service /etc/systemd/system/enflow.service',
    'sudo systemctl daemon-reload',
    'sudo systemctl enable --now enflow',
  ]);
});

test('executePlan: komut hatasında durur, kalanları elle-talimat olarak verir', () => {
  let n = 0;
  const r = executePlan(linuxPlan(), { run: () => (++n === 2 ? 1 : 0), mkdir: () => {}, write: () => {} });
  assert.equal(r.ok, false);
  assert.equal(r.failed, 'sudo systemctl daemon-reload');
  assert.deepEqual(r.manual, ['sudo systemctl daemon-reload', 'sudo systemctl enable --now enflow']);
});

test('executePlan: ignoreFailure komutu hata verse de devam eder', () => {
  const p = planInstall({ platform: 'darwin', home: '/Users/a/Enflow', node: '/n', user: 'a' });
  const seen = [];
  const r = executePlan(p, { run: (cmd, args) => { seen.push(args[1] ?? args[0]); return args.includes('bootout') ? 3 : 0; }, mkdir: () => {}, write: () => {} });
  assert.equal(r.ok, true);
  assert.ok(seen.length >= 4);
});

test('executePlan dry: hiçbir şey çalıştırmaz/yazmaz', () => {
  const r = executePlan(linuxPlan(), { dry: true, run: () => { throw new Error('çalışmamalı'); }, mkdir: () => { throw new Error('x'); }, write: () => { throw new Error('x'); } });
  assert.equal(r.ok, true);
});

test('formatCommand: boşluklu argüman tırnaklanır', () => {
  assert.equal(formatCommand({ cmd: 'C:\\Program Files\\x.exe', args: ['install'], sudo: false }), '"C:\\Program Files\\x.exe" install');
});

test('restart adayları: root değilse doğrudan + sudo -n; root ise yalnız doğrudan', () => {
  const nonRoot = resolveRestartCommands({ platform: 'linux', probe: probe({ systemctlOk: true }) });
  assert.deepEqual(nonRoot, [
    { cmd: 'systemctl', args: ['restart', 'enflow'] },
    { cmd: 'sudo', args: ['-n', 'systemctl', 'restart', 'enflow'] },
  ]);
  assert.equal(resolveRestartCommands({ platform: 'linux', probe: probe({ systemctlOk: true, root: true }) }).length, 1);
  assert.deepEqual(resolveRestartCommands({ platform: 'linux', probe: probe() }), []);
});

test('restart adayları: LaunchDaemon sudo\'lu yedek; LaunchAgent ve WinSW yalnız doğrudan', () => {
  const d = resolveRestartCommands({ platform: 'darwin', probe: probe({ exists: [launchdDaemonPlist()] }) });
  assert.equal(d.length, 2);
  assert.deepEqual(d[1].args.slice(0, 3), ['-n', 'launchctl', 'kickstart']);
  assert.equal(resolveRestartCommands({ platform: 'darwin', probe: probe({ exists: [launchdAgentPlist()] }) }).length, 1);
  assert.equal(resolveRestartCommands({ platform: 'win32', home: 'C:\\e', probe: probe({ exists: [winswExePath('C:\\e')] }) }).length, 1);
});

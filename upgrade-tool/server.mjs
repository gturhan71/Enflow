#!/usr/bin/env node
// Enflow Upgrade Tool — YEREL web sunucusu (bağımlılıksız). UYGULAMADAN AYRI süreç.
// Çalıştır: node upgrade-tool/server.mjs   →  http://127.0.0.1:7071
// Periyodik kontrol yapar, update-status.json yazar; otomatik mod açıksa bakım
// penceresinde yükseltir. Operatör GUI'den elle kontrol/yükseltme de yapabilir.
// ⚠️ Yalnız operatörün makinesinde, 127.0.0.1'e bağlı. Yükseltme yıkıcıdır.
// GÜVENLİK (10x avı 2026-09-26): 127.0.0.1'e bağlı olmak yetmez — aynı makinedeki her kullanıcı ve
// DNS-rebinding yapan bir web sayfası bu porta erişebilir; ayarlar (restartCommand → `sh -c`) yükseltmede
// ÇALIŞTIRILIR. Bu yüzden: (1) Host başlığı yalnız loopback adları+port (rebinding'i keser),
// (2) tüm /api/* rastgele bir token ister (upgrade-tool/.gui-token, 0600 — yalnız sahibi okur;
// arayüze URL parçasıyla `#token=…` verilir, sunucuya/Referer'a gitmez), (3) ayar alanları allowlist'li.
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveHome, checkAndWrite, readStatus, runUpgrade, currentVersion } from './core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const STATE_DIR = process.env.ENFLOW_UPGRADE_STATE_DIR || HERE; // config.json + .gui-token (testler için ayrılabilir)
const CONFIG = join(STATE_DIR, 'config.json');
const TOKEN_FILE = join(STATE_DIR, '.gui-token');
const PORT = process.env.PORT || 7071;
const HOST = process.env.HOST || '127.0.0.1';

const DEFAULTS = {
  channel: 'auto',            // auto | tag | commit
  autoCheckHours: 6,          // periyodik kontrol aralığı
  autoUpgrade: false,         // bakım penceresinde otomatik uygula
  maintenanceFrom: 2,         // bakım penceresi başlangıç saati (0-23, yerel)
  maintenanceTo: 5,           // bitiş saati
  restartCommand: '',         // boş = kurulu OS servisi otomatik (systemd/launchd/WinSW)
  migratorUrl: '',            // Postgres'te ZORUNLU — DDL rolü (yanıtlarda maskelenir)
  skipPgBackup: false,        // pg_dump ön-yedeğini bilerek atla
  allowDirty: false,
};
function loadConfig() {
  try { return { ...DEFAULTS, ...JSON.parse(readFileSync(CONFIG, 'utf-8')) }; } catch { return { ...DEFAULTS }; }
}
// migratorUrl parola içerir → yalnız sahibi okuyabilsin (0600; Windows'ta NTFS ACL'e bırakılır)
function saveConfig(c) { writeFileSync(CONFIG, JSON.stringify(c, null, 2), { mode: 0o600 }); try { chmodSync(CONFIG, 0o600); } catch { /* Windows */ } }
// Parola içeren migratorUrl GUI/API yanıtlarına ASLA düz yazılmaz.
const MASK = '********';
const publicConfig = (c) => ({ ...c, migratorUrl: c.migratorUrl ? MASK : '' });

// Ayar patch'i: yalnız bilinen alanlar, tipi varsayılanla aynı olanlar (çöp/prototip anahtarı geçmez)
export function sanitizePatch(patch) {
  const out = {};
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return out;
  for (const [k, def] of Object.entries(DEFAULTS)) {
    if (Object.prototype.hasOwnProperty.call(patch, k) && typeof patch[k] === typeof def) out[k] = patch[k];
  }
  return out;
}

function loadOrCreateToken() {
  try {
    const t = readFileSync(TOKEN_FILE, 'utf-8').trim();
    if (/^[0-9a-f]{64}$/.test(t)) { try { chmodSync(TOKEN_FILE, 0o600); } catch { /* Windows */ } return t; }
  } catch { /* yok → üret */ }
  const t = randomBytes(32).toString('hex');
  writeFileSync(TOKEN_FILE, t + '\n', { mode: 0o600 });
  try { chmodSync(TOKEN_FILE, 0o600); } catch { /* Windows */ }
  return t;
}
const TOKEN = loadOrCreateToken();
const tokenOk = (req) => {
  const got = Buffer.from(String(req.headers['x-enflow-token'] ?? ''));
  const want = Buffer.from(TOKEN);
  return got.length === want.length && timingSafeEqual(got, want);
};
// DNS rebinding: tarayıcı saldırganın alan adını Host olarak gönderir → yalnız loopback adları kabul
const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`, `[::1]:${PORT}`, `${HOST}:${PORT}`]);
const hostOk = (req) => ALLOWED_HOSTS.has(String(req.headers.host ?? '').toLowerCase());

let config = loadConfig();
const home = resolveHome();
let busy = false;            // yükseltme sürerken üst üste binmeyi önle
const logBuffer = [];        // son yükseltme logu (GUI akışı için)
const pushLog = (m) => { logBuffer.push(`[${new Date().toISOString()}] ${m}`); if (logBuffer.length > 500) logBuffer.shift(); };

const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const MAX_BODY = 64 * 1024;
const body = (req) => new Promise((r, rej) => {
  let d = '';
  req.on('data', (c) => { d += c; if (d.length > MAX_BODY) { rej(Object.assign(new Error('gövde çok büyük'), { status: 413 })); req.destroy(); } });
  req.on('end', () => r(d));
});

function inMaintenanceWindow() {
  const h = new Date().getHours();
  const { maintenanceFrom: a, maintenanceTo: b } = config;
  return a <= b ? h >= a && h < b : h >= a || h < b; // gece sarması destekli
}

async function performUpgrade() {
  if (busy) return { ok: false, error: 'Yükseltme zaten sürüyor.' };
  busy = true; logBuffer.length = 0;
  try {
    const res = await runUpgrade(home, { channel: config.channel, log: pushLog, allowDirty: config.allowDirty, restartCommand: config.restartCommand || null, migratorUrl: config.migratorUrl || null, skipPgBackup: !!config.skipPgBackup });
    return res;
  } finally { busy = false; }
}

// ── Periyodik kontrol + otomatik yükseltme ────────────────────────────────────
async function tick() {
  if (busy) return;
  try {
    const s = await checkAndWrite(home, config.channel);
    if (s.update.available && config.autoUpgrade && inMaintenanceWindow()) {
      pushLog('Otomatik yükseltme tetiklendi (bakım penceresi).');
      await performUpgrade();
    }
  } catch (e) { pushLog('tick hata: ' + e.message); }
}

const server = createServer(async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    if (!hostOk(req)) return json(res, 403, { error: 'Geçersiz Host başlığı.' });
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      // HTML sır içermez (token URL parçasından okunur) → token'sız servis edilir
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'" });
      return res.end(readFileSync(join(HERE, 'public', 'index.html')));
    }
    if (String(req.url).startsWith('/api/') && !tokenOk(req)) {
      return json(res, 401, { error: 'Token gerekli (X-Enflow-Token). Sunucu başlangıç çıktısındaki URL\'yi ya da upgrade-tool/.gui-token dosyasını kullanın.' });
    }
    if (req.method === 'GET' && req.url === '/api/status') {
      return json(res, 200, { home, config: publicConfig(config), current: currentVersion(home), status: readStatus(home), busy, log: logBuffer });
    }
    if (req.method === 'POST' && req.url === '/api/check') {
      const s = await checkAndWrite(home, config.channel);
      return json(res, 200, s);
    }
    if (req.method === 'POST' && req.url === '/api/upgrade') {
      if (busy) return json(res, 409, { error: 'Yükseltme zaten sürüyor.' });
      performUpgrade(); // arka planda; GUI /api/status ile log akışını çeker
      return json(res, 202, { started: true });
    }
    if (req.method === 'GET' && req.url === '/api/settings') {
      return json(res, 200, publicConfig(config));
    }
    if (req.method === 'PUT' && req.url === '/api/settings') {
      const patch = sanitizePatch(JSON.parse((await body(req)) || '{}'));
      if (patch.migratorUrl === MASK) delete patch.migratorUrl; // maskeli değer geri gönderildiyse koru
      config = { ...config, ...patch };
      saveConfig(config);
      return json(res, 200, publicConfig(config));
    }
    res.writeHead(404); res.end('not found');
  } catch (e) {
    json(res, e.status || 500, { error: e.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  Enflow Upgrade Tool → http://${HOST}:${PORT}`);
  console.log(`  Arayüz: http://${HOST}:${PORT}/#token=${TOKEN}`);
  console.log(`  (token: ${TOKEN_FILE} — yalnız sahibi okuyabilir; başkasıyla paylaşmayın)`);
  console.log(`  ENFLOW_HOME: ${home}`);
  console.log(`  ⚠️  Ayrı operatör aracı · yükseltme yıkıcıdır (ön-yedek + rollback var)\n`);
  setTimeout(() => { void tick(); }, 10_000); // boot yükünü dağıt
  setInterval(() => { void tick(); }, Math.max(1, config.autoCheckHours) * 3600 * 1000);
});

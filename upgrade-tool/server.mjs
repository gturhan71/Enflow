#!/usr/bin/env node
// Enflow Upgrade Tool — YEREL web sunucusu (bağımlılıksız). UYGULAMADAN AYRI süreç.
// Çalıştır: node upgrade-tool/server.mjs   →  http://127.0.0.1:7071
// Periyodik kontrol yapar, update-status.json yazar; otomatik mod açıksa bakım
// penceresinde yükseltir. Operatör GUI'den elle kontrol/yükseltme de yapabilir.
// ⚠️ Yalnız operatörün makinesinde, 127.0.0.1'e bağlı. Yükseltme yıkıcıdır.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveHome, checkAndWrite, readStatus, runUpgrade, currentVersion } from './core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONFIG = join(HERE, 'config.json');
const PORT = process.env.PORT || 7071;
const HOST = process.env.HOST || '127.0.0.1';

const DEFAULTS = {
  channel: 'auto',            // auto | tag | commit
  autoCheckHours: 6,          // periyodik kontrol aralığı
  autoUpgrade: false,         // bakım penceresinde otomatik uygula
  maintenanceFrom: 2,         // bakım penceresi başlangıç saati (0-23, yerel)
  maintenanceTo: 5,           // bitiş saati
  restartCommand: '',         // ör. "sudo systemctl restart enflow-backend"
  allowDirty: false,
};
function loadConfig() {
  try { return { ...DEFAULTS, ...JSON.parse(readFileSync(CONFIG, 'utf-8')) }; } catch { return { ...DEFAULTS }; }
}
function saveConfig(c) { writeFileSync(CONFIG, JSON.stringify(c, null, 2)); }

let config = loadConfig();
const home = resolveHome();
let busy = false;            // yükseltme sürerken üst üste binmeyi önle
const logBuffer = [];        // son yükseltme logu (GUI akışı için)
const pushLog = (m) => { logBuffer.push(`[${new Date().toISOString()}] ${m}`); if (logBuffer.length > 500) logBuffer.shift(); };

const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); };
const body = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => r(d)); });

function inMaintenanceWindow() {
  const h = new Date().getHours();
  const { maintenanceFrom: a, maintenanceTo: b } = config;
  return a <= b ? h >= a && h < b : h >= a || h < b; // gece sarması destekli
}

async function performUpgrade() {
  if (busy) return { ok: false, error: 'Yükseltme zaten sürüyor.' };
  busy = true; logBuffer.length = 0;
  try {
    const res = await runUpgrade(home, { channel: config.channel, log: pushLog, allowDirty: config.allowDirty, restartCommand: config.restartCommand || null });
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
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(readFileSync(join(HERE, 'public', 'index.html')));
    }
    if (req.method === 'GET' && req.url === '/api/status') {
      return json(res, 200, { home, config, current: currentVersion(home), status: readStatus(home), busy, log: logBuffer });
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
      return json(res, 200, config);
    }
    if (req.method === 'PUT' && req.url === '/api/settings') {
      const patch = JSON.parse((await body(req)) || '{}');
      config = { ...config, ...patch };
      saveConfig(config);
      return json(res, 200, config);
    }
    res.writeHead(404); res.end('not found');
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`\n  Enflow Upgrade Tool → http://${HOST}:${PORT}`);
  console.log(`  ENFLOW_HOME: ${home}`);
  console.log(`  ⚠️  Ayrı operatör aracı · yükseltme yıkıcıdır (ön-yedek + rollback var)\n`);
  setTimeout(() => { void tick(); }, 10_000); // boot yükünü dağıt
  setInterval(() => { void tick(); }, Math.max(1, config.autoCheckHours) * 3600 * 1000);
});

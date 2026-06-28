#!/usr/bin/env node
// Enflow Lisans Üreteci — YEREL web sunucusu (bağımlılıksız). VENDOR aracı.
// Çalıştır: node license-tool/server.mjs   →  http://localhost:7070
// ⚠️ Yalnız operatörün makinesinde çalışır; private key keys/ altında, ASLA commit edilmez.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { keygen, makePayload, issue, publicFromPrivate } from './core.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const KEYS = join(HERE, 'keys');
const PRIV = join(KEYS, 'private.pem');
const PUB = join(KEYS, 'public.pem');
const PORT = process.env.PORT || 7070;

const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const body = (req) => new Promise((r) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => r(d)); });

const server = createServer(async (req, res) => {
  try {
    // GUI
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(readFileSync(join(HERE, 'public', 'index.html')));
    }
    // Anahtar durumu
    if (req.method === 'GET' && req.url === '/api/pubkey') {
      if (!existsSync(PUB)) return json(res, 200, { hasKey: false });
      return json(res, 200, { hasKey: true, publicPem: readFileSync(PUB, 'utf-8') });
    }
    // Yeni anahtar çifti üret (mevcut varsa korunur — kazara üzerine yazma yok)
    if (req.method === 'POST' && req.url === '/api/keygen') {
      mkdirSync(KEYS, { recursive: true });
      if (existsSync(PRIV)) return json(res, 409, { error: 'Anahtar zaten var (keys/). Korunuyor.' });
      const { privatePem, publicPem } = keygen();
      writeFileSync(PRIV, privatePem, { mode: 0o600 });
      writeFileSync(PUB, publicPem);
      return json(res, 200, { hasKey: true, publicPem });
    }
    // Lisans imzala
    if (req.method === 'POST' && req.url === '/api/issue') {
      if (!existsSync(PRIV)) return json(res, 400, { error: 'Önce anahtar üretin (keys/ yok).' });
      const { tenantId, sku, plugins, users, storageGB, days } = JSON.parse((await body(req)) || '{}');
      if (!tenantId) return json(res, 400, { error: 'tenantId zorunlu.' });
      const limits = {};
      if (users) limits.users = Number(users);
      if (storageGB) limits.storageGB = Number(storageGB);
      const payload = makePayload({ tenantId, sku, plugins, limits, days: days || undefined });
      const priv = readFileSync(PRIV, 'utf-8');
      const token = issue(payload, priv);
      return json(res, 200, { token, payload, publicPem: publicFromPrivate(priv) });
    }
    res.writeHead(404); res.end('not found');
  } catch (e) {
    json(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Enflow Lisans Üreteci → http://localhost:${PORT}`);
  console.log(`  ⚠️  VENDOR aracı · private key: ${PRIV} (ASLA paylaşma/commit etme)\n`);
});

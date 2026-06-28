#!/usr/bin/env node
// Enflow Lisans PoC — uçtan uca kanıt (keygen → issue → verify senaryoları).
// Çalıştır: node license-poc/demo.mjs   (bağımlılık yok)
import { generateKeyPairSync } from 'node:crypto';
import { makePayload, issue, verifyToken } from './lib.mjs';

const C = { g:'\x1b[32m', r:'\x1b[31m', y:'\x1b[33m', c:'\x1b[36m', d:'\x1b[2m', x:'\x1b[0m', b:'\x1b[1m' };
const ok = (m) => console.log(`${C.g}✓${C.x} ${m}`);
const bad = (m) => console.log(`${C.r}✗${C.x} ${m}`);
let pass = 0, fail = 0;
const expect = (cond, label) => { if (cond) { ok(label); pass++; } else { bad(label); fail++; } };

console.log(`${C.b}${C.c}Enflow Lisans PoC — Ed25519, tenant-bağlı, yalnız-doğrula${C.x}\n`);

// ── 1) Keypair (VENDOR offline üretir; private ASLA tenant'a gitmez) ──────────
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const PRIV = privateKey.export({ type: 'pkcs8', format: 'pem' });   // üreteç (gizli)
const PUB  = publicKey.export({ type: 'spki',  format: 'pem' });    // tenant'a gömülür (açık)
console.log(`${C.d}keypair üretildi · public key tenant'a gömülür, private key vendor'da kalır${C.x}\n`);

// ── 2) ÜRETEÇ: tenant-1 için lisans imzala (vendor tarafı) ────────────────────
const lic1 = issue(makePayload({ tenantId: 'tenant-1', sku: 'PRO', plugins: ['AGENT_TENDER','AGENT_PROJECT'], limits: { users: 25 }, days: 365 }), PRIV);
console.log(`${C.c}Üretilen lisans (tenant-1):${C.x}\n  ${lic1.slice(0,72)}…\n`);

// ── 3) TENANT: yalnız public key ile doğrulama senaryoları ───────────────────
const v1 = verifyToken(lic1, PUB, 'tenant-1');
expect(v1.ok && v1.payload.tenantId === 'tenant-1', 'Geçerli lisans tenant-1\'de KABUL (imza+binding+süre)');
expect(v1.payload.plugins.includes('AGENT_TENDER'), '  payload doğru (plugins: AGENT_TENDER, AGENT_PROJECT)');

const v2 = verifyToken(lic1, PUB, 'tenant-2');
expect(!v2.ok && v2.reason === 'TENANT_UYUSMAZ', 'tenant-1 lisansı tenant-2\'de RED (binding) →  ' + v2.reason);

// tamper: payload'ı oyna
const parts = lic1.split('.');
const tampered = `${parts[0]}.${Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(parts[1],'base64url').toString()), limits:{users:9999} })).toString('base64url')}.${parts[2]}`;
const vt = verifyToken(tampered, PUB, 'tenant-1');
expect(!vt.ok && vt.reason === 'IMZA_GECERSIZ', 'Kurcalanmış lisans (limit şişirme) RED (imza) →  ' + vt.reason);

// yanlış anahtar (başka vendor) ile üretilmiş → red
const other = generateKeyPairSync('ed25519');
const forged = issue(makePayload({ tenantId:'tenant-1', sku:'PRO', days: 365 }), other.privateKey.export({ type:'pkcs8', format:'pem' }));
const vf = verifyToken(forged, PUB, 'tenant-1');
expect(!vf.ok && vf.reason === 'IMZA_GECERSIZ', 'Sahte anahtarla üretilmiş lisans RED (forge) →  ' + vf.reason);

// süresi dolmuş
const expired = issue({ ...makePayload({ tenantId:'tenant-1', sku:'TRIAL' }), expiresAt: Date.now() - 1000 }, PRIV);
const ve = verifyToken(expired, PUB, 'tenant-1');
expect(!ve.ok && ve.reason === 'SURESI_DOLMUS', 'Süresi dolmuş lisans RED →  ' + ve.reason);

console.log(`\n${C.b}──────── ÖZET: ${pass} geçti · ${fail} kaldı ────────${C.x}`);
process.exit(fail ? 1 : 0);

#!/usr/bin/env node
// Enflow — temsili okuma karışımı yük testi (S-09, bkz. docs/OLCEKLENDIRME_DUZELTME_PLANI.md).
// SYSTEM_REQUIREMENTS.md'deki senaryo eşikleri (≤20 kullanıcı vb.) ölçülmemiş
// mühendislik varsayımıydı — bu betik en azından kaba bir referans verir.
// Yalnız dev-dependency; üretim koduna girmez, elle çalıştırılır:
//   cd backend && pnpm test:load
// Ortam değişkenleri: BASE_URL, EMAIL, PASSWORD, TENANT_ID, DURATION_SEC, CONNECTIONS

import autocannon from 'autocannon';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3002/api';
const EMAIL = process.env.EMAIL || 'gokhan@t-ecosystem.com';
const PASSWORD = process.env.PASSWORD || '123456';
const TENANT_ID = process.env.TENANT_ID || 'tenant-1';
const DURATION_SEC = Number(process.env.DURATION_SEC) || 20;
const CONNECTIONS = Number(process.env.CONNECTIONS) || 10;

async function login() {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Login başarısız: ${res.status} ${await res.text()}`);
  const { token } = await res.json();
  return token;
}

async function main() {
  console.log(`[loadtest] ${BASE_URL} — ${CONNECTIONS} eşzamanlı bağlantı, ${DURATION_SEC}sn`);
  const token = await login();
  const headers = { 'x-tenant-id': TENANT_ID, Authorization: `Bearer ${token}` };

  // Dashboard'da gerçekten sorgulanan uçlardan temsili bir karışım — bkz.
  // Enflow Ölçek Bulguları S-06'daki dashboardService.ts referansları.
  const requests = [
    { method: 'GET', path: '/opportunities' },
    { method: 'GET', path: '/tasks' },
    { method: 'GET', path: '/logs/notifications' },
    { method: 'GET', path: '/reports/dashboard' },
    { method: 'GET', path: '/purchase-requests' },
  ];

  const result = await autocannon({
    url: BASE_URL,
    connections: CONNECTIONS,
    duration: DURATION_SEC,
    headers,
    requests,
  });

  console.log(autocannon.printResult(result));
  if (result.errors > 0 || result.timeouts > 0) {
    console.error(`[loadtest] ${result.errors} hata, ${result.timeouts} timeout`);
    process.exitCode = 1;
  }
}

main().catch(e => { console.error(e); process.exit(1); });

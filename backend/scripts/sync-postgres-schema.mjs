#!/usr/bin/env node
// Kanonik prisma/schema.prisma (sqlite) → prisma/postgres/schema.prisma (ADR-002).
// Tek fark datasource provider'ı. Kanonik dosya ASLA yerinde değiştirilmez
// (eski wizard/migrateToPostgres regex flip'i çalışma ağacını kirletiyordu).
//   node scripts/sync-postgres-schema.mjs          → üret/güncelle
//   node scripts/sync-postgres-schema.mjs --check  → güncel değilse exit 1 (CI/verify)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(BACKEND, 'prisma', 'schema.prisma');
const OUT = join(BACKEND, 'prisma', 'postgres', 'schema.prisma');

const HEADER =
  '// ─────────────────────────────────────────────────────────────────────────────\n' +
  '// OTOMATİK ÜRETİLDİ — DÜZENLEMEYİN. Kaynak: prisma/schema.prisma\n' +
  '// Yeniden üret: node scripts/sync-postgres-schema.mjs (veya pnpm db:migrate)\n' +
  '// ─────────────────────────────────────────────────────────────────────────────\n\n';

export function toPostgres(schema) {
  const re = /(datasource\s+db\s*\{[^}]*?provider\s*=\s*")sqlite(")/s;
  if (!re.test(schema)) throw new Error('Kanonik şemada `provider = "sqlite"` datasource bulunamadı.');
  return HEADER + schema.replace(re, '$1postgresql$2');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const next = toPostgres(readFileSync(SRC, 'utf-8'));
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf-8') : null;
  if (process.argv.includes('--check')) {
    if (current !== next) {
      process.stderr.write('prisma/postgres/schema.prisma güncel değil → `cd backend && node scripts/sync-postgres-schema.mjs`\n');
      process.exit(1);
    }
    process.stdout.write('postgres şeması güncel.\n');
  } else if (current !== next) {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, next);
    process.stdout.write('prisma/postgres/schema.prisma üretildi.\n');
  } else {
    process.stdout.write('postgres şeması zaten güncel.\n');
  }
}

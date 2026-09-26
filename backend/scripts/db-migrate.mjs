#!/usr/bin/env node
// Şema değişikliği → İKİ migration (ADR-002): SQLite (prisma/migrations) + Postgres
// (prisma/migrations-postgres). Yerel Postgres GEREKMEZ.
//   pnpm db:migrate <ad> [--create-only]   → sqlite `migrate dev` + PG migration
//   pnpm db:migrate --pg-only <ad>         → yalnız PG migration (sqlite'ı elle ürettiyseniz)
// PG migration'ı, son PG migration'ının şema anlık görüntüsü
// (prisma/postgres/.migrated-schema.prisma) → güncel PG şeması farkından üretilir;
// commit edilmemiş ardışık migration'lar da doğru çalışır. Doğruluk güvencesi:
// CI postgres job'u (migrate deploy + drift kontrolü).
// Veri koruyan dönüşümler (rename vb.) diff'te DROP+ADD olur → SQL'i PR'da gözden geçirin.
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BACKEND = join(dirname(fileURLToPath(import.meta.url)), '..');
const PG_SCHEMA = join(BACKEND, 'prisma', 'postgres', 'schema.prisma');
const SNAPSHOT = join(BACKEND, 'prisma', 'postgres', '.migrated-schema.prisma');
const SQLITE_MIGRATIONS = join(BACKEND, 'prisma', 'migrations');
const PG_MIGRATIONS = join(BACKEND, 'prisma', 'migrations-postgres');
const isWin = process.platform === 'win32';

const args = process.argv.slice(2);
const pgOnly = args.includes('--pg-only');
const passthrough = args.filter((a) => a.startsWith('--') && a !== '--pg-only');
const name = args.find((a) => !a.startsWith('--'));
if (!name || !/^[a-z0-9_]+$/.test(name)) {
  process.stderr.write('Kullanım: pnpm db:migrate <ad_snake_case> [--create-only] | --pg-only <ad>\n');
  process.exit(2);
}

function run(cmd, cmdArgs, env = {}) {
  const r = spawnSync(cmd, cmdArgs, { cwd: BACKEND, stdio: 'inherit', shell: isWin, env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
const dirs = (p) => (existsSync(p) ? readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : []);

// 1) SQLite migration (kanonik şema) — DATABASE_URL Postgres ise durdur
let folder;
if (!pgOnly) {
  if (/^postgres/i.test(process.env.DATABASE_URL || '')) {
    process.stderr.write('DATABASE_URL Postgres görünüyor — bu komut geliştirme SQLite DB\'sine karşı çalışır.\n');
    process.exit(1);
  }
  const before = new Set(dirs(SQLITE_MIGRATIONS));
  run('npx', ['prisma', 'migrate', 'dev', '--name', name, ...passthrough]);
  folder = dirs(SQLITE_MIGRATIONS).find((d) => !before.has(d));
  if (!folder) process.stdout.write('SQLite: yeni migration oluşmadı (şema değişikliği yok?).\n');
}
// PG klasör adı SQLite'ınkiyle aynı (eşleşme kolay izlensin); pg-only'de yeni zaman damgası
if (!folder) {
  const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  folder = `${ts}_${name}`;
}

// 2) PG şemasını kanonikten üret
run('node', ['scripts/sync-postgres-schema.mjs']);

// 3) Anlık görüntü → güncel PG şeması farkı
if (!existsSync(SNAPSHOT)) {
  process.stderr.write('prisma/postgres/.migrated-schema.prisma yok — baseline sonrası oluşturulmuş olmalıydı.\n');
  process.exit(1);
}
const diff = spawnSync('npx', ['prisma', 'migrate', 'diff', '--from-schema', SNAPSHOT, '--to-schema', PG_SCHEMA, '--script'], {
  cwd: BACKEND, encoding: 'utf-8', shell: isWin,
  // prisma.config.ts PG yolunu seçsin; diff şema→şema, bağlantı kurulmaz
  env: { ...process.env, DATABASE_URL: 'postgresql://diff@localhost:5432/diff' },
});
if (diff.status !== 0) { process.stderr.write(diff.stderr || diff.stdout); process.exit(1); }
const sql = diff.stdout.trim();
if (!sql || /^-- This is an empty migration\.?$/m.test(sql) && sql.split('\n').length <= 1) {
  process.stdout.write('Postgres: şema farkı yok — PG migration üretilmedi.\n');
  process.exit(0);
}
const out = join(PG_MIGRATIONS, folder);
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'migration.sql'), sql + '\n');
copyFileSync(PG_SCHEMA, SNAPSHOT);
process.stdout.write(`Postgres migration: prisma/migrations-postgres/${folder}/migration.sql\n`);

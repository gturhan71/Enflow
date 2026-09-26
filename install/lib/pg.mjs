// PostgreSQL rol/DB provizyonu + runtime yetkilendirmesi — kurulum sihirbazı ve CI
// (postgres job) ORTAK kullanır (ADR-002). Bağımlılık YOK; `psql` istemcisini çağırır.
//
// İKİ-ROL AYRIMI (en az yetki, Adım 0 madde 5): `migratorUser` DB'nin OWNER'ı
// (DDL — yalnız kurulum/upgrade sırasında `migrate deploy` için; backend/.env'e
// YAZILMAZ); `appUser` çalışma zamanı rolü — LOGIN var ama DDL/CREATEROLE/SUPERUSER
// YOK, yalnız grantRuntimePrivileges() ile DML yetkisi alır. Hepsi idempotent.
//
// CLI (CI için):  node install/lib/pg.mjs provision | grant
//   Superuser: PGHOST / PGPORT / PGUSER / PGPASSWORD
//   Hedef:     ENFLOW_DB, ENFLOW_APP_USER, ENFLOW_APP_PASS, ENFLOW_MIGRATOR_USER, ENFLOW_MIGRATOR_PASS
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const isWin = process.platform === 'win32';
const escLit = (v) => String(v).replace(/'/g, "''");
const escIdent = (v) => String(v).replace(/"/g, '""');

// psql ile bir SQL çalıştır (PGPASSWORD ile); spawnSync sonucunu döner.
export function psql(admin, sqlOrDb, { db = 'postgres', command = null } = {}) {
  const a = ['-h', admin.host, '-p', String(admin.port), '-U', admin.user, '-d', db, '-v', 'ON_ERROR_STOP=1'];
  a.push('-c', command ?? sqlOrDb);
  return spawnSync('psql', a, { encoding: 'utf-8', env: { ...process.env, PGPASSWORD: admin.pass || '' }, shell: isWin });
}

export const pgReachable = (admin) => psql(admin, 'SELECT 1;').status === 0;

export function provisionPostgresDb(admin, { db, appUser, appPass, migratorUser, migratorPass }) {
  const mig = escIdent(migratorUser), app = escIdent(appUser), dbI = escIdent(db);
  // migrator rolü (owner — DDL)
  psql(admin, null, { command: `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${escLit(migratorUser)}') THEN CREATE ROLE "${mig}" WITH LOGIN PASSWORD '${escLit(migratorPass)}'; END IF; END $$;` });
  psql(admin, null, { command: `ALTER ROLE "${mig}" WITH LOGIN PASSWORD '${escLit(migratorPass)}';` });
  // runtime rolü (DML-only — NOSUPERUSER/NOCREATEDB/NOCREATEROLE açıkça verilir)
  psql(admin, null, { command: `DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${escLit(appUser)}') THEN CREATE ROLE "${app}" WITH LOGIN PASSWORD '${escLit(appPass)}' NOSUPERUSER NOCREATEDB NOCREATEROLE; END IF; END $$;` });
  psql(admin, null, { command: `ALTER ROLE "${app}" WITH LOGIN PASSWORD '${escLit(appPass)}' NOSUPERUSER NOCREATEDB NOCREATEROLE;` });
  // veritabanı — migrator sahipliğinde (CREATE DATABASE transaction-dışı; var mı diye bak)
  const exists = (psql(admin, null, { command: `SELECT 1 FROM pg_database WHERE datname='${escLit(db)}';` }).stdout || '').includes('1');
  if (!exists) psql(admin, null, { command: `CREATE DATABASE "${dbI}" OWNER "${mig}";` });
  else psql(admin, null, { command: `ALTER DATABASE "${dbI}" OWNER TO "${mig}";` }); // eski tek-rol kurulumundan yükseltme
  return psql(admin, null, { command: `GRANT CONNECT ON DATABASE "${dbI}" TO "${app}";` }).status === 0;
}

// Şema kurulumu (migrate deploy) SONRASI — runtime rolüne yalnız DML yetkisi +
// ALTER DEFAULT PRIVILEGES ile migrator'ın ileride oluşturacağı tablolar için de
// otomatik yetki (upgrade'de elle tekrar grant gerekmez).
export function grantRuntimePrivileges(conn, { db, appUser, migratorUser }) {
  const app = escIdent(appUser), mig = escIdent(migratorUser);
  const commands = [
    `GRANT USAGE ON SCHEMA public TO "${app}";`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${app}";`,
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${app}";`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE "${mig}" IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${app}";`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE "${mig}" IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "${app}";`,
  ];
  for (const command of commands) {
    const r = psql({ host: conn.host, port: conn.port, user: conn.user, pass: conn.pass }, null, { db, command });
    if (r.status !== 0) { process.stderr.write(r.stderr || ''); return false; }
  }
  return true;
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const e = process.env;
  const admin = { host: e.PGHOST || 'localhost', port: e.PGPORT || '5432', user: e.PGUSER || 'postgres', pass: e.PGPASSWORD || '' };
  const target = { db: e.ENFLOW_DB, appUser: e.ENFLOW_APP_USER, appPass: e.ENFLOW_APP_PASS, migratorUser: e.ENFLOW_MIGRATOR_USER, migratorPass: e.ENFLOW_MIGRATOR_PASS };
  const cmd = process.argv[2];
  let okResult;
  if (cmd === 'provision') okResult = provisionPostgresDb(admin, target);
  else if (cmd === 'grant') okResult = grantRuntimePrivileges(admin, target);
  else { process.stderr.write('Kullanım: node install/lib/pg.mjs provision|grant\n'); process.exit(2); }
  process.stdout.write(`pg ${cmd}: ${okResult ? 'ok' : 'BAŞARISIZ'}\n`);
  process.exit(okResult ? 0 : 1);
}

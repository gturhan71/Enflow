// Enflow — Birim & Rol Uygunluk Denetimi (read-only)
// ─────────────────────────────────────────────────────────────────────────────
// İki mod, HİÇBİR ŞEY YAZMAZ:
//   pnpm audit:roles               → denetim raporu (C1–C7, ERROR/WARN/INFO)
//   pnpm audit:roles --role=<ROLE> → "var olanı göster": o rolün 8 kaynaktaki
//                                     mevcut durumu + matris farkı
//
// Kaynaklar deterministik okunur: ROLE_LABELS/NAV (src/constants.ts),
// APPROVAL_CHAIN_TEMPLATES + pluginCatalog + workflow (backend services),
// requireRole (backend/src/routes/*.ts), DB User.role (prisma).

import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../prismaClient';
import { ROLE_MATRIX, MATRIX_ROLES } from '../../../governance/role-matrix';

const ROOT = path.resolve(__dirname, '../../..'); // repo kökü
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ── Kaynak çıkarıcılar (regex, deterministik) ───────────────────────────────
function extractRoleLabels(): string[] {
  const src = read('src/constants.ts');
  const block = src.match(/ROLE_LABELS[^{]*\{([\s\S]*?)\}/);
  if (!block) return [];
  return [...block[1].matchAll(/^\s*([A-Z_]+)\s*:/gm)].map((m) => m[1]);
}

function extractNavPermissions(): string[] {
  const src = read('src/constants.ts');
  return [...new Set([...src.matchAll(/requiredPermission:\s*'([A-Z_]+)'/g)].map((m) => m[1]))];
}

// route domain (dosya adı) → requireRole rol listeleri (birden çok olabilir)
function extractRouteGates(): { domain: string; roles: string[] }[] {
  const dir = path.join(ROOT, 'backend/src/routes');
  const out: { domain: string; roles: string[] }[] = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const domain = f.replace(/\.ts$/, '');
    for (const m of src.matchAll(/requireRole\(\[([^\]]*)\]\)/g)) {
      const roles = [...m[1].matchAll(/'([A-Z_]+)'/g)].map((r) => r[1]);
      if (roles.length) out.push({ domain, roles });
    }
  }
  return out;
}

// entityType → onay zinciri rol dizisi
function extractApprovalTemplates(): Record<string, string[]> {
  const src = read('backend/src/services/approvalChainService.ts');
  const block = src.match(/APPROVAL_CHAIN_TEMPLATES[^{]*\{([\s\S]*?)\n\}/);
  const res: Record<string, string[]> = {};
  if (!block) return res;
  for (const m of block[1].matchAll(/([A-Z_]+)\s*:\s*\[([^\]]*)\]/g)) {
    res[m[1]] = [...m[2].matchAll(/'([A-Z_]+)'/g)].map((r) => r[1]);
  }
  return res;
}

// agent eklenti → { role, unitKey, allowedModes }
function extractPluginAgents(): { key: string; role: string; unitKey: string; allowedModes: string[] }[] {
  const src = read('backend/src/services/pluginCatalog.ts');
  const out: { key: string; role: string; unitKey: string; allowedModes: string[] }[] = [];
  const parts = src.split(/key:\s*'/).slice(1);
  for (const p of parts) {
    const key = p.match(/^([A-Z_]+)'/)?.[1] ?? '';
    if (!key.startsWith('AGENT_')) continue;
    const role = p.match(/role:\s*'([A-Z_]+)'/)?.[1] ?? '';
    const unitKey = p.match(/unitKey:\s*'([A-Z_]+)'/)?.[1] ?? '';
    const modes = [...(p.match(/allowedModes:\s*\[([^\]]*)\]/)?.[1] ?? '').matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
    out.push({ key, role, unitKey, allowedModes: modes });
  }
  return out;
}

// RBAC süiti rolleri lowercase snake_case (general_manager); uppercase'leyip
// ROLE_LABELS ile kesişeni döndür (deterministik, hardcode yok).
function extractRbacTestRoles(labels: Set<string>): string[] {
  try {
    const dir = path.join(ROOT, 'tests/rbac');
    const roles = new Set<string>();
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8');
      for (const m of src.matchAll(/\b([a-z]+_[a-z_]+)\b/g)) {
        const up = m[1].toUpperCase();
        if (labels.has(up)) roles.add(up);
      }
    }
    return [...roles];
  } catch { return []; }
}

// ── Raporlama ───────────────────────────────────────────────────────────────
type Sev = 'ERROR' | 'WARN' | 'INFO';
const findings: { sev: Sev; cat: string; msg: string }[] = [];
const add = (sev: Sev, cat: string, msg: string) => findings.push({ sev, cat, msg });

async function main() {
  const roleArg = process.argv.find((a) => a.startsWith('--role='))?.split('=')[1];
  const labels = new Set(extractRoleLabels());
  const navPerms = extractNavPermissions();
  const gates = extractRouteGates();
  const approvals = extractApprovalTemplates();
  const agents = extractPluginAgents();
  const rbacRoles = extractRbacTestRoles(labels);
  const dbRoles = new Set((await prisma.user.findMany({ distinct: ['role'], select: { role: true } })).map((u) => u.role));

  if (roleArg) {
    showRole(roleArg, { labels, navPerms, gates, approvals, agents, dbRoles });
    await prisma.$disconnect();
    return;
  }

  // ── C1 Rol bütünlüğü ──
  for (const g of gates) {
    for (const r of g.roles) {
      if (!labels.has(r)) add('ERROR', 'C1', `requireRole '${r}' (${g.domain}.ts) ROLE_LABELS'ta YOK → ölü kapı`);
      else if (!MATRIX_ROLES.has(r)) add('WARN', 'C1', `requireRole '${r}' (${g.domain}.ts) matriste yok`);
    }
  }
  for (const r of dbRoles) {
    if (!MATRIX_ROLES.has(r)) add('ERROR', 'C1', `DB'de kullanılan rol '${r}' matriste yok`);
    if (!labels.has(r)) add('ERROR', 'C1', `DB'de kullanılan rol '${r}' ROLE_LABELS'ta yok`);
  }
  for (const spec of ROLE_MATRIX) {
    if (spec.staffing === 'HUMAN' && !dbRoles.has(spec.role)) add('WARN', 'C1', `'${spec.role}' staffing=HUMAN ama DB'de kullanıcısı yok`);
    if (!labels.has(spec.role)) add('ERROR', 'C1', `matris rolü '${spec.role}' ROLE_LABELS'ta yok`);
  }

  // ── C2 Modül erişimi ('*' = superuser owner) ──
  for (const perm of navPerms) {
    if (perm === 'GENERAL_MANAGER') { add('INFO', 'C2', `NAV requiredPermission '${perm}' bir rol adı (izin değil) — gözden geçir`); continue; }
    const superusers = ROLE_MATRIX.filter((s) => s.modules.includes('*'));
    const functionalOwners = ROLE_MATRIX.filter((s) => s.modules.includes(perm));
    if (functionalOwners.length === 0)
      add('INFO', 'C2', `NAV izni '${perm}' için işlevsel birim sahibi yok${superusers.length ? ' (yalnız superuser erişiyor)' : ''} (Faz 1 doldurma)`);
  }

  // ── C3 Endpoint kapıları (iskelette boş → INFO) ──
  for (const g of gates) {
    const owners = ROLE_MATRIX.filter((s) => s.endpointDomains.includes(g.domain));
    if (owners.length === 0) add('INFO', 'C3', `'${g.domain}' kapısı [${g.roles.join(', ')}] matris endpointDomains'da yok (Faz 1)`);
  }

  // ── C4 Yönetici karar mekanizmaları ──
  for (const [entityType, roles] of Object.entries(approvals)) {
    for (const r of roles) {
      if (!labels.has(r)) add('ERROR', 'C4', `onay zinciri ${entityType} rolü '${r}' ROLE_LABELS'ta yok`);
      const spec = ROLE_MATRIX.find((s) => s.role === r);
      if (spec && !spec.approvalIn.includes(entityType)) add('INFO', 'C4', `'${r}' ${entityType} onayında ama matris approvalIn'de yok (Faz 1)`);
    }
  }
  for (const spec of ROLE_MATRIX.filter((s) => s.kind === 'MANAGER' && !s.reviewed)) {
    if (spec.decisionRights.length === 0) add('INFO', 'C4', `'${spec.role}' (MANAGER) decisionRights boş (Faz 1 doldurma)`);
  }

  // ── C5 Personel görevleri ──
  for (const spec of ROLE_MATRIX.filter((s) => s.kind === 'STAFF' && !s.reviewed)) {
    if (spec.tasks.length === 0) add('INFO', 'C5', `'${spec.role}' (STAFF) tasks boş (Faz 1 doldurma)`);
  }

  // ── C6 Agent ikamesi ──
  for (const a of agents) {
    if (!labels.has(a.role)) add('ERROR', 'C6', `agent ${a.key} role '${a.role}' ROLE_LABELS'ta YOK`);
    else if (!MATRIX_ROLES.has(a.role)) add('WARN', 'C6', `agent ${a.key} role '${a.role}' matriste yok`);
    const isMoneyOrLegal = a.key === 'AGENT_FINANCE' || a.key === 'AGENT_LEGAL';
    if (isMoneyOrLegal && JSON.stringify(a.allowedModes) !== JSON.stringify(['ADVISORY']))
      add('ERROR', 'C6', `${a.key} para/hukuk ama allowedModes=[${a.allowedModes.join(',')}] (ADVISORY-only olmalı)`);
  }

  // ── C7 Test kapsamı ──
  const tested = new Set(rbacRoles);
  for (const spec of ROLE_MATRIX.filter((s) => s.staffing === 'HUMAN')) {
    if (!tested.has(spec.role)) add('INFO', 'C7', `HUMAN rolü '${spec.role}' RBAC süitinde temsil edilmiyor`);
  }

  printReport({ labels, navPerms, gates, approvals, agents, dbRoles });
  await prisma.$disconnect();
}

function showRole(role: string, ctx: any) {
  const spec = ROLE_MATRIX.find((s) => s.role === role);
  console.log(`\n════════ VAR OLANI GÖSTER: ${role} ════════`);
  console.log(`ROLE_LABELS'ta: ${ctx.labels.has(role) ? 'EVET' : 'HAYIR (!)'}`);
  console.log(`DB'de kullanıcı: ${ctx.dbRoles.has(role) ? 'VAR' : 'YOK'}`);
  console.log(`\n── Backend endpoint kapıları (requireRole içeren) ──`);
  const g = ctx.gates.filter((x: any) => x.roles.includes(role));
  console.log(g.length ? g.map((x: any) => `  • ${x.domain}.ts [${x.roles.join(', ')}]`).join('\n') : '  (hiçbir requireRole bu rolü içermiyor)');
  console.log(`\n── Onay zincirleri (= yönetici karar mekanizması) ──`);
  const inAppr = Object.entries(ctx.approvals).filter(([, roles]: any) => roles.includes(role));
  console.log(inAppr.length ? inAppr.map(([et, roles]: any) => `  • ${et}: [${roles.join(' → ')}]`).join('\n') : '  (hiçbir onay zincirinde yok)');
  console.log(`\n── Agent ikamesi ──`);
  const ag = ctx.agents.filter((a: any) => a.role === role);
  console.log(ag.length ? ag.map((a: any) => `  • ${a.key} (unit ${a.unitKey}, modes ${a.allowedModes.join('/')})`).join('\n') : '  (bu rolü dolduran agent yok)');
  console.log(`\n── MATRİS (tanımlı) ──`);
  if (!spec) { console.log('  ⚠️ matriste YOK'); return; }
  console.log(`  unit=${spec.unit} kind=${spec.kind} staffing=${spec.staffing}`);
  console.log(`  modules: ${spec.modules.join(', ') || '(boş)'}`);
  console.log(`  endpointDomains: ${spec.endpointDomains.join(', ') || '(boş)'}`);
  console.log(`  decisionRights: ${spec.decisionRights.length ? '' : '(boş)'}`);
  spec.decisionRights.forEach((d) => console.log(`     - ${d.decision} [${d.via}]${d.threshold ? ` (${d.threshold})` : ''}`));
  console.log(`  tasks: ${spec.tasks.length ? '' : '(boş)'}`);
  spec.tasks.forEach((t) => console.log(`     - ${t.task} (${t.raci}) [${t.via}]`));
  console.log(`  approvalIn: ${spec.approvalIn.join(', ') || '(boş)'}`);
  console.log('\n→ Sıradaki: eksikse matrise ekle, uyumsuzsa kaynağı düzelt.\n');
}

function printReport(_ctx: any) {
  const order: Sev[] = ['ERROR', 'WARN', 'INFO'];
  console.log('\n════════════ ENFLOW ROL/BİRİM UYGUNLUK DENETİMİ ════════════\n');
  for (const sev of order) {
    const fs2 = findings.filter((f) => f.sev === sev);
    if (!fs2.length) continue;
    const icon = sev === 'ERROR' ? '⛔' : sev === 'WARN' ? '⚠️ ' : 'ℹ️ ';
    console.log(`${icon} ${sev} (${fs2.length})`);
    for (const f of fs2) console.log(`   [${f.cat}] ${f.msg}`);
    console.log('');
  }
  const e = findings.filter((f) => f.sev === 'ERROR').length;
  const w = findings.filter((f) => f.sev === 'WARN').length;
  const i = findings.filter((f) => f.sev === 'INFO').length;
  console.log(`──────── ÖZET: ${e} ERROR · ${w} WARN · ${i} INFO ────────`);
  console.log('(read-only — hiçbir dosya/DB değişmedi)\n');
}

main().catch((e) => { console.error(e); process.exit(1); });

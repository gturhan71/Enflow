// ============================================================================
// security-reporter.ts — Enflow Güvenlik Test Mail Reporter
//
// Playwright custom reporter (listelemede JSON reporter'dan sonra gelir).
// onEnd çağrısında JSON reporter zaten results.json'u yazmış olur.
//
// Normal çalışma  : pnpm test  → mail yok, sadece terminal özeti
// Prelaunch modu  : pnpm prelaunch (SEND_SECURITY_REPORT=true) → mail gönderilir
// ============================================================================

import type { Reporter, Suite, TestCase, TestResult, FullResult } from "@playwright/test/reporter";
import { config as loadEnv } from "dotenv";
import * as path from "path";
import * as fs from "fs";
import * as nodemailer from "nodemailer";

loadEnv({ path: path.resolve(__dirname, ".env") });

// ── Tipler ────────────────────────────────────────────────────────────────
interface FlatSpec {
  file: string;
  suite: string;
  title: string;
  status: "passed" | "failed" | "skipped" | "timedOut";
  duration: number;
  error?: string;
}

interface PwSpec {
  title: string;
  tests: { results: { status: string; duration: number; errors?: { message?: string }[] }[] }[];
}
interface PwSuite { title: string; specs?: PwSpec[]; suites?: PwSuite[] }
interface PwJson {
  suites: PwSuite[];
  stats: { startTime: string; duration: number; unexpected: number; expected: number };
}

const FILE_LABELS: Record<string, string> = {
  "auth/auth.setup.ts":             "Kimlik Doğrulama Setup",
  "tests/api-permissions.spec.ts":  "API Yetki Matrisi",
  "tests/tenant-isolation.spec.ts": "Tenant İzolasyonu (IDOR)",
  "tests/ui-access.spec.ts":        "UI Erişim Kontrolü",
};

// ── JSON dosyasından spec listesi ─────────────────────────────────────────
function flattenSuite(file: string, suite: PwSuite, suiteStack: string[] = []): FlatSpec[] {
  const out: FlatSpec[] = [];
  const cur = [...suiteStack, ...(suite.title && suite.title !== file ? [suite.title] : [])];

  for (const spec of suite.specs ?? []) {
    const attempt = spec.tests[0]?.results[0];
    if (!attempt) continue;
    out.push({
      file,
      suite:    cur.join(" › "),
      title:    spec.title,
      status:   attempt.status as FlatSpec["status"],
      duration: attempt.duration,
      error:    attempt.errors?.[0]?.message?.replace(/\x1B\[[0-9;]*m/g, "").slice(0, 400),
    });
  }
  for (const sub of suite.suites ?? []) {
    out.push(...flattenSuite(file, sub, cur));
  }
  return out;
}

// ── HTML rapor ────────────────────────────────────────────────────────────
function buildHtml(specs: FlatSpec[], durationMs: number, startTime: string): string {
  const passed  = specs.filter(s => s.status === "passed").length;
  const failed  = specs.filter(s => s.status === "failed" || s.status === "timedOut").length;
  const skipped = specs.filter(s => s.status === "skipped").length;
  const total   = specs.length;
  const allGood = failed === 0;
  const durationSec = (durationMs / 1000).toFixed(1);
  const date = new Date(startTime).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" });

  const headerBg    = allGood ? "#16a34a" : "#dc2626";
  const statusBadge = allGood
    ? `<span style="background:#dcfce7;color:#15803d;padding:4px 14px;border-radius:20px;font-weight:700;font-size:13px;">✅ TÜM TESTLER GEÇTİ</span>`
    : `<span style="background:#fee2e2;color:#b91c1c;padding:4px 14px;border-radius:20px;font-weight:700;font-size:13px;">❌ ${failed} TEST BAŞARISIZ</span>`;

  // Group by file preserving insertion order
  const byFile = new Map<string, FlatSpec[]>();
  for (const spec of specs) {
    if (!byFile.has(spec.file)) byFile.set(spec.file, []);
    byFile.get(spec.file)!.push(spec);
  }

  let tables = "";
  for (const [file, fileSpecs] of byFile) {
    const label    = FILE_LABELS[file] ?? file;
    const fileFail = fileSpecs.filter(s => s.status === "failed" || s.status === "timedOut").length;
    const filePass = fileSpecs.filter(s => s.status === "passed").length;
    const fileBadge = fileFail === 0
      ? `<span style="color:#16a34a;font-weight:700;">✓ ${filePass}/${fileSpecs.length}</span>`
      : `<span style="color:#dc2626;font-weight:700;">✗ ${fileFail} hata &mdash; ${filePass}/${fileSpecs.length}</span>`;

    const rows = fileSpecs.map(spec => {
      const isFail = spec.status === "failed" || spec.status === "timedOut";
      const isSkip = spec.status === "skipped";
      const icon   = isFail ? "✗" : isSkip ? "–" : "✓";
      const rowBg  = isFail ? "#fef2f2" : isSkip ? "#f8fafc" : "#f0fdf4";
      const color  = isFail ? "#b91c1c" : isSkip ? "#64748b" : "#15803d";
      const errRow = spec.error
        ? `<tr><td colspan="4" style="padding:3px 12px 7px 28px;font-size:11px;color:#7f1d1d;background:#fff1f2;font-family:monospace;white-space:pre-wrap;">${spec.error.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</td></tr>`
        : "";
      return `
        <tr style="background:${rowBg};border-bottom:1px solid #f1f5f9;">
          <td style="padding:5px 12px;font-size:13px;color:${color};font-weight:700;">${icon}</td>
          <td style="padding:5px 8px;font-size:11px;color:#64748b;">${spec.suite}</td>
          <td style="padding:5px 8px;font-size:12px;color:#111827;">${spec.title}</td>
          <td style="padding:5px 8px;font-size:11px;color:#94a3b8;text-align:right;">${spec.duration}ms</td>
        </tr>${errRow}`;
    }).join("");

    tables += `
      <div style="margin-bottom:28px;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 16px;background:#f1f5f9;border-radius:6px 6px 0 0;border:1px solid #e2e8f0;">
          <span style="font-weight:700;font-size:14px;color:#1e293b;">${label}</span>
          ${fileBadge}
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:none;">
          <thead style="background:#f8fafc;">
            <tr>
              <th style="padding:5px 12px;text-align:left;font-size:10px;color:#94a3b8;font-weight:600;width:20px;"></th>
              <th style="padding:5px 8px;text-align:left;font-size:10px;color:#94a3b8;font-weight:600;">Grup</th>
              <th style="padding:5px 8px;text-align:left;font-size:10px;color:#94a3b8;font-weight:600;">Test</th>
              <th style="padding:5px 8px;text-align:right;font-size:10px;color:#94a3b8;font-weight:600;">Süre</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  const statItems: [string, string | number, string][] = [
    ["Toplam", total, "#1e293b"],
    ["Geçti", passed, "#16a34a"],
    ["Başarısız", failed, "#dc2626"],
    ["Atlandı", skipped, "#64748b"],
    ["Süre", durationSec + "s", "#7c3aed"],
  ];

  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"><title>Enflow Güvenlik Raporu</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <div style="max-width:820px;margin:0 auto;background:#fff;border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.08);overflow:hidden;">
    <div style="background:${headerBg};padding:28px 32px;">
      <div style="font-size:10px;color:rgba(255,255,255,.65);text-transform:uppercase;letter-spacing:.12em;margin-bottom:8px;">Enflow · RBAC &amp; Güvenlik Test Raporu</div>
      <div style="font-size:26px;font-weight:800;color:#fff;margin-bottom:14px;">Canlıya Geçiş Güvenlik Denetimi</div>
      ${statusBadge}
    </div>
    <div style="display:flex;border-bottom:1px solid #e2e8f0;">
      ${statItems.map(([label, val, color]) => `
        <div style="flex:1;padding:18px 8px;text-align:center;border-right:1px solid #e2e8f0;">
          <div style="font-size:24px;font-weight:800;color:${color};">${val}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:3px;text-transform:uppercase;letter-spacing:.05em;">${label}</div>
        </div>`).join("")}
    </div>
    <div style="padding:12px 24px;background:#f8fafc;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;">
      📅 ${date} &nbsp;·&nbsp; 🌐 ${process.env.ENFLOW_API_URL ?? "localhost:3002"} &nbsp;·&nbsp; 🏢 Tenant: tenant-1
    </div>
    <div style="padding:24px 24px 8px;">${tables}</div>
    <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8;">
      Bu rapor Enflow RBAC Test Suite tarafından otomatik üretilmiştir &middot; <code>pnpm prelaunch</code>
    </div>
  </div>
</body>
</html>`;
}

// ── Reporter ───────────────────────────────────────────────────────────────
class SecurityMailReporter implements Reporter {
  // Tests are read from results.json (written by the JSON reporter before us)
  onBegin(_c: unknown, _s: Suite) {}
  onTestEnd(_t: TestCase, _r: TestResult) {}

  async onEnd(result: FullResult) {
    const jsonPath = path.join(__dirname, "test-results", "results.json");

    let specs: FlatSpec[] = [];
    let startTime = new Date().toISOString();
    let totalDuration = result.duration;

    if (fs.existsSync(jsonPath)) {
      const pw: PwJson = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      startTime     = pw.stats.startTime;
      totalDuration = pw.stats.duration;
      for (const top of pw.suites) specs.push(...flattenSuite(top.title, top));
    } else {
      console.log("\n[Security Reporter] results.json henüz yazılmamış, terminale özet verilecek.");
    }

    const passed = specs.filter(s => s.status === "passed").length;
    const failed = specs.filter(s => s.status === "failed" || s.status === "timedOut").length;
    const total  = specs.length;

    console.log(`\n╔═══════════════════════════════════════════════════════════╗`);
    console.log(`║  ENFLOW GÜVENLİK RAPORU                                   ║`);
    console.log(`╠═══════════════════════════════════════════════════════════╣`);
    console.log(`║  Toplam: ${String(total).padEnd(4)}  Geçti: ${String(passed).padEnd(4)}  Başarısız: ${String(failed).padEnd(21)}║`);
    console.log(`║  Durum: ${failed === 0 ? "✅ TÜM TESTLER GEÇTİ                           ║" : `❌ ${failed} AÇIK TESPİT EDİLDİ                    ║`}`);
    console.log(`╚═══════════════════════════════════════════════════════════╝`);

    const sendMail = process.env.SEND_SECURITY_REPORT === "true";
    if (!sendMail) {
      console.log(`  ℹ  Mail kapalı. Etkinleştirmek: SEND_SECURITY_REPORT=true pnpm prelaunch\n`);
      return;
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const smtpHost   = process.env.SMTP_HOST;
    if (!adminEmail || !smtpHost) {
      console.log(`  ⚠  ADMIN_EMAIL veya SMTP_HOST tanımlı değil — mail atlanıyor.\n`);
      return;
    }

    const subject = failed === 0
      ? `✅ Enflow Güvenlik Denetimi BAŞARILI — ${passed}/${total} test geçti`
      : `❌ Enflow Güvenlik Denetimi BAŞARISIZ — ${failed} açık tespit edildi`;

    const html = buildHtml(specs, totalDuration, startTime);

    const transporter = nodemailer.createTransport({
      host:   smtpHost,
      port:   parseInt(process.env.SMTP_PORT ?? "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls:    { rejectUnauthorized: false },
    });

    try {
      await transporter.sendMail({
        from:    process.env.REPORT_FROM ?? process.env.SMTP_USER,
        to:      adminEmail,
        subject,
        html,
      });
      console.log(`  ✉  Rapor gönderildi → ${adminEmail}\n`);
    } catch (err) {
      console.error(`  ✗  Mail gönderilemedi: ${(err as Error).message}\n`);
    }
  }

  printsToStdio() { return true; }
}

export default SecurityMailReporter;

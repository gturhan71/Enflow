import { fmtCurrencyExact as fmt } from '../../lib/format';
import { Project } from '../../types';
import { MS_STATUS_CONFIG, COST_CAT_LABEL, type ProjectHandoverDoc } from './constants';

export const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
export const fmtShort = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }) : '—';
export const isOverdue = (d?: string | null) => !!d && new Date(d) < new Date();

// ── Yardımcı hesaplamalar ──────────────────────────────────────────────────────

export const calcFinancials = (p: Project) => {
  const totalPlanned = p.projectCostItems.reduce((s, c) => s + c.plannedAmount, 0);
  const totalActual  = p.projectCostItems.reduce((s, c) => s + c.amountTRY, 0);
  const contractVal  = p.totalValue;
  const plannedMargin = contractVal > 0 ? ((contractVal - totalPlanned) / contractVal) * 100 : 0;
  const actualMargin  = contractVal > 0 ? ((contractVal - totalActual)  / contractVal) * 100 : 0;
  const forecastCost  = totalActual + (totalPlanned > totalActual ? totalPlanned - totalActual : 0);
  const forecastMargin = contractVal > 0 ? ((contractVal - forecastCost) / contractVal) * 100 : 0;
  const delayedMs = p.milestones.filter(m =>
    m.status !== 'COMPLETED' && m.status !== 'CANCELLED' && isOverdue(m.plannedEnd)
  ).length;
  return { totalPlanned, totalActual, plannedMargin, actualMargin, forecastMargin, forecastCost, delayedMs };
};

export function isHandoverComplete(docs: ProjectHandoverDoc[]): boolean {
  if (docs.length === 0) return false;
  return docs.filter(d => d.isRequired).every(d => ['UPLOADED', 'VERIFIED', 'WAIVED'].includes(d.status));
}

// ── PDF Rapor Yazdırma ────────────────────────────────────────────────────────

export const printProjectReport = (project: Project, forCustomer = false) => {
  const fin = calcFinancials(project);
  const w = window.open('', '_blank');
  if (!w) return;
  const msRows = project.milestones.map(m => {
    const sc = MS_STATUS_CONFIG[m.status];
    return `<tr><td>${m.title}</td><td>${sc.label}</td><td>%${m.progress}</td><td>${fmtDate(m.plannedStart)}</td><td>${fmtDate(m.plannedEnd)}</td><td>${fmtDate(m.actualEnd)}</td></tr>`;
  }).join('');
  const costRows = forCustomer ? '' : project.projectCostItems.map(c =>
    `<tr><td>${COST_CAT_LABEL[c.category]}</td><td>${c.description}</td><td>${fmt(c.plannedAmount)}</td><td>${fmt(c.amountTRY)}</td></tr>`
  ).join('');

  w.document.write(`<!DOCTYPE html><html><head><title>Proje Raporu — ${project.name}</title>
  <style>body{font-family:Arial,sans-serif;padding:40px;color:#1e293b;max-width:900px;margin:0 auto}
  h1{font-size:22px;margin-bottom:4px}h2{font-size:15px;margin:24px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
  table{width:100%;border-collapse:collapse;font-size:12px}td,th{padding:6px 8px;border:1px solid #e2e8f0;text-align:left}
  th{background:#f8fafc;font-weight:600}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
  .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px}.label{font-size:11px;color:#64748b}
  .val{font-size:16px;font-weight:700;margin-top:2px}.warn{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;color:#dc2626;font-size:12px}</style>
  </head><body>
  <h1>Proje Raporu${forCustomer ? ' (Müşteri)' : ''}</h1>
  <p style="color:#64748b;font-size:13px">${project.name} · ${fmtDate(new Date().toISOString())}</p>
  <div class="grid">
    <div class="card"><p class="label">Müşteri</p><p class="val" style="font-size:14px">${project.customerName ?? '—'}</p></div>
    <div class="card"><p class="label">Proje Yöneticisi</p><p class="val" style="font-size:14px">${project.pmName ?? '—'}</p></div>
    <div class="card"><p class="label">Sözleşme Bedeli</p><p class="val">${fmt(project.totalValue, project.contractCurrency)}</p></div>
    <div class="card"><p class="label">İlerleme</p><p class="val">%${project.progress}</p></div>
    <div class="card"><p class="label">Planlanan Bitiş</p><p class="val" style="font-size:14px">${fmtDate(project.plannedEndDate)}</p></div>
    <div class="card"><p class="label">Aktif Faz</p><p class="val" style="font-size:14px">${project.phase}</p></div>
  </div>
  <h2>Milestone Takibi</h2>
  <table><tr><th>Milestone</th><th>Durum</th><th>İlerleme</th><th>Plan Başlangıç</th><th>Plan Bitiş</th><th>Gerçek Bitiş</th></tr>${msRows}</table>
  ${!forCustomer ? `
  <h2>Finansal Özet</h2>
  <div class="grid">
    <div class="card"><p class="label">Planlanan Maliyet</p><p class="val">${fmt(fin.totalPlanned)}</p></div>
    <div class="card"><p class="label">Gerçekleşen Maliyet</p><p class="val">${fmt(fin.totalActual)}</p></div>
    <div class="card"><p class="label">Planlanan Kar Marjı</p><p class="val" style="color:${fin.plannedMargin >= 0 ? '#16a34a' : '#dc2626'}">%${fin.plannedMargin.toFixed(1)}</p></div>
    <div class="card"><p class="label">Gerçekleşen Kar Marjı</p><p class="val" style="color:${fin.actualMargin >= 0 ? '#16a34a' : '#dc2626'}">%${fin.actualMargin.toFixed(1)}</p></div>
  </div>
  ${costRows ? `<h2>Maliyet Kalemleri</h2><table><tr><th>Kategori</th><th>Açıklama</th><th>Planlanan</th><th>Gerçekleşen</th></tr>${costRows}</table>` : ''}
  ${fin.actualMargin < fin.plannedMargin - 5 ? `<div class="warn">⚠ Gerçekleşen karlılık plandan %${(fin.plannedMargin - fin.actualMargin).toFixed(1)} geride.</div>` : ''}
  ` : ''}
  </body></html>`);
  w.document.close();
  w.print();
};

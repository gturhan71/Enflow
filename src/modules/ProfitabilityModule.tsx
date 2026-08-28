// Enflow — Kârlılık modülü (Faz A iskeleti)
// ─────────────────────────────────────────────────────────────────────────────
// Zamana duyarlı kârlılık: proje / aylık / çeyreklik / yıllık, planlanan +
// gerçekleşen paralel, as-of tarihli. Nakit & hazine panelleri Faz B.
//
// bkz. docs/KARLILIK_ANALIZI_PLAN.md §6

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { apiService } from '../services/apiService';
import { fmtCurrency } from '../lib/format';
import MarginBadge from './project-mgmt/MarginBadge';
import type { ProfitGrain, ProfitPeriodRow, ProfitSummaryResult } from '../types';

const GRAINS: { key: ProfitGrain; label: string }[] = [
  { key: 'PROJECT', label: 'Proje' },
  { key: 'MONTH', label: 'Aylık' },
  { key: 'QUARTER', label: 'Çeyreklik' },
  { key: 'YEAR', label: 'Yıllık' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ProfitabilityModule() {
  const [grain, setGrain] = useState<ProfitGrain>('QUARTER');
  const [asOf, setAsOf] = useState<string>(todayISO());
  const [year, setYear] = useState<number | ''>(new Date().getUTCFullYear());
  const [view, setView] = useState<'PLAN' | 'ACTUAL' | 'BOTH'>('BOTH');
  const [data, setData] = useState<ProfitSummaryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getProfitabilitySummary({
        grain,
        asOf: new Date(asOf).toISOString(),
        year: grain === 'PROJECT' ? undefined : (year === '' ? undefined : Number(year)),
      });
      setData(res as ProfitSummaryResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kârlılık verisi alınamadı.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [grain, asOf, year]);

  useEffect(() => { void load(); }, [load]);

  const rows = data?.rows ?? [];

  const totals = useMemo(() => {
    const acc = { plannedRevenue: 0, plannedCost: 0, actualRevenue: 0, actualCost: 0, eacCost: 0 };
    for (const r of rows) {
      acc.plannedRevenue += r.plannedRevenue;
      acc.plannedCost += r.plannedCost;
      acc.actualRevenue += r.actualRevenue;
      acc.actualCost += r.actualCost;
      acc.eacCost += r.eacCost;
    }
    return acc;
  }, [rows]);

  const marginPct = (rev: number, cost: number) => (rev > 0 ? ((rev - cost) / rev) * 100 : 0);

  const chartData = useMemo(
    () => rows.map((r) => ({
      name: r.label,
      Planlanan: Math.round(r.plannedRevenue - r.plannedCost),
      Gerçekleşen: Math.round(r.actualRevenue - r.actualCost),
      EAC: Math.round((r.actualRevenue > 0 ? r.actualRevenue : r.plannedRevenue) - r.eacCost),
    })),
    [rows],
  );

  const fxWarnings = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) r.fxWarnings.forEach((w) => s.add(w));
    return [...s];
  }, [rows]);

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Kârlılık Analizi</h1>
          <p className="text-xs text-slate-500">
            Planlanan (öngörü) ve gerçekleşen — tahakkuk + nakit paralel · as-of {asOf}
          </p>
        </div>
        <button onClick={() => void load()} className="btn-secondary text-xs" disabled={loading}>
          {loading ? 'Yükleniyor…' : 'Yenile'}
        </button>
      </header>

      {/* Kontrol çubuğu */}
      <div className="glass-card p-3 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">Ayrım</label>
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            {GRAINS.map((g) => (
              <button
                key={g.key}
                onClick={() => setGrain(g.key)}
                className={`px-3 py-1.5 text-xs font-semibold ${grain === g.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">Bakış</label>
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            {(['PLAN', 'ACTUAL', 'BOTH'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-semibold ${view === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {v === 'PLAN' ? 'Planlanan' : v === 'ACTUAL' ? 'Gerçekleşen' : 'İkisi'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">As-of tarih</label>
          <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="input-glass text-xs py-1.5" />
        </div>

        {grain !== 'PROJECT' && (
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">Yıl</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value === '' ? '' : Number(e.target.value))}
              className="input-glass text-xs py-1.5 w-24"
              placeholder="Tümü"
            />
          </div>
        )}
      </div>

      {error && <div className="glass-card p-3 text-sm text-red-600 border border-red-200">{error}</div>}

      {fxWarnings.length > 0 && (
        <div className="glass-card p-3 text-xs text-amber-700 border border-amber-200">
          Kur oranı tanımsız para birimleri TRY toplamına katılmadı: <b>{fxWarnings.join(', ')}</b>.
          Ayarlar → Finans → Kur oranları ile ekleyin (Faz B).
        </div>
      )}

      {/* Özet kartları */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard label="Planlanan marj" pct={marginPct(totals.plannedRevenue, totals.plannedCost)}
          sub={`${fmtCurrency(totals.plannedRevenue - totals.plannedCost)} net`} />
        <SummaryCard label="Gerçekleşen marj" pct={marginPct(totals.actualRevenue, totals.actualCost)}
          sub={`${fmtCurrency(totals.actualRevenue - totals.actualCost)} net`} />
        <SummaryCard label="EAC marj (tahmini tamamlanma)" pct={marginPct(totals.actualRevenue > 0 ? totals.actualRevenue : totals.plannedRevenue, totals.eacCost)}
          sub={`${fmtCurrency(totals.eacCost)} tahmini maliyet`} />
        <SummaryCard label="Sapma (plan − gerçek)"
          pct={marginPct(totals.plannedRevenue, totals.plannedCost) - marginPct(totals.actualRevenue, totals.actualCost)}
          sub="puan" />
      </div>

      {/* Dönem net kârlılık grafiği */}
      {chartData.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-black text-slate-900 mb-3">Dönem net kârlılık</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '11px', fontWeight: 700 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {(view === 'PLAN' || view === 'BOTH') && <Bar dataKey="Planlanan" fill="#94a3b8" radius={[3, 3, 0, 0]} />}
                {(view === 'ACTUAL' || view === 'BOTH') && <Bar dataKey="Gerçekleşen" fill="#0f172a" radius={[3, 3, 0, 0]} />}
                {(view === 'ACTUAL' || view === 'BOTH') && <Bar dataKey="EAC" fill="#6366f1" radius={[3, 3, 0, 0]} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Dönem tablosu */}
      <div className="glass-card p-0 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="px-3 py-2 font-bold">{grain === 'PROJECT' ? 'Proje' : 'Dönem'}</th>
              {(view === 'PLAN' || view === 'BOTH') && <th className="px-3 py-2 font-bold text-right">Plan gelir</th>}
              {(view === 'PLAN' || view === 'BOTH') && <th className="px-3 py-2 font-bold text-right">Plan maliyet</th>}
              {(view === 'PLAN' || view === 'BOTH') && <th className="px-3 py-2 font-bold text-right">Plan marj</th>}
              {(view === 'ACTUAL' || view === 'BOTH') && <th className="px-3 py-2 font-bold text-right">Gerçek gelir</th>}
              {(view === 'ACTUAL' || view === 'BOTH') && <th className="px-3 py-2 font-bold text-right">Gerçek maliyet</th>}
              {(view === 'ACTUAL' || view === 'BOTH') && <th className="px-3 py-2 font-bold text-right">Gerçek marj</th>}
              <th className="px-3 py-2 font-bold text-right">EAC marj</th>
              <th className="px-3 py-2 font-bold text-right">Nakit net (gerçek)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: ProfitPeriodRow) => (
              <tr key={r.periodKey} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-semibold text-slate-800">{r.label}</td>
                {(view === 'PLAN' || view === 'BOTH') && <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(r.plannedRevenue)}</td>}
                {(view === 'PLAN' || view === 'BOTH') && <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(r.plannedCost)}</td>}
                {(view === 'PLAN' || view === 'BOTH') && <td className="px-3 py-2 text-right"><MarginBadge value={r.plannedMarginPct} /></td>}
                {(view === 'ACTUAL' || view === 'BOTH') && <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(r.actualRevenue)}</td>}
                {(view === 'ACTUAL' || view === 'BOTH') && <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(r.actualCost)}</td>}
                {(view === 'ACTUAL' || view === 'BOTH') && <td className="px-3 py-2 text-right"><MarginBadge value={r.actualMarginPct} /></td>}
                <td className="px-3 py-2 text-right"><MarginBadge value={r.eacMarginPct} /></td>
                <td className={`px-3 py-2 text-right tabular-nums ${r.actualCashNet < 0 ? 'text-red-600' : 'text-slate-700'}`}>{fmtCurrency(r.actualCashNet)}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400">Bu seçim için veri yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400">
        Faz A — canlı plan, tahakkuk + nakit paralel. Konsolide nakit pozisyonu grafiği, hazine
        (finansal enstrüman) katkı paneli ve aylık plan-snapshot Faz B/C'de eklenecek.
      </p>
    </div>
  );
}

function SummaryCard({ label, pct, sub }: { label: string; pct: number; sub: string }) {
  return (
    <div className="glass-card p-3">
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <div className="mt-1"><MarginBadge value={Number.isFinite(pct) ? pct : 0} /></div>
      <p className="text-[11px] text-slate-400 mt-1">{sub}</p>
    </div>
  );
}

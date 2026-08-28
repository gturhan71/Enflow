// Enflow — Kârlılık modülü (Faz A iskeleti)
// ─────────────────────────────────────────────────────────────────────────────
// Zamana duyarlı kârlılık: proje / aylık / çeyreklik / yıllık, planlanan +
// gerçekleşen paralel, as-of tarihli. Nakit & hazine panelleri Faz B.
//
// bkz. docs/KARLILIK_ANALIZI_PLAN.md §6

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine,
} from 'recharts';
import { apiService } from '../services/apiService';
import { fmtCurrency } from '../lib/format';
import MarginBadge from './project-mgmt/MarginBadge';
import DmoChannelTab from './profitability/DmoChannelTab';
import type {
  ProfitGrain, ProfitPeriodRow, ProfitSummaryResult, CashflowResult, TreasuryResult, PlanDriftSeries,
  InstrumentsResult,
} from '../types';

const GRAINS: { key: ProfitGrain; label: string }[] = [
  { key: 'PROJECT', label: 'Proje' },
  { key: 'MONTH', label: 'Aylık' },
  { key: 'QUARTER', label: 'Çeyreklik' },
  { key: 'YEAR', label: 'Yıllık' },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ProfitabilityModule() {
  const [mainTab, setMainTab] = useState<'projects' | 'dmo'>('projects');
  const [dmoEntitled, setDmoEntitled] = useState(false);
  const [grain, setGrain] = useState<ProfitGrain>('QUARTER');
  const [asOf, setAsOf] = useState<string>(todayISO());
  const [year, setYear] = useState<number | ''>(new Date().getUTCFullYear());
  const [view, setView] = useState<'PLAN' | 'ACTUAL' | 'BOTH'>('BOTH');
  const [includeOverhead, setIncludeOverhead] = useState(true);
  const [data, setData] = useState<ProfitSummaryResult | null>(null);
  const [cashflow, setCashflow] = useState<CashflowResult | null>(null);
  const [treasury, setTreasury] = useState<TreasuryResult | null>(null);
  const [planDrift, setPlanDrift] = useState<PlanDriftSeries[]>([]);
  const [instruments, setInstruments] = useState<InstrumentsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const asOfISO = new Date(asOf).toISOString();
    const yr = grain === 'PROJECT' ? undefined : (year === '' ? undefined : Number(year));
    const range = yr
      ? { from: new Date(Date.UTC(yr, 0, 1)).toISOString(), to: new Date(Date.UTC(yr, 11, 31)).toISOString() }
      : {};
    const ovh = includeOverhead ? undefined : '0';
    try {
      const [sum, cf, tr, drift, inst] = await Promise.all([
        apiService.getProfitabilitySummary({ grain, asOf: asOfISO, year: yr, overhead: ovh }),
        apiService.getProfitabilityCashflow({ asOf: asOfISO, ...range, overhead: ovh }),
        apiService.getProfitabilityTreasury({ asOf: asOfISO, ...range, overhead: ovh }),
        apiService.getProfitabilityPlanDrift(),
        apiService.getProfitabilityInstruments({ asOf: asOfISO, ...range, overhead: ovh }),
      ]);
      setData(sum as ProfitSummaryResult);
      setCashflow(cf as CashflowResult);
      setTreasury(tr as TreasuryResult);
      setPlanDrift((drift?.series ?? []).filter((s) => s.points.length > 1));
      setInstruments(inst as InstrumentsResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kârlılık verisi alınamadı.');
      setData(null);
      setCashflow(null);
      setTreasury(null);
      setInstruments(null);
    } finally {
      setLoading(false);
    }
  }, [grain, asOf, year, includeOverhead]);

  const takeSnapshot = useCallback(async () => {
    setSnapping(true);
    setNotice(null);
    setError(null);
    try {
      const r = await apiService.takeProfitabilitySnapshot();
      setNotice(`Snapshot alındı (${r.asOfKey}) — ${r.written} dönem donduruldu.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Snapshot alınamadı (GM / Finans Md. yetkisi gerekir).');
    } finally {
      setSnapping(false);
    }
  }, [load]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let alive = true;
    apiService.getPluginEntitlements()
      .then((rows) => {
        if (!alive) return;
        const set = new Set((rows as { plugin: { key: string }; active: boolean }[] | undefined ?? [])
          .filter((r) => r.active).map((r) => r.plugin.key));
        setDmoEntitled(set.has('DMO_MODULE'));
      })
      .catch(() => { /* entitlement alınamazsa DMO sekmesi gizli kalır */ });
    return () => { alive = false; };
  }, []);

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
    (cashflow?.fxWarnings ?? []).forEach((w) => s.add(w));
    return [...s];
  }, [rows, cashflow]);

  const cashChartData = useMemo(
    () => (cashflow?.consolidatedTRY.points ?? []).map((p) => ({
      date: p.date.slice(0, 10),
      Pozisyon: Math.round(p.cumulative),
      kind: p.source,
    })),
    [cashflow],
  );

  if (mainTab === 'dmo') {
    return (
      <div className="p-4 sm:p-6 space-y-5">
        <MainTabs tab={mainTab} onTab={setMainTab} dmoEntitled={dmoEntitled} />
        <DmoChannelTab />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <MainTabs tab={mainTab} onTab={setMainTab} dmoEntitled={dmoEntitled} />
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Kârlılık Analizi</h1>
          <p className="text-xs text-slate-500">
            Planlanan (öngörü) ve gerçekleşen — tahakkuk + nakit paralel · as-of {asOf}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void takeSnapshot()} className="btn-secondary text-xs" disabled={snapping} title="Planın bugünkü halini dondur (plan-drift izlemesi)">
            {snapping ? 'Alınıyor…' : 'Plan snapshot al'}
          </button>
          <button onClick={() => void load()} className="btn-secondary text-xs" disabled={loading}>
            {loading ? 'Yükleniyor…' : 'Yenile'}
          </button>
        </div>
      </header>

      {notice && <div className="glass-card p-3 text-sm text-emerald-700 border border-emerald-200">{notice}</div>}

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

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">İşletme maliyeti</label>
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            <button
              onClick={() => setIncludeOverhead(true)}
              className={`px-3 py-1.5 text-xs font-semibold ${includeOverhead ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              title="Tam-yüklü marj — işletme maliyeti (overhead) payı dahil"
            >
              Dahil
            </button>
            <button
              onClick={() => setIncludeOverhead(false)}
              className={`px-3 py-1.5 text-xs font-semibold ${!includeOverhead ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              title="Doğrudan / katkı marjı — yalnız proje maliyetleri"
            >
              Hariç
            </button>
          </div>
        </div>
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

      {/* ── Nakit pozisyonu & Hazine (Faz B) ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="glass-card p-4 lg:col-span-2">
          <h3 className="text-sm font-black text-slate-900 mb-1">Konsolide nakit pozisyonu (TRY)</h3>
          <p className="text-[11px] text-slate-400 mb-3">
            Geçmiş = gerçekleşen, gelecek = plan (as-of {asOf}). Sıfırın altı = finansman ihtiyacı.
          </p>
          {cashChartData.length > 0 ? (
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <LineChart data={cashChartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '11px', fontWeight: 700 }} />
                  <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="Pozisyon" stroke="#0f172a" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-8 text-center">Nakit olayı yok.</p>
          )}
          {cashflow && cashflow.deficitWindows.length > 0 && (
            <div className="mt-3 text-[11px] text-amber-700">
              <span className="font-bold">Açık pencereleri:</span>{' '}
              {cashflow.deficitWindows.slice(0, 4).map((w, i) => (
                <span key={i}>
                  {w.currency} {w.from.slice(0, 10)}→{w.to.slice(0, 10)} (en dip {fmtCurrency(w.troughAmount, w.currency)})
                  {i < Math.min(cashflow.deficitWindows.length, 4) - 1 ? ' · ' : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-4">
          <h3 className="text-sm font-black text-slate-900 mb-1">Hazine katkısı</h3>
          <p className="text-[11px] text-slate-400 mb-3">
            Nakit açığı/fazlası × faiz (yıllık %{treasury?.totalTRY.ratePct ?? '–'}). Finansal enstrüman
            senaryoları Faz D.
          </p>
          {treasury ? (
            <div className="space-y-2 text-xs">
              <TreasuryRow label="Finansman maliyeti (açık)" value={-treasury.totalTRY.financingCost} negativeIsBad />
              <TreasuryRow label="Getiri (fazla)" value={treasury.totalTRY.financingBenefit} />
              <div className="border-t border-slate-200 pt-2 flex items-center justify-between font-black">
                <span>Net hazine katkısı</span>
                <span className={treasury.totalTRY.treasuryNet < 0 ? 'text-red-600' : 'text-emerald-600'}>
                  {fmtCurrency(treasury.totalTRY.treasuryNet)}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1">
                Ort. açık {fmtCurrency(treasury.totalTRY.timeWeightedDeficit)} · ort. fazla {fmtCurrency(treasury.totalTRY.timeWeightedSurplus)}
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-400">—</p>
          )}
        </div>
      </div>

      {/* ── Plan sapması (drift) — Faz C ────────────────────────────────── */}
      <div className="glass-card p-4">
        <h3 className="text-sm font-black text-slate-900 mb-1">Plan sapması (drift)</h3>
        <p className="text-[11px] text-slate-400 mb-3">
          Aylık plan snapshot'ları — bir dönemin planlı marj tahmininin zamanla nasıl kaydığı.
          {planDrift.length === 0 && ' Karşılaştırma için en az iki farklı aya ait snapshot gerekir.'}
        </p>
        {planDrift.length === 0 ? (
          <p className="text-xs text-slate-400 py-3 text-center">
            Henüz çoklu-ay snapshot yok. Her ay otomatik alınır; şimdi almak için “Plan snapshot al”.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200">
                  <th className="px-3 py-2 font-bold">Dönem</th>
                  <th className="px-3 py-2 font-bold">Planlı marj — snapshot dizisi (asOf → %)</th>
                  <th className="px-3 py-2 font-bold text-right">Toplam kayma</th>
                </tr>
              </thead>
              <tbody>
                {planDrift.map((s) => {
                  const first = s.points[0].plannedMargin;
                  const last = s.points[s.points.length - 1].plannedMargin;
                  return (
                    <tr key={s.periodKey} className="border-b border-slate-100">
                      <td className="px-3 py-2 font-semibold text-slate-800">{s.periodKey}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {s.points.map((p, i) => (
                          <span key={p.asOfKey}>
                            {i > 0 && ' → '}
                            <span className="text-slate-400">{p.asOfKey}</span> %{p.plannedMargin.toFixed(1)}
                          </span>
                        ))}
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${last - first < 0 ? 'text-red-600' : last - first > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                        {last - first >= 0 ? '+' : ''}{(last - first).toFixed(1)} p
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Finansal enstrüman senaryoları — Faz D ──────────────────────── */}
      {instruments && (
        <div className="glass-card p-4">
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="text-sm font-black text-slate-900">Finansal enstrümanlarla değer</h3>
            <span className="text-[11px] text-slate-400">
              Toplam fırsat: <b className={instruments.totalOpportunity > 0 ? 'text-emerald-600' : 'text-slate-500'}>{fmtCurrency(instruments.totalOpportunity)}</b>
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mb-3">
            Baz hazine katkısı {fmtCurrency(instruments.baseline.treasuryNet)} · gösterge deltalar (kesin fiyatlama değil), varsayımlar kartlarda.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {instruments.scenarios.map((s) => (
              <div key={s.instrument} className="border border-slate-200 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800">{s.label}</span>
                  <span className={`text-xs font-black tabular-nums ${s.delta > 0 ? 'text-emerald-600' : s.delta < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                    {s.delta >= 0 ? '+' : ''}{fmtCurrency(s.delta)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 leading-snug">{s.description}</p>
                <div className="text-[10px] text-slate-400 mt-2 space-x-2">
                  {Object.entries(s.assumptions).map(([k, v]) => (
                    <span key={k}>{k}: <b>{v}</b></span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        Faz A–D — canlı plan (tahakkuk + nakit paralel), konsolide nakit pozisyonu + faiz-bazlı hazine
        katkısı, aylık plan snapshot ile plan-drift, finansal enstrüman senaryoları. İşletme maliyeti
        (overhead) hem plana hem gerçekleşene simetrik uygulanır; yalnız proje kartında “İşletme
        maliyetini uygula” açık olan projeleri etkiler. Rakamlar gösterge; kur/faiz ayarları Ayarlar → Finans.
      </p>
    </div>
  );
}

function MainTabs({ tab, onTab, dmoEntitled }: { tab: 'projects' | 'dmo'; onTab: (t: 'projects' | 'dmo') => void; dmoEntitled: boolean }) {
  if (!dmoEntitled) return null;
  return (
    <div className="flex gap-1 border-b border-slate-200">
      {([['projects', 'Projeler'], ['dmo', 'DMO Kanalı']] as const).map(([k, label]) => (
        <button
          key={k}
          onClick={() => onTab(k)}
          className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px ${tab === k ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function TreasuryRow({ label, value, negativeIsBad }: { label: string; value: number; negativeIsBad?: boolean }) {
  const tone = value < 0 ? (negativeIsBad ? 'text-red-600' : 'text-slate-700') : 'text-emerald-600';
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`tabular-nums font-semibold ${tone}`}>{fmtCurrency(value)}</span>
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

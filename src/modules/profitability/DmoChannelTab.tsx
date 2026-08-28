// Enflow — Kârlılık modülü · DMO Kanalı sekmesi (Faz E)
// ─────────────────────────────────────────────────────────────────────────────
// Yalnız DMO_MODULE lisansı olan tenant'a görünür (ProfitabilityModule sekme
// çubuğu bu koşulu uygular). DMO ekonomisi (risturn + komisyon + kur açığı)
// proje marjından farklı → proje kümülatifinin DIŞINDA, kendi dönem tablosu.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import { apiService } from '../../services/apiService';
import { fmtCurrency } from '../../lib/format';
import MarginBadge from '../project-mgmt/MarginBadge';
import type { DmoProfitGrain, DmoProfitResult, DmoProfitPeriodRow } from '../../types';

const GRAINS: { key: DmoProfitGrain; label: string }[] = [
  { key: 'MONTH', label: 'Aylık' },
  { key: 'QUARTER', label: 'Çeyreklik' },
  { key: 'YEAR', label: 'Yıllık' },
  { key: 'INSTITUTION', label: 'Kurum' },
];

export default function DmoChannelTab() {
  const [grain, setGrain] = useState<DmoProfitGrain>('QUARTER');
  const [year, setYear] = useState<number | ''>(new Date().getUTCFullYear());
  const [data, setData] = useState<DmoProfitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getProfitabilityDmo({
        grain,
        year: grain === 'INSTITUTION' ? undefined : (year === '' ? undefined : Number(year)),
      });
      setData(res as DmoProfitResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'DMO kârlılık verisi alınamadı.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [grain, year]);

  useEffect(() => { void load(); }, [load]);

  const rows = data?.rows ?? [];
  const t = data?.totals;

  const chartData = useMemo(
    () => rows.map((r) => ({ name: r.label, 'Net kâr': Math.round(r.netProfit), Risturn: Math.round(-r.risturn), Komisyon: Math.round(-r.commission) })),
    [rows],
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">DMO Kanalı Kârlılığı</h1>
          <p className="text-xs text-slate-500">
            Risturn iadesi + komisyon sonrası net kâr — proje kümülatifinin dışında (ayrı kanal ekonomisi).
          </p>
        </div>
        <button onClick={() => void load()} className="btn-secondary text-xs" disabled={loading}>
          {loading ? 'Yükleniyor…' : 'Yenile'}
        </button>
      </header>

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
        {grain !== 'INSTITUTION' && (
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

      {t && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card label="Net kâr (aktif siparişler)" value={fmtCurrency(t.netProfit, data?.currency)} tone={t.netProfit >= 0 ? 'pos' : 'neg'} />
          <Card label="Net marj" value={`%${t.netMarginPct.toFixed(1)}`} badge={t.netMarginPct} />
          <Card label="Kârsız sipariş" value={String(t.unprofitableCount)} tone={t.unprofitableCount > 0 ? 'neg' : 'muted'} sub={`${t.orderCount} sipariş içinde`} />
          <Card label="Değerlendirmede (pipeline)" value={fmtCurrency(data?.pipeline.evaluationValue ?? 0, data?.currency)} tone="muted" sub={`${data?.pipeline.evaluationCount ?? 0} fırsat`} />
        </div>
      )}

      {chartData.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-black text-slate-900 mb-3">Net kâr · risturn/komisyon kesintisi</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }} stackOffset="sign">
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '11px', fontWeight: 700 }} />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Bar dataKey="Risturn" stackId="a" fill="#fca5a5" />
                <Bar dataKey="Komisyon" stackId="a" fill="#fdba74" />
                <Bar dataKey="Net kâr" stackId="a" fill="#0f172a" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="glass-card p-0 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200">
              <th className="px-3 py-2 font-bold">{grain === 'INSTITUTION' ? 'Kurum' : 'Dönem'}</th>
              <th className="px-3 py-2 font-bold text-right">Sipariş</th>
              <th className="px-3 py-2 font-bold text-right">Ciro</th>
              <th className="px-3 py-2 font-bold text-right">Brüt kâr</th>
              <th className="px-3 py-2 font-bold text-right">Risturn</th>
              <th className="px-3 py-2 font-bold text-right">Komisyon</th>
              <th className="px-3 py-2 font-bold text-right">Net kâr</th>
              <th className="px-3 py-2 font-bold text-right">Net marj</th>
              <th className="px-3 py-2 font-bold text-right">Kârsız</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: DmoProfitPeriodRow) => (
              <tr key={r.periodKey} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-semibold text-slate-800">{r.label}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.orderCount}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(r.revenue, data?.currency)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtCurrency(r.grossProfit, data?.currency)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-red-500">−{fmtCurrency(r.risturn, data?.currency)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-600">−{fmtCurrency(r.commission, data?.currency)}</td>
                <td className={`px-3 py-2 text-right tabular-nums font-semibold ${r.netProfit < 0 ? 'text-red-600' : 'text-slate-800'}`}>{fmtCurrency(r.netProfit, data?.currency)}</td>
                <td className="px-3 py-2 text-right"><MarginBadge value={r.netMarginPct} /></td>
                <td className={`px-3 py-2 text-right tabular-nums ${r.unprofitableCount > 0 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>{r.unprofitableCount || '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-slate-400">Bu seçim için aktif DMO siparişi yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-slate-400">
        Aktif siparişler (CONFIRMED → CLOSED); REJECTED/CANCELLED hariç. Değerlendirmedeki siparişler
        toplamlara girmez, ayrı pipeline olarak gösterilir. Kaynak: her siparişin `dmoCosting` snapshot'ı.
      </p>
    </div>
  );
}

function Card({ label, value, sub, tone, badge }: { label: string; value: string; sub?: string; tone?: 'pos' | 'neg' | 'muted'; badge?: number }) {
  const color = tone === 'pos' ? 'text-emerald-600' : tone === 'neg' ? 'text-red-600' : 'text-slate-800';
  return (
    <div className="glass-card p-3">
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      {badge !== undefined ? (
        <div className="mt-1"><MarginBadge value={badge} /></div>
      ) : (
        <p className={`text-lg font-black mt-0.5 ${color}`}>{value}</p>
      )}
      {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

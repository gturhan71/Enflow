import { Printer } from 'lucide-react';
import type { UnitDefinition, UnitMetrics } from '../../types';
import { esc, fmtValue, printReportWindow } from './helpers';
import MetricCard from './MetricCard';
import ChartBlock from './ChartBlock';

export default function UnitDetailTab({
  units, selectedUnit, setSelectedUnit, unitData, prevMetrics, start, end,
}: {
  units: UnitDefinition[];
  selectedUnit: string;
  setSelectedUnit: (key: string) => void;
  unitData: UnitMetrics | null;
  prevMetrics: Record<string, number>;
  start: string;
  end: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {units.map(u => (
          <button key={u.key} onClick={() => setSelectedUnit(u.key)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${selectedUnit === u.key ? 'bg-primary text-white shadow shadow-primary/20' : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100'}`}>
            {u.label}
          </button>
        ))}
      </div>
      {unitData && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-400 font-bold">Δ önceki döneme göre</p>
            <button onClick={() => unitData && printReportWindow(`Birim Metrikleri — ${unitData.label}`, `<h1>${esc(unitData.label)} — Metrikler</h1><p class="muted">${start} — ${end}</p><table><tr><th>Metrik</th><th>Değer</th><th>Not</th></tr>${unitData.metrics.map(m => `<tr><td>${esc(m.label)}</td><td>${fmtValue(m)}</td><td>${esc(m.hint ?? '')}</td></tr>`).join('')}</table>`)} className="btn-secondary px-3 py-1.5 rounded-lg text-xs flex items-center gap-1">
              <Printer size={13} /> Yazdır
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {unitData.metrics.map((m, i) => <MetricCard key={i} m={m} prev={prevMetrics[m.label]} />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {unitData.charts.map((c, i) => <ChartBlock key={i} c={c} />)}
          </div>
        </>
      )}
    </div>
  );
}

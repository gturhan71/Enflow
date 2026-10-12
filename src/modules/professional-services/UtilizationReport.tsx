import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2, CalendarOff, Plus, X } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { apiService } from '../../services/apiService';
import { UtilizationReportData } from '../../types';

// Ayın YYYY-MM anahtarını döner (mondayOf() ile aynı aile — Faz 2/5 dönem
// gezinme deseni). Bkz. docs/PROFESYONEL_HIZMETLER_PLAN.md Faz 5.
function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabelOf(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
}

export function UtilizationReport() {
  const [month, setMonth] = useState(monthKeyOf(new Date()));
  const [data, setData] = useState<UtilizationReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showHolidays, setShowHolidays] = useState(false);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [newHoliday, setNewHoliday] = useState('');
  const [savingHolidays, setSavingHolidays] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiService.getWorkOrderUtilization(month) as UtilizationReportData;
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [month]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { apiService.getWorkOrderHolidays().then((r) => setHolidays((r as { holidays: string[] }).holidays)).catch(() => {}); }, []);

  // Tenant-bazlı resmi tatil listesi — kapasite hesabı (dönemdeki iş günü × 8
  // saat) bu listeyi düşer. Küçük/izole: moduleSettings.professionalServices.holidays.
  const addHoliday = async () => {
    if (!newHoliday || holidays.includes(newHoliday)) return;
    setSavingHolidays(true);
    try {
      const next = [...holidays, newHoliday].sort();
      const r = await apiService.updateWorkOrderHolidays(next) as { holidays: string[] };
      setHolidays(r.holidays);
      setNewHoliday('');
      load();
    } finally {
      setSavingHolidays(false);
    }
  };
  const removeHoliday = async (date: string) => {
    setSavingHolidays(true);
    try {
      const next = holidays.filter(d => d !== date);
      const r = await apiService.updateWorkOrderHolidays(next) as { holidays: string[] };
      setHolidays(r.holidays);
      load();
    } finally {
      setSavingHolidays(false);
    }
  };

  const shiftMonth = (delta: number) => {
    const [y, m] = month.split('-').map(Number);
    setMonth(monthKeyOf(new Date(y, m - 1 + delta, 1)));
  };

  const chartData = (data?.technicians || []).map(t => ({ name: t.name, doluluk: t.utilizationPct ?? 0 }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => shiftMonth(-1)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><ChevronLeft size={16} /></button>
        <div className="text-sm font-black text-slate-800 capitalize">{monthLabelOf(month)}</div>
        <button onClick={() => shiftMonth(1)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500"><ChevronRight size={16} /></button>
        <button onClick={() => setMonth(monthKeyOf(new Date()))} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 ml-1">Bu Ay</button>
        {data && <span className="text-[11px] text-slate-400 ml-2">Kapasite: {data.capacityDays} iş günü × 8 saat = {data.capacityHours} saat</span>}
        <button onClick={() => setShowHolidays(s => !s)} className="ml-auto text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1">
          <CalendarOff size={13} /> Resmi Tatil Günleri ({holidays.length})
        </button>
      </div>

      {showHolidays && (
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resmi Tatil Günleri — kapasite hesabından düşülür</p>
          <div className="flex items-center gap-2">
            <input type="date" value={newHoliday} onChange={e => setNewHoliday(e.target.value)} className="input-glass text-sm" />
            <button onClick={addHoliday} disabled={!newHoliday || savingHolidays} className="btn-secondary text-xs flex items-center gap-1 disabled:opacity-50">
              {savingHolidays ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Ekle
            </button>
          </div>
          {holidays.length === 0 ? (
            <p className="text-[11px] text-slate-400">Henüz tanımlı resmi tatil yok.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {holidays.map(d => (
                <span key={d} className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
                  {new Date(d).toLocaleDateString('tr-TR')}
                  <button onClick={() => removeHoliday(d)} className="text-slate-400 hover:text-red-500"><X size={11} /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
      ) : !data || data.technicians.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-10">Aktif teknisyen yok.</p>
      ) : (
        <>
          <div className="glass-card rounded-2xl p-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Doluluk Oranı (%)</p>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 9 }} width={28} unit="%" />
                  <Tooltip />
                  <Bar dataKey="doluluk" name="Doluluk %" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-card rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/50 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-4 py-3">Teknisyen</th>
                  <th className="px-4 py-3">Açık İş</th>
                  <th className="px-4 py-3">Tamamlanan</th>
                  <th className="px-4 py-3">Çalışma Saati</th>
                  <th className="px-4 py-3">%Doluluk</th>
                  <th className="px-4 py-3">SLA Performansı</th>
                  {data.technicians.some(t => t.estimatedLaborCost !== undefined) && <th className="px-4 py-3">Maliyet</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.technicians.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">{t.name}</div>
                      {t.specialties.length > 0 && <div className="text-[10px] text-slate-400">{t.specialties.map(s => s.name).join(', ')}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{t.openCount}</td>
                    <td className="px-4 py-3 text-slate-600">{t.completedCount}</td>
                    <td className="px-4 py-3 text-slate-600">{t.totalHours}</td>
                    <td className="px-4 py-3">
                      {t.utilizationPct == null ? '—' : (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${t.utilizationPct >= 80 ? 'bg-emerald-100 text-emerald-700' : t.utilizationPct >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>%{t.utilizationPct}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {t.slaPerformancePct == null ? '—' : `%${t.slaPerformancePct} (${t.onTimeCount}/${t.onTimeCount + t.lateCount})`}
                    </td>
                    {data.technicians.some(x => x.estimatedLaborCost !== undefined) && (
                      <td className="px-4 py-3 text-slate-600">{t.estimatedLaborCost != null ? t.estimatedLaborCost.toLocaleString('tr-TR') : '—'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default UtilizationReport;

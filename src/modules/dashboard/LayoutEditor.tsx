import React, { useState } from 'react';
import { X, ChevronUp, ChevronDown, Save, Info, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { WK, WIDGET_META, WIDGET_TITLE, HORIZON_LABEL, HORIZON_COLOR, ROLE_DASHBOARD, DEFAULT_WIDGETS, ALL_WIDGET_KEYS } from './widgetCatalog';

interface Props {
  role?: string;
  initial: { key: WK; enabled: boolean }[];
  saving: boolean;
  onClose: () => void;
  onSave: (items: { key: WK; enabled: boolean }[]) => void;
}

const LayoutEditor: React.FC<Props> = ({ role, initial, saving, onClose, onSave }) => {
  const [items, setItems] = useState(initial);

  const toggle = (key: WK) => setItems(prev => prev.map(i => i.key === key ? { ...i, enabled: !i.enabled } : i));
  const move = (index: number, dir: -1 | 1) => setItems(prev => {
    const next = [...prev];
    const target = index + dir;
    if (target < 0 || target >= next.length) return prev;
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const resetToDefault = () => {
    const defaultOrder = ROLE_DASHBOARD[role || ''] || DEFAULT_WIDGETS;
    const rest = ALL_WIDGET_KEYS.filter(k => !defaultOrder.includes(k));
    setItems([...defaultOrder, ...rest].map(k => ({ key: k, enabled: defaultOrder.includes(k) })));
  };

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">Kokpitimi Düzenle</h3>
              <p className="text-xs text-slate-400 font-bold mt-0.5">Hangi kartları görmek istediğinizi seçin ve sıralayın — sadece sizin görünümünüzü değiştirir.</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 shrink-0"><X size={18} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
            {items.map((item, i) => {
              const meta = WIDGET_META[item.key];
              return (
                <div key={item.key} className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${item.enabled ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                  <input type="checkbox" checked={item.enabled} onChange={() => toggle(item.key)} className="w-4 h-4 shrink-0 accent-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-black text-slate-800 truncate">{WIDGET_TITLE[item.key]}</p>
                      <span title={meta.philosophy} className="shrink-0 cursor-help"><Info size={11} className="text-slate-300" /></span>
                      <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest shrink-0 ${HORIZON_COLOR[meta.horizon]}`}>{HORIZON_LABEL[meta.horizon]}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">{meta.philosophy}</p>
                  </div>
                  <div className="flex flex-col shrink-0">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20"><ChevronUp size={14} /></button>
                    <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20"><ChevronDown size={14} /></button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-6 border-t border-slate-100 flex items-center justify-between gap-3">
            <button onClick={resetToDefault} className="text-[10px] font-black text-slate-400 hover:text-slate-700 uppercase tracking-widest flex items-center gap-1.5">
              <RotateCcw size={12} /> Rol varsayılanına dön
            </button>
            <button onClick={() => onSave(items)} disabled={saving} className="btn-primary px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
              <Save size={14} /> {saving ? 'Kaydediliyor…' : 'Kaydet'}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LayoutEditor;

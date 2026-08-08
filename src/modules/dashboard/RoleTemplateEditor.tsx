import React, { useEffect, useState } from 'react';
import { GripVertical, Info, RotateCcw, Save, CheckCircle2, Loader2 } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { ROLE_LABELS } from '../../constants';
import { WK, WIDGET_META, WIDGET_TITLE, HORIZON_LABEL, HORIZON_COLOR, buildEditableLayout } from './widgetCatalog';
import { useDragReorder } from './useDragReorder';

// GM-only: kokpit (Dashboard) widget'larının rol bazlı varsayılan şablonunu
// düzenler — hardcode ROLE_DASHBOARD'ı (widgetCatalog.ts) tenant bazında
// override eder. Kullanıcının kendi kişisel "Kokpiti Düzenle" seçimi bundan
// bağımsız kalır (kayıtlıysa her zaman önceliklidir); bu ekran yalnız hiç
// kişiselleştirme yapmamış kullanıcıların gördüğü varsayılanı belirler.
const RoleTemplateEditor: React.FC = () => {
  const roles = Object.keys(ROLE_LABELS);
  const [templates, setTemplates] = useState<Record<string, WK[]>>({});
  const [selectedRole, setSelectedRole] = useState<string>(roles[0] || 'GENERAL_MANAGER');
  const [items, setItems] = useState<{ key: WK; enabled: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { dragIndex, onDragStart, onDragOver, onDragEnd } = useDragReorder(items, setItems);

  useEffect(() => {
    apiService.getDashboardRoleTemplates()
      .then(t => setTemplates((t || {}) as Record<string, WK[]>))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setItems(buildEditableLayout(selectedRole, null, templates[selectedRole] || null));
  }, [selectedRole, templates]);

  const toggle = (key: WK) => setItems(prev => prev.map(i => i.key === key ? { ...i, enabled: !i.enabled } : i));
  const isOverridden = Boolean(templates[selectedRole]?.length);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const widgets = items.filter(i => i.enabled).map(i => i.key);
      const next = await apiService.saveDashboardRoleTemplate(selectedRole, widgets);
      setTemplates(next as Record<string, WK[]>);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const resetToSystemDefault = async () => {
    setSaving(true);
    try {
      const next = await apiService.saveDashboardRoleTemplate(selectedRole, []);
      setTemplates(next as Record<string, WK[]>);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-xl font-bold text-slate-900">Kokpit Şablonları</h4>
        <p className="text-sm text-slate-500 mt-1">
          Her rolün Dashboard'a ilk girişte göreceği varsayılan kart seçimini ve sıralamasını belirleyin.
          Bir kullanıcı kendi "Kokpiti Düzenle" panelinden kişisel seçim yaparsa bu şablonun önüne geçer.
        </p>
      </div>

      <div className="glass-card p-6 rounded-2xl border border-slate-200/60">
        <div className="flex items-center gap-3 mb-5 flex-wrap">
          <label className="text-xs font-semibold text-slate-600 shrink-0">Rol</label>
          <select
            value={selectedRole}
            onChange={e => setSelectedRole(e.target.value)}
            className="input-glass text-sm flex-1 min-w-[220px]"
          >
            {roles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${isOverridden ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-500'}`}>
            {isOverridden ? '● Özelleştirilmiş' : '○ Sistem Varsayılanı'}
          </span>
        </div>

        {loading ? (
          <div className="text-sm text-slate-400 py-6 text-center">Yükleniyor…</div>
        ) : (
          <>
            <div className="space-y-2 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
              {items.map((item, i) => {
                const meta = WIDGET_META[item.key];
                return (
                  <div
                    key={item.key}
                    draggable
                    onDragStart={() => onDragStart(i)}
                    onDragOver={(e) => { e.preventDefault(); onDragOver(i); }}
                    onDragEnd={onDragEnd}
                    onDrop={(e) => e.preventDefault()}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${item.enabled ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'} ${dragIndex === i ? 'opacity-40 border-dashed border-emerald-400' : ''}`}
                  >
                    <span className="shrink-0 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 touch-none">
                      <GripVertical size={14} />
                    </span>
                    <input type="checkbox" checked={item.enabled} onChange={() => toggle(item.key)} className="w-4 h-4 shrink-0 accent-emerald-600" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-black text-slate-800 truncate">{WIDGET_TITLE[item.key]}</p>
                        <span title={meta.philosophy} className="shrink-0 cursor-help"><Info size={11} className="text-slate-300" /></span>
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest shrink-0 ${HORIZON_COLOR[meta.horizon]}`}>{HORIZON_LABEL[meta.horizon]}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">{meta.philosophy}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 mt-5 pt-5 border-t border-slate-100">
              <button
                onClick={resetToSystemDefault}
                disabled={saving || !isOverridden}
                className="text-[10px] font-black text-slate-400 hover:text-slate-700 uppercase tracking-widest flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <RotateCcw size={12} /> Sistem varsayılanına sıfırla
              </button>
              <div className="flex items-center gap-3">
                {saved && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Kaydedildi</span>}
                <button onClick={save} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Bu rol için kaydet
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default RoleTemplateEditor;

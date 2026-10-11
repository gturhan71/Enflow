import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, HardHat, Edit3, Trash2, X, Save } from 'lucide-react';
import { WorkSpecialty } from '../../types';
import { apiService } from '../../services/apiService';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkSpecialties } from '../../hooks/useEnflowQueries';

// Ayarlar → Uzmanlık Alanları (GM-only) — Profesyonel Hizmetler teknisyenlerinin
// uzmanlık etiketleri. Serbest metin DEĞİL, tenant bazlı yönetilebilir liste
// (ProductTaxonomyManagement.tsx ile aynı desen) — bkz. docs/PROFESYONEL_HIZMETLER_PLAN.md.
// Tenant'lar arası PAYLAŞILAN/global bir katalog YOK.
export const WorkSpecialtyManagement: React.FC = () => {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const specialtiesQ = useWorkSpecialties(currentUser?.tenantId ?? '');
  const specialties = (specialtiesQ.data ?? []) as WorkSpecialty[];
  const loading = specialtiesQ.isLoading;

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['taxonomy', 'work-specialties'] }); };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await apiService.createWorkSpecialty({ name: newName.trim() });
      setNewName('');
      refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Uzmanlık alanı eklenemedi.');
    } finally { setSaving(false); }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await apiService.updateWorkSpecialty(id, { name: editName.trim() });
      setEditingId(null);
      refresh();
    } finally { setSaving(false); }
  };

  const handleDelete = async (s: WorkSpecialty) => {
    if (!window.confirm(`"${s.name}" uzmanlık alanını silmek istediğinize emin misiniz?`)) return;
    setSaving(true);
    try {
      await apiService.deleteWorkSpecialty(s.id);
      refresh();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-xl font-bold text-slate-900 flex items-center gap-2"><HardHat className="w-5 h-5 text-primary" /> Uzmanlık Alanları</h4>
        <p className="text-sm text-slate-500 mt-1">
          Profesyonel Hizmetler teknisyenlerinin uzmanlık etiketleri — iş emri sevkiyatında teknisyen
          önerisi/filtresi için kullanılır. Bu liste yalnız sizin şirketinize özeldir.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400 py-8 text-center">Yükleniyor…</div>
      ) : (
        <div className="glass-card p-6 rounded-2xl border border-slate-200/60 max-w-lg">
          <div className="flex gap-2 mb-4">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Yeni uzmanlık alanı adı (ör. Elektrik)…"
              className="input-glass flex-1 text-sm"
            />
            <button onClick={handleCreate} disabled={!newName.trim() || saving} className="btn-primary px-4 text-sm rounded-xl disabled:opacity-50 flex items-center gap-1.5">
              <Plus size={14} /> Ekle
            </button>
          </div>

          <div className="space-y-1.5 max-h-96 overflow-y-auto custom-scrollbar">
            {specialties.length === 0 && <p className="text-xs text-slate-400 text-center py-6">Henüz uzmanlık alanı tanımlanmadı.</p>}
            {specialties.map(s => (
              <div key={s.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                {editingId === s.id ? (
                  <>
                    <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSaveEdit(s.id)}
                      className="input-glass flex-1 text-sm py-1.5" autoFocus />
                    <button onClick={() => handleSaveEdit(s.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg"><Save size={14} /></button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg"><X size={14} /></button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm font-semibold text-slate-700">{s.name}</span>
                    <button onClick={() => { setEditingId(s.id); setEditName(s.name); }} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit3 size={13} /></button>
                    <button onClick={() => handleDelete(s)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkSpecialtyManagement;

import type { Dispatch, SetStateAction } from 'react';
import { X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TodoTask, Unit, User } from '../../types';
import { TASK_ACTIONS } from './helpers';

export default function NewTaskModal({
  isOpen,
  onClose,
  units,
  users,
  newTask,
  setNewTask,
  taskAction,
  setTaskAction,
  items,
  composedTitleText,
  loading,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  units?: Unit[];
  users?: User[];
  newTask: Partial<TodoTask>;
  setNewTask: Dispatch<SetStateAction<Partial<TodoTask>>>;
  taskAction: string;
  setTaskAction: (v: string) => void;
  items: { id: string; name: string }[];
  composedTitleText: string;
  loading: boolean;
  onSubmit: () => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="glass-panel w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden bg-white flex flex-col"
          >
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Yeni Görev Ata</h4>
              <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-2xl transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">İlgili Modül</label>
                  <select
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none appearance-none"
                    value={newTask.relatedModule || 'GENERAL'}
                    onChange={(e) => { setNewTask({...newTask, relatedModule: e.target.value, relatedItemId: ''}); setTaskAction(''); }}
                  >
                    <option value="GENERAL">Genel Görev</option>
                    <option value="PROJECT">Proje Yönetimi</option>
                    <option value="OPPORTUNITY">CRM & Fırsat</option>
                    <option value="CONTRACT">Sözleşme</option>
                    <option value="PROCUREMENT">Satın Alma</option>
                    <option value="LEGAL">Hukuk / Şirket Avukatı</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">İlgili Birim</label>
                  <select
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none"
                    value={newTask.unitId || ''}
                    onChange={(e) => setNewTask({...newTask, unitId: e.target.value, assignedToUserId: undefined})}
                  >
                    <option value="">Seçiniz</option>
                    {units?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              {/* İşlevsel görev tanımı — GENEL dışı modüllerde ZORUNLU */}
              {(newTask.relatedModule && newTask.relatedModule !== 'GENERAL') ? (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">İşlevsel Görev *</label>
                    <select
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none"
                      value={taskAction}
                      onChange={(e) => setTaskAction(e.target.value)}
                    >
                      <option value="">Seçiniz (örn. BoM hazırla)</option>
                      {(TASK_ACTIONS[newTask.relatedModule] || []).map(a => (
                        <option key={a.key} value={a.key}>{a.label}</option>
                      ))}
                    </select>
                  </div>
                  {items.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">İlgili Kayıt *</label>
                      <select
                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none"
                        value={newTask.relatedItemId || ''}
                        onChange={(e) => setNewTask({...newTask, relatedItemId: e.target.value})}
                      >
                        <option value="">{newTask.relatedModule === 'OPPORTUNITY' ? 'Fırsat seçiniz' : 'Proje seçiniz'}</option>
                        {items.map(i => (
                          <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {composedTitleText && (
                    <div className="text-[12px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-2xl px-5 py-3">
                      Görev: {composedTitleText}
                    </div>
                  )}
                </>
              ) : (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Görev Başlığı</label>
                  <input
                    type="text"
                    placeholder="Örn: Haftalık Satış Raporu"
                    value={newTask.title || ''}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none focus:ring-4 focus:ring-indigo-500/10"
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Kime (Kişi) — boş: birim yöneticisine</label>
                <select
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none disabled:opacity-50"
                  value={newTask.assignedToUserId || ''}
                  disabled={!newTask.unitId}
                  onChange={(e) => setNewTask({...newTask, assignedToUserId: e.target.value || undefined})}
                >
                  <option value="">Birim yöneticisi (varsayılan)</option>
                  {users?.filter(u => u.unitId === newTask.unitId).map(u => (
                    <option key={u.id} value={u.id}>{u.name} — {u.role}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Öncelik</label>
                  <select
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none"
                    onChange={(e) => setNewTask({...newTask, priority: e.target.value as TodoTask['priority']})}
                  >
                    <option value="LOW">Düşük</option>
                    <option value="MEDIUM">Orta</option>
                    <option value="HIGH">Yüksek</option>
                    <option value="URGENT">Acil</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Termin Tarihi</label>
                  <input
                    type="date"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none"
                    onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Görev Detayı</label>
                <textarea
                  rows={3}
                  placeholder="Görev ile ilgili detaylı açıklama..."
                  className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl text-sm font-bold outline-none resize-none"
                  onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                />
              </div>
            </div>
            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-8 py-3 text-sm font-black text-slate-500 uppercase tracking-widest"
              >
                İptal
              </button>
              <button
                onClick={onSubmit}
                disabled={loading}
                className="bg-indigo-600 text-white px-10 py-4 rounded-3xl text-sm font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all uppercase tracking-widest flex items-center gap-2"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : 'Görevi Ata'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

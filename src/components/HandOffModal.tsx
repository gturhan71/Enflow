import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, ArrowRight, Loader2 } from 'lucide-react';
import { apiService } from '../services/apiService';

interface HandOffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { toUnit: string; toUser: { id: string; name: string }; note: string }) => void;
  itemTitle: string;
}

interface UnitLite { id: string; name: string }
interface UserLite { id: string; name: string; unitId?: string | null }

export const HandOffModal: React.FC<HandOffModalProps> = ({ isOpen, onClose, onConfirm, itemTitle }) => {
  const [units, setUnits] = useState<UnitLite[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [toUnit, setToUnit] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [note, setNote] = useState('');

  // Açılışta gerçek (tenant-scoped) birim + kullanıcıları çek — sahte demo veri YOK.
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    Promise.all([apiService.getUnits(), apiService.getUsers()])
      .then(([u, us]) => {
        if (!active) return;
        const unitList = (u as UnitLite[]) || [];
        const userList = (us as UserLite[]) || [];
        setUnits(unitList);
        setUsers(userList);
        setToUnit((prev) => prev || unitList[0]?.id || '');
      })
      .catch(() => { if (active) { setUnits([]); setUsers([]); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen]);

  // Seçili birime göre kullanıcıları filtrele; seçili kullanıcı geçersizse ilkine düş.
  const unitUsers = toUnit ? users.filter((u) => u.unitId === toUnit) : users;
  useEffect(() => {
    if (unitUsers.length && !unitUsers.some((u) => u.id === toUserId)) setToUserId(unitUsers[0].id);
    if (!unitUsers.length) setToUserId('');
  }, [toUnit, users]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const selectedUser = users.find((u) => u.id === toUserId);
  const canConfirm = !!toUnit && !!selectedUser;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-panel w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h4 className="text-xl font-bold text-white italic uppercase tracking-tighter">İş Akışı Aktarımı</h4>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white">
            <X size={20} />
          </button>
        </div>
        <div className="p-8 space-y-6">
          <p className="text-sm text-slate-400">
            <span className="font-bold text-white">{itemTitle}</span> kaydını aşağıdaki birime ve personele aktarmak üzeresiniz.
          </p>

          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-6"><Loader2 size={16} className="animate-spin" /> Birim ve kullanıcılar yükleniyor…</div>
          ) : units.length === 0 ? (
            <div className="text-sm text-amber-300 py-6">Aktarılacak birim bulunamadı. Önce Ayarlar → Birimler'den birim tanımlayın.</div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Hedef Birim</label>
                <select
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white outline-none focus:border-primary"
                  onChange={(e) => setToUnit(e.target.value)}
                  value={toUnit}
                >
                  {units.map((u) => <option key={u.id} value={u.id} className="text-slate-900">{u.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Hedef Personel</label>
                <select
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white outline-none focus:border-primary disabled:opacity-50"
                  onChange={(e) => setToUserId(e.target.value)}
                  value={toUserId}
                  disabled={unitUsers.length === 0}
                >
                  {unitUsers.length === 0
                    ? <option value="" className="text-slate-900">Bu birimde kullanıcı yok</option>
                    : unitUsers.map((u) => <option key={u.id} value={u.id} className="text-slate-900">{u.name}</option>)}
                </select>
              </div>
              <textarea
                rows={3}
                placeholder="Aktarım notu..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white outline-none focus:border-primary resize-none"
                onChange={(e) => setNote(e.target.value)}
                value={note}
              />
            </div>
          )}
        </div>
        <div className="p-6 bg-white/5 border-t border-white/10 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-400 hover:text-white">İptal</button>
          <button
            onClick={() => selectedUser && onConfirm({ toUnit, toUser: { id: selectedUser.id, name: selectedUser.name }, note })}
            disabled={!canConfirm}
            className="px-8 py-2 bg-primary text-white rounded-xl text-sm font-bold shadow-lg hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-40"
          >
            Aktar <ArrowRight size={16} />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

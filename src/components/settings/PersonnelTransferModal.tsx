import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Loader2, ArrowRight, AlertTriangle } from 'lucide-react';
import { apiService } from '../../services/apiService';
import { User, Unit, OwnedItemsResult } from '../../types';
import { ROLE_LABELS } from '../../constants';

export interface PersonnelTransferPayload {
  toUserId: string;
  categoryKeys: string[];
  hardDelete: boolean;
}

interface PersonnelTransferModalProps {
  fromUser: User;
  users: User[];
  units: Unit[];
  /** 'mandatory' — silme/pasifleştirme öncesi zorunlu gate (kapatılamaz, tüm aktif
   *  kategoriler sabit seçili). 'optional' — terfi sonrası isteğe bağlı devir. */
  mode: 'optional' | 'mandatory';
  saving?: boolean;
  onClose: () => void;
  onConfirm: (payload: PersonnelTransferPayload) => void;
}

export const PersonnelTransferModal: React.FC<PersonnelTransferModalProps> = ({
  fromUser, users, units, mode, saving, onClose, onConfirm,
}) => {
  const [owned, setOwned] = useState<OwnedItemsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [toUnit, setToUnit] = useState('');
  const [toUserId, setToUserId] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [hardDelete, setHardDelete] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiService.getOwnedItems(fromUser.id)
      .then((data: OwnedItemsResult) => {
        if (!active) return;
        setOwned(data);
        if (mode === 'mandatory') {
          setSelectedKeys(new Set(data.categories.filter((c) => c.count > 0).map((c) => c.key)));
        }
      })
      .catch(() => { if (active) setOwned(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fromUser.id, mode]);

  const candidateUsers = users.filter((u) => u.id !== fromUser.id && u.status === 'ACTIVE');
  const unitUsers = toUnit ? candidateUsers.filter((u) => u.unitId === toUnit) : candidateUsers;
  useEffect(() => {
    if (unitUsers.length && !unitUsers.some((u) => u.id === toUserId)) setToUserId(unitUsers[0].id);
    if (!unitUsers.length) setToUserId('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toUnit, users]);

  const toggleKey = (key: string) => {
    if (mode === 'mandatory') return; // mandatory'de aktif kategoriler zorunlu, kapatılamaz
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const activeCategories = owned?.categories.filter((c) => c.count > 0) || [];
  const canConfirm = !!toUserId && (mode === 'mandatory' || selectedKeys.size > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-panel w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden bg-white"
      >
        <div className="p-6 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h4 className="text-xl font-bold text-slate-900">
              {mode === 'mandatory' ? 'İş Devri Gerekli' : 'İş Kayıtlarını Devret'}
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              <span className="font-bold text-slate-600">{fromUser.name}</span> ({ROLE_LABELS[fromUser.role] || fromUser.role})
            </p>
          </div>
          {mode === 'optional' && (
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400">
              <X size={20} />
            </button>
          )}
        </div>

        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
          {mode === 'mandatory' && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-700">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              Bu kullanıcının aktif iş kayıtları var — devam etmek için hepsi bir hedef kullanıcıya devredilmeli.
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-6">
              <Loader2 size={16} className="animate-spin" /> Sahip olunan kayıtlar taranıyor…
            </div>
          ) : activeCategories.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">Aktif sahiplik kaydı bulunamadı.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Devredilecek Kayıtlar</p>
              {activeCategories.map((c) => (
                <label key={c.key} className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={mode === 'mandatory' || selectedKeys.has(c.key)}
                    onChange={() => toggleKey(c.key)}
                    disabled={mode === 'mandatory'}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-700">{c.label}</span>
                      <span className="text-xs font-black text-primary">{c.count}</span>
                    </div>
                    {c.sample.length > 0 && (
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {c.sample.map((s) => s.label).join(', ')}{c.count > c.sample.length ? ', …' : ''}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="space-y-3 pt-2 border-t border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Hedef Kullanıcı</p>
            <select value={toUnit} onChange={(e) => setToUnit(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 text-sm">
              <option value="">Tüm Birimler</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select value={toUserId} onChange={(e) => setToUserId(e.target.value)} disabled={unitUsers.length === 0} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 text-sm disabled:opacity-50">
              {unitUsers.length === 0
                ? <option value="">Uygun aktif kullanıcı yok</option>
                : unitUsers.map((u) => <option key={u.id} value={u.id}>{u.name} — {ROLE_LABELS[u.role] || u.role}</option>)}
            </select>
          </div>

          {mode === 'mandatory' && (
            <label className={`flex items-start gap-3 p-3 rounded-2xl border ${owned?.hardDeleteBlocked ? 'border-slate-100 opacity-60' : 'border-red-200 bg-red-50'}`}>
              <input type="checkbox" checked={hardDelete} disabled={owned?.hardDeleteBlocked} onChange={(e) => setHardDelete(e.target.checked)} className="mt-0.5" />
              <div>
                <span className="text-sm font-bold text-red-700">Kalıcı olarak sil (geri alınamaz)</span>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {owned?.hardDeleteBlocked
                    ? `Bu kullanıcı ${owned.createdOpportunityCount} fırsatın oluşturucusu — kalıcı silinemez, pasifleştirilecek.`
                    : 'İşaretlenmezse kullanıcı yalnızca pasifleştirilir (geri alınabilir).'}
                </p>
              </div>
            </label>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-500">
            {mode === 'mandatory' ? 'Vazgeç' : 'Atla'}
          </button>
          <button
            onClick={() => onConfirm({
              toUserId,
              categoryKeys: mode === 'mandatory' ? activeCategories.map((c) => c.key) : Array.from(selectedKeys),
              hardDelete,
            })}
            disabled={!canConfirm || saving}
            className="px-8 py-2 bg-primary text-white rounded-xl text-sm font-bold shadow-lg hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-40"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <>Onayla <ArrowRight size={16} /></>}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default PersonnelTransferModal;

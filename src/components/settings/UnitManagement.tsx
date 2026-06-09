import React, { useState } from 'react';
import { Plus, Building, Edit3, Trash2, X, Users, Save, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { Unit, User } from '../../types';
import { apiService } from '../../services/apiService';

interface UnitManagementProps {
  units: Unit[];
  setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
  activeTenantId: string;
  users: User[];
}

export const UnitManagement = ({
  units,
  setUnits,
  activeTenantId,
  users
}: UnitManagementProps) => {
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    
    if (!name) return;

    const unitData = {
      name,
      description,
      tenantId: activeTenantId
    };

    setLoading(true);
    try {
      if (editingUnit) {
        // Edit unit endpoint or similar, if not supported fallback to create
        // The original code only implemented createUnit: apiService.createUnit(unitData)
        const savedUnit = await apiService.createUnit(unitData);
        setUnits([...units, savedUnit]);
      } else {
        const savedUnit = await apiService.createUnit(unitData);
        setUnits([...units, savedUnit]);
      }
      setShowUnitModal(false);
      setEditingUnit(null);
      alert('Birim başarıyla oluşturuldu.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Birim kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUnit = async (id: string, transferId?: string) => {
    setLoading(true);
    try {
      await apiService.deleteUnit(id, transferId);
      setUnits(units.filter(u => u.id !== id));
      setShowTransferModal(false);
      setUnitToDelete(null);
      setTransferTargetId('');
      alert('Birim ve kullanıcı transferi başarıyla tamamlandı.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('TRANSFER_REQUIRED')) {
        const unit = units.find(u => u.id === id);
        if (unit) {
          setUnitToDelete(unit);
          setShowTransferModal(true);
        }
      } else {
        alert(msg || 'Birim silinemedi.');
      }
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteUnit = (unit: Unit) => {
    if (window.confirm(`${unit.name} birimini silmek istediğinize emin misiniz?`)) {
      handleDeleteUnit(unit.id);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h4 className="text-xl font-bold text-slate-900">Kurumsal Birimler</h4>
        <button 
          onClick={() => { setEditingUnit(null); setShowUnitModal(true); }} 
          className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
        >
          <Plus size={18} /> Yeni Birim Ekle
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {units.map(unit => (
          <div key={unit.id} className="glass-panel p-6 rounded-3xl flex flex-col group border-slate-100 hover:border-indigo-300 transition-all bg-white shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                <Building size={24} />
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => { setEditingUnit(unit); setShowUnitModal(true); }} 
                  className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg"
                >
                  <Edit3 size={16} />
                </button>
                <button 
                  onClick={() => confirmDeleteUnit(unit)} 
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <h5 className="font-bold text-slate-900 mb-1">{unit.name}</h5>
            <p className="text-sm text-slate-500 mb-4">{unit.description || 'Açıklama girilmedi.'}</p>
          </div>
        ))}
      </div>

      {/* Unit Modal */}
      <AnimatePresence>
        {showUnitModal && (
          <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden bg-white p-8"
            >
              <h4 className="text-xl font-bold text-slate-900 mb-6">
                {editingUnit ? 'Birimi Düzenle' : 'Yeni Birim Oluştur'}
              </h4>
              <form onSubmit={handleSaveUnit} className="space-y-4">
                <input 
                  name="name" 
                  placeholder="Birim Adı" 
                  defaultValue={editingUnit?.name || ''}
                  required 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500" 
                />
                <textarea 
                  name="description" 
                  placeholder="Birim Açıklaması" 
                  defaultValue={editingUnit?.description || ''}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 resize-none" 
                />
                <div className="flex justify-end gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowUnitModal(false)} 
                    className="px-6 py-2 text-sm font-bold text-slate-500"
                  >
                    İptal
                  </button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="bg-primary text-white px-8 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2"
                  >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    Kaydet
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Transfer Modal */}
      <AnimatePresence>
        {showTransferModal && unitToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="glass-panel w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden bg-white p-10 border border-white/50"
            >
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center mb-4">
                  <Users size={32} />
                </div>
                <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Kullanıcıları Taşı</h4>
                <p className="text-sm text-slate-500 font-medium mt-2">
                  <span className="font-bold text-slate-900">{unitToDelete.name}</span> biriminde kayıtlı kullanıcılar var. 
                  Bu kullanıcıları silmeden önce hangi birime aktarmak istersiniz?
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hedef Birim</label>
                  <select 
                    value={transferTargetId} 
                    onChange={(e) => setTransferTargetId(e.target.value)}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all font-bold text-slate-700 appearance-none"
                  >
                    <option value="">Lütfen Birim Seçin...</option>
                    {units.filter(u => u.id !== unitToDelete.id).map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-8">
                <button
                  onClick={() => handleDeleteUnit(unitToDelete.id, transferTargetId)}
                  disabled={!transferTargetId || loading}
                  className="w-full bg-primary text-white py-4 rounded-2xl text-xs font-black shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-3 uppercase tracking-widest disabled:opacity-50"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Kullanıcıları Taşı ve Birimi Sil
                </button>
                <button 
                  onClick={() => { setShowTransferModal(false); setUnitToDelete(null); }} 
                  className="w-full py-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                >
                  Vazgeç
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

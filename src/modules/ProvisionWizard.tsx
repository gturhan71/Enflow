import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Building, Users, ShieldCheck, ArrowRight, ArrowLeft, Check, Plus, Trash2, Wand2 } from 'lucide-react';
import { Unit, User } from '../types';

interface ProvisionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  existingUnits: Unit[];
  onComplete: (unit: Partial<Unit>, users: Partial<User>[]) => void;
}

const ProvisionWizard = ({ isOpen, onClose, existingUnits, onComplete }: ProvisionWizardProps) => {
  const [step, setStep] = useState(1);
  
  // Step 1 State
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [unitName, setUnitName] = useState('');
  const [unitDescription, setUnitDescription] = useState('');
  
  // Step 2 State
  const [newUsers, setNewUsers] = useState<Partial<User>[]>([
    { name: '', email: '', role: 'USER', status: 'ACTIVE' }
  ]);

  if (!isOpen) return null;

  const handleAddUser = () => {
    setNewUsers([...newUsers, { name: '', email: '', role: 'USER', status: 'ACTIVE' }]);
  };

  const handleRemoveUser = (index: number) => {
    setNewUsers(newUsers.filter((_, i) => i !== index));
  };

  const handleUserChange = (index: number, field: keyof User, value: string) => {
    const updated = [...newUsers];
    updated[index] = { ...updated[index], [field]: value };
    setNewUsers(updated);
  };

  const handleComplete = () => {
    const unitData: Partial<Unit> = selectedUnitId === 'NEW' 
      ? { name: unitName, description: unitDescription }
      : { id: selectedUnitId, name: existingUnits.find(u => u.id === selectedUnitId)?.name };

    // Filter out empty users
    const validUsers = newUsers.filter(u => u.name?.trim() && u.email?.trim());
    onComplete(unitData, validUsers);
    
    // Reset state
    setStep(1);
    setSelectedUnitId('');
    setUnitName('');
    setUnitDescription('');
    setNewUsers([{ name: '', email: '', role: 'USER', status: 'ACTIVE' }]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="glass-panel rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center">
              <Wand2 size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Hızlı Provizyon Sihirbazı</h3>
              <p className="text-xs text-slate-500">Yeni birim ve kullanıcıları tek seferde oluşturun</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors bg-white p-2 rounded-full shadow-sm border border-slate-100">
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-8 pt-6">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-100 rounded-full -z-10">
              <motion.div 
                className="h-full bg-indigo-600 rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
                transition={{ duration: 0.3 }}
              />
            </div>
            
            {[
              { num: 1, label: 'Birim Bilgileri', icon: Building },
              { num: 2, label: 'Kullanıcılar', icon: Users },
              { num: 3, label: 'Onay', icon: ShieldCheck }
            ].map((s) => (
              <div key={s.num} className="flex flex-col items-center gap-2 bg-white px-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                  step >= s.num ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-100 text-slate-400'
                }`}>
                  {step > s.num ? <Check size={18} /> : <s.icon size={18} />}
                </div>
                <span className={`text-xs font-bold ${step >= s.num ? 'text-slate-900' : 'text-slate-400'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto flex-1">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Birim Seçimi</label>
                  <select
                    value={selectedUnitId}
                    onChange={(e) => setSelectedUnitId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all"
                  >
                    <option value="" disabled>-- Birim Seçin veya Oluşturun --</option>
                    {existingUnits.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                    <option value="NEW" className="font-bold text-indigo-600">+ Yeni Birim Oluştur</option>
                  </select>
                </div>

                {selectedUnitId === 'NEW' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-6 overflow-hidden"
                  >
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Yeni Birim Adı</label>
                      <input 
                        type="text" 
                        value={unitName}
                        onChange={(e) => setUnitName(e.target.value)}
                        placeholder="Örn: Yazılım Geliştirme, İnsan Kaynakları..."
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">Birim Açıklaması</label>
                      <textarea 
                        rows={4}
                        value={unitDescription}
                        onChange={(e) => setUnitDescription(e.target.value)}
                        placeholder="Bu birimin görev ve sorumluluklarını kısaca açıklayın..."
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all resize-none"
                      />
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-900">Birim Kullanıcıları</h4>
                  <button 
                    onClick={handleAddUser}
                    className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors flex items-center gap-1"
                  >
                    <Plus size={14} /> Kullanıcı Ekle
                  </button>
                </div>

                <div className="space-y-3">
                  {newUsers.map((user, idx) => (
                    <div key={idx} className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl relative group">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ad Soyad</label>
                          <input 
                            type="text" 
                            value={user.name}
                            onChange={(e) => handleUserChange(idx, 'name', e.target.value)}
                            placeholder="Ad Soyad"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">E-posta</label>
                          <input 
                            type="email" 
                            value={user.email}
                            onChange={(e) => handleUserChange(idx, 'email', e.target.value)}
                            placeholder="ornek@sirket.com"
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Rol</label>
                          <select 
                            value={user.role}
                            onChange={(e) => handleUserChange(idx, 'role', e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                          >
                            <option value="USER">Kullanıcı</option>
                            <option value="MANAGER">Yönetici</option>
                            <option value="ADMIN">Sistem Yöneticisi</option>
                          </select>
                        </div>
                      </div>
                      {newUsers.length > 1 && (
                        <button 
                          onClick={() => handleRemoveUser(idx)}
                          className="mt-5 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 text-center">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ShieldCheck size={32} />
                  </div>
                  <h4 className="text-lg font-bold text-slate-900 mb-2">Her Şey Hazır!</h4>
                  <p className="text-sm text-slate-600">
                    Aşağıdaki özet bilgileri kontrol edip provizyonlama işlemini tamamlayabilirsiniz.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                    <h5 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Building size={18} className="text-indigo-600" />
                      {selectedUnitId === 'NEW' ? 'Oluşturulacak Birim' : 'Seçilen Birim'}
                    </h5>
                    <p className="text-sm font-bold text-slate-900">
                      {selectedUnitId === 'NEW' ? (unitName || 'İsimsiz Birim') : (existingUnits.find(u => u.id === selectedUnitId)?.name || '')}
                    </p>
                    {selectedUnitId === 'NEW' && (
                      <p className="text-xs text-slate-500 mt-1">{unitDescription || 'Açıklama girilmedi.'}</p>
                    )}
                  </div>
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                    <h5 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <Users size={18} className="text-indigo-600" />
                      Eklenecek Kullanıcılar
                    </h5>
                    <div className="space-y-2">
                      {newUsers.filter(u => u.name?.trim()).map((u, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-700">{u.name}</span>
                          <span className="text-xs font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-md">{u.role}</span>
                        </div>
                      ))}
                      {newUsers.filter(u => u.name?.trim()).length === 0 && (
                        <p className="text-xs text-slate-500 italic">Kullanıcı eklenmedi.</p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <button 
            onClick={() => setStep(Math.max(1, step - 1))}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
              step === 1 ? 'opacity-0 pointer-events-none' : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <ArrowLeft size={18} /> Geri
          </button>
          
          {step < 3 ? (
            <button 
              onClick={() => setStep(Math.min(3, step + 1))}
              disabled={step === 1 && (selectedUnitId === '' || (selectedUnitId === 'NEW' && !unitName.trim()))}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              İleri <ArrowRight size={18} />
            </button>
          ) : (
            <button 
              onClick={handleComplete}
              className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all flex items-center gap-2"
            >
              <Check size={18} /> Provizyonu Tamamla
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ProvisionWizard;

import React, { useState } from 'react';
import { 
  Building, 
  Users, 
  Plus, 
  ShieldCheck, 
  Settings, 
  Trash2, 
  Edit3, 
  Save, 
  X,
  Mail,
  Smartphone,
  ChevronRight,
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { NAV_ITEMS } from '../constants';
import { 
  Unit, 
  User, 
  NextcloudConfig, 
  ExchangeConfig, 
  WhatsAppConfig,
  UserRole
} from '../types';
import IntegrationWizard from './IntegrationWizard';
import WorkflowBuilder from './WorkflowBuilder';
import { nextcloudService } from '../services/nextcloudService';
import { exchangeService } from '../services/exchangeService';
import { whatsappService } from '../services/whatsappService';
import { useAuth } from '../contexts/AuthContext';

interface SettingsModuleProps {
  companyLogo: string | null;
  setCompanyLogo: (logo: string | null) => void;
  activeSubTab?: string;
  units: Unit[];
  setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

const SettingsModule = ({ 
  companyLogo, 
  setCompanyLogo, 
  activeSubTab = 'company',
  units,
  setUnits,
  users,
  setUsers
}: SettingsModuleProps) => {
  const { currentUser, setCurrentUser } = useAuth();
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);

  const [ncConfig] = useState<NextcloudConfig>(nextcloudService.getConfig());
  const [exConfig] = useState<ExchangeConfig>(exchangeService.getConfig());
  const [waConfig] = useState<WhatsAppConfig>(whatsappService.getConfig());

  // --- HANDLERS ---
  const handleSaveUnit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const newUnit: Unit = {
      id: editingUnit?.id || `unit-${Date.now()}`,
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      managerId: formData.get('managerId') as string,
    };

    if (editingUnit) {
      setUnits(units.map(u => u.id === editingUnit.id ? newUnit : u));
    } else {
      setUnits([...units, newUnit]);
    }
    setShowUnitModal(false);
    setEditingUnit(null);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const userData = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      role: formData.get('role') as UserRole,
      unitId: formData.get('unitId') as string,
      permissions: ['DASHBOARD_VIEW']
    };

    try {
      const savedUser = await apiService.createUser(userData);
      // SQLite permissions are stringified, frontend expects array. 
      // apiService or backend handles this, here we ensure frontend consistency.
      const formattedUser = {
        ...savedUser,
        permissions: typeof savedUser.permissions === 'string' ? JSON.parse(savedUser.permissions) : savedUser.permissions
      };
      setUsers([...users, formattedUser]);
      setShowUserModal(false);
      setEditingUser(null);
      alert('Kullanıcı başarıyla oluşturuldu ve sisteme kaydedildi.');
    } catch (err: any) {
      alert(err.message || 'Kullanıcı kaydedilemedi.');
    }
  };

  const togglePermission = (permCode: string) => {
    const hasPerm = currentUser.permissions.includes(permCode);
    let newPermissions;
    if (hasPerm) {
      newPermissions = currentUser.permissions.filter((p: string) => p !== permCode);
    } else {
      newPermissions = [...currentUser.permissions, permCode];
    }
    setCurrentUser({ ...currentUser, permissions: newPermissions });
  };

  // --- RENDERERS ---
  const renderUnits = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-xl font-bold text-slate-900">Kurumsal Birimler</h4>
        <button 
          onClick={() => { setEditingUnit(null); setShowUnitModal(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
        >
          <Plus size={18} /> Yeni Birim Ekle
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {units.map(unit => (
          <div key={unit.id} className="glass-panel p-6 rounded-3xl flex flex-col group border-slate-100 hover:border-indigo-300 transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                <Building size={24} />
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => { setEditingUnit(unit); setShowUnitModal(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit3 size={16} /></button>
                <button onClick={() => setUnits(units.filter(u => u.id !== unit.id))} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
              </div>
            </div>
            <h5 className="font-bold text-slate-900 mb-1">{unit.name}</h5>
            <p className="text-sm text-slate-500 mb-4">{unit.description || 'Açıklama girilmedi.'}</p>
            <div className="pt-4 border-t border-slate-50 mt-auto flex items-center justify-between text-xs font-bold text-slate-400">
              <span>PERSONEL: {users.filter(u => u.unitId === unit.id).length}</span>
              <span className="text-indigo-600">YÖNETİCİ: {users.find(u => u.id === unit.managerId)?.name || 'Atanmadı'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderUsers = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="text-xl font-bold text-slate-900">Sistem Kullanıcıları</h4>
        <button 
          onClick={() => { setEditingUser(null); setShowUserModal(true); }}
          className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
        >
          <UserPlus size={18} /> Yeni Kullanıcı
        </button>
      </div>
      <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">İsim / E-posta</th>
              <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">Rol</th>
              <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">Birim</th>
              <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">Durum</th>
              <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900">{user.name}</span>
                    <span className="text-xs text-slate-400">{user.email}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase">{user.role}</span>
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {units.find(u => u.id === user.unitId)?.name || '-'}
                </td>
                <td className="px-6 py-4">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-2"></span>
                  <span className="text-xs font-medium text-slate-600">Aktif</span>
                </td>
                <td className="px-6 py-4 text-right flex justify-end gap-2">
                  <button onClick={() => { setEditingUser(user); setShowUserModal(true); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit3 size={16} /></button>
                  <button onClick={() => setUsers(users.filter(u => u.id !== user.id))} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Sistem Yapılandırması</h3>
          <p className="text-slate-500">Organizasyon yapısı, kullanıcılar ve birim bazlı yetkilendirme.</p>
        </div>
      </div>

      <div className="flex-1">
        {activeSubTab === 'company' && (
          <div className="max-w-2xl bg-white border border-slate-100 rounded-3xl p-8 space-y-8 shadow-sm">
             <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                {companyLogo ? (
                  <div className="relative group">
                    <img src={companyLogo} alt="Logo" className="h-24 w-auto mb-4 object-contain" />
                    <button onClick={() => setCompanyLogo(null)} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={12} /></button>
                  </div>
                ) : (
                  <Building size={48} className="text-slate-300 mb-4" />
                )}
                <h4 className="font-bold text-slate-900">Kurumsal Logo</h4>
                <p className="text-sm text-slate-500 mb-6 text-center">Tüm evraklarda ve PDF tekliflerde kullanılacaktır.</p>
                <input type="file" id="logo-upload" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (ev) => setCompanyLogo(ev.target?.result as string);
                    reader.readAsDataURL(file);
                  }
                }} />
                <label htmlFor="logo-upload" className="bg-white border border-slate-200 px-6 py-2 rounded-xl text-sm font-bold cursor-pointer hover:bg-slate-50 shadow-sm transition-all">Logo Yükle</label>
             </div>
          </div>
        )}

        {activeSubTab === 'units' && renderUnits()}
        {activeSubTab === 'users' && renderUsers()}
        {activeSubTab === 'workflow' && <WorkflowBuilder units={units} />}

        {activeSubTab === 'permissions' && (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl flex items-start gap-4 mb-8">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><ShieldCheck size={24} /></div>
              <div>
                <h5 className="font-bold text-amber-900">Yetkilendirme Matrisi</h5>
                <p className="text-sm text-amber-700">Gökhan Turhan (Admin) için yetkileri anlık olarak simüle edin.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {NAV_ITEMS.map((item) => (
                <div key={item.id} className="glass-panel p-6 rounded-3xl flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><item.icon size={20} /></div>
                      <h4 className="font-bold text-slate-900">{item.label}</h4>
                    </div>
                    <div onClick={() => togglePermission(item.requiredPermission)} className={cn("w-12 h-6 rounded-full relative cursor-pointer transition-colors shadow-inner", currentUser.permissions.includes(item.requiredPermission) ? "bg-emerald-500" : "bg-slate-300")}>
                      <div className={cn("absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm", currentUser.permissions.includes(item.requiredPermission) ? "right-1" : "left-1")} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSubTab === 'integrations' && <IntegrationWizard ncConfig={ncConfig} exConfig={exConfig} waConfig={waConfig} />}
      </div>

      {/* Unit Modal */}
      <AnimatePresence>
        {showUnitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden bg-white p-8">
              <h4 className="text-xl font-bold text-slate-900 mb-6">{editingUnit ? 'Birimi Düzenle' : 'Yeni Birim Oluştur'}</h4>
              <form onSubmit={handleSaveUnit} className="space-y-4">
                <input name="name" defaultValue={editingUnit?.name} placeholder="Birim Adı (örn: Lojistik)" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500" />
                <textarea name="description" defaultValue={editingUnit?.description} placeholder="Birim Açıklaması" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 resize-none" />
                <select name="managerId" defaultValue={editingUnit?.managerId} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500">
                  <option value="">Birim Yöneticisi Seçin</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowUnitModal(false)} className="px-6 py-2 text-sm font-bold text-slate-500">İptal</button>
                  <button type="submit" className="bg-indigo-600 text-white px-8 py-2 rounded-xl text-sm font-bold">Kaydet</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Modal */}
      <AnimatePresence>
        {showUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden bg-white p-8">
              <h4 className="text-xl font-bold text-slate-900 mb-6">{editingUser ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı Oluştur'}</h4>
              <form onSubmit={handleSaveUser} className="space-y-4">
                <input name="name" defaultValue={editingUser?.name} placeholder="Tam İsim" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500" />
                <input name="email" defaultValue={editingUser?.email} type="email" placeholder="E-posta Adresi" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500" />
                <select name="role" defaultValue={editingUser?.role} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500">
                  <option value="SALES_REP">Satış Temsilcisi</option>
                  <option value="PRESALES_ENG">Presales Mühendisi</option>
                  <option value="SALES_SUPPORT">Satış Destek</option>
                  <option value="PROCUREMENT_MGR">Satın Alma Müdürü</option>
                  <option value="UNIT_MANAGER">Birim Yöneticisi</option>
                  <option value="GENERAL_MANAGER">Genel Müdür</option>
                </select>
                <select name="unitId" defaultValue={editingUser?.unitId} required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500">
                  <option value="">Birim Seçin</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowUserModal(false)} className="px-6 py-2 text-sm font-bold text-slate-500">İptal</button>
                  <button type="submit" className="bg-indigo-600 text-white px-8 py-2 rounded-xl text-sm font-bold">Kaydet</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SettingsModule;

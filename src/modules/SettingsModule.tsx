import React, { useState, useEffect } from 'react';
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
  UserPlus,
  Loader2,
  Building2
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
import { apiService } from '../services/apiService';

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
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [usage, setUsage] = useState<any[]>([]);

  useEffect(() => {
    fetchTenants();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'subscription') {
      fetchSubscriptionData();
    }
  }, [activeSubTab]);

  const fetchSubscriptionData = async () => {
    try {
      const [sub, use] = await Promise.all([
        apiService.getSubscription(),
        apiService.getUsage()
      ]);
      setSubscription(sub);
      setUsage(use);
    } catch (err) {
      console.error('Abonelik verileri yüklenemedi');
    }
  };

  const fetchTenants = async () => {
    try {
      const data = await apiService.getTenants();
      setTenants(data);
    } catch (err) {
      console.error('Şirketler yüklenemedi');
    }
  };

  const handleSaveUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const unitData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      managerId: formData.get('managerId') as string,
    };

    setLoading(true);
    try {
      const savedUnit = await apiService.createUnit(unitData);
      setUnits([...units, savedUnit]);
      setShowUnitModal(false);
      setEditingUnit(null);
      alert('Birim başarıyla oluşturuldu.');
    } catch (err: any) {
      alert(err.message || 'Birim kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const role = formData.get('role') as UserRole;
    const unitId = formData.get('unitId') as string;
    const tenantId = formData.get('tenantId') as string;

    if (!name || !email || !role || !tenantId) {
      alert('Lütfen tüm zorunlu alanları doldurun.');
      return;
    }

    const userData = {
      name,
      email,
      role,
      unitId: unitId === '' ? null : unitId,
      tenantId,
      permissions: ['DASHBOARD_VIEW']
    };

    setLoading(true);
    try {
      const savedUser = await apiService.createUser(userData);
      const formattedUser = {
        ...savedUser,
        permissions: typeof savedUser.permissions === 'string' ? JSON.parse(savedUser.permissions) : savedUser.permissions
      };
      setUsers([...users, formattedUser]);
      setShowUserModal(false);
      setEditingUser(null);
      alert('Kullanıcı başarıyla oluşturuldu ve veritabanına eklendi.');
    } catch (err: any) {
      alert(err.message || 'Kullanıcı kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (id === currentUser.id) {
      alert('Kendinizi silemezsiniz reiz.');
      return;
    }

    if (window.confirm('Bu kullanıcıyı sistemden tamamen silmek istediğinize emin misiniz?')) {
      try {
        await apiService.deleteUser(id);
        setUsers(users.filter(u => u.id !== id));
        alert('Kullanıcı sistemden uçuruldu.');
      } catch (err: any) {
        alert(err.message || 'Silme işlemi başarısız.');
      }
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

        {activeSubTab === 'units' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-xl font-bold text-slate-900">Kurumsal Birimler</h4>
              <button onClick={() => { setEditingUnit(null); setShowUnitModal(true); }} className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"><Plus size={18} /> Yeni Birim Ekle</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {units.map(unit => (
                <div key={unit.id} className="glass-panel p-6 rounded-3xl flex flex-col group border-slate-100 hover:border-indigo-300 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center"><Building size={24} /></div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingUnit(unit); setShowUnitModal(true); }} className="p-2 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg"><Edit3 size={16} /></button>
                      <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <h5 className="font-bold text-slate-900 mb-1">{unit.name}</h5>
                  <p className="text-sm text-slate-500 mb-4">{unit.description || 'Açıklama girilmedi.'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSubTab === 'users' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-xl font-bold text-slate-900">Sistem Kullanıcıları</h4>
              <button onClick={() => { setEditingUser(null); setShowUserModal(true); }} className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"><UserPlus size={18} /> Yeni Kullanıcı</button>
            </div>
            <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">İsim / E-posta</th>
                    <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">Rol / Şirket</th>
                    <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">Birim</th>
                    <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col"><span className="font-bold text-slate-900">{user.name}</span><span className="text-xs text-slate-400">{user.email}</span></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-bold uppercase w-fit">{user.role}</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1"><Building2 size={10} /> {tenants.find(t => t.id === user.tenantId)?.name || 'Bilinmeyen'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{units.find(u => u.id === user.unitId)?.name || '-'}</td>
                      <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button onClick={() => handleDeleteUser(user.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubTab === 'subscription' && (
          <div className="space-y-6">
            <h4 className="text-xl font-bold text-slate-900">Abonelik & Kullanım</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-panel p-6 rounded-3xl">
                <h5 className="font-bold text-slate-900 mb-2">Mevcut Plan</h5>
                <p className="text-3xl font-black text-primary mb-4">{subscription?.plan || 'STARTER'}</p>
                
                {currentUser?.role === 'GENERAL_MANAGER' && (
                  <div className="space-y-2">
                    <select 
                      onChange={async (e) => {
                        try {
                          await apiService.updateTenantSubscription(currentUser.tenantId, e.target.value);
                          fetchSubscriptionData();
                          alert('Plan güncellendi.');
                        } catch (err) {
                          alert('Plan güncellenemedi.');
                        }
                      }}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl"
                      value={subscription?.plan || 'STARTER'}
                    >
                      <option value="STARTER">STARTER</option>
                      <option value="PROFESSIONAL">PROFESSIONAL</option>
                      <option value="ENTERPRISE">ENTERPRISE</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="glass-panel p-6 rounded-3xl">
                <h5 className="font-bold text-slate-900 mb-2">Aylık Kullanım</h5>
                {usage.length > 0 ? usage.map((u: any) => (
                  <div key={u.feature} className="flex justify-between text-sm py-1">
                    <span className="text-slate-500">{u.feature}</span>
                    <span className="font-bold">{u.count}</span>
                  </div>
                )) : <p className="text-sm text-slate-400">Henüz kullanım verisi yok.</p>}
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'workflow' && <WorkflowBuilder units={units} />}
        {activeSubTab === 'permissions' && (
          <div className="space-y-8">
            <div className="glass-panel p-8 rounded-[32px] border-primary/20 bg-primary/5 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Kullanıcı Yetki Yönetimi</h4>
                <p className="text-xs text-slate-500 font-bold mt-1">Sistem fonksiyonlarına erişimi kullanıcı bazında granular olarak yönetin.</p>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Düzenlenecek Kullanıcı:</p>
                <select 
                  value={editingUser?.id || ''} 
                  onChange={(e) => {
                    const user = users.find(u => u.id === e.target.value);
                    setEditingUser(user || null);
                  }}
                  className="bg-white px-6 py-3 border border-slate-200 rounded-2xl text-xs font-black outline-none focus:ring-4 focus:ring-primary/5 min-w-[240px] uppercase tracking-tighter"
                >
                  <option value="">Kullanıcı Seçin...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
            </div>

            {editingUser ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {NAV_ITEMS.filter(item => item.requiredPermission).map((item) => (
                    <div key={item.id} className="glass-panel p-8 rounded-[32px] group hover:border-primary/40 transition-all flex flex-col gap-6 relative overflow-hidden">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                            <item.icon size={24} />
                          </div>
                          <div>
                            <h4 className="font-black text-slate-900 uppercase tracking-tighter italic">{item.label}</h4>
                            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Erişim Kodu: {item.requiredPermission}</p>
                          </div>
                        </div>
                        <div 
                          onClick={() => {
                            const currentPerms = editingUser.permissions || [];
                            const newPerms = currentPerms.includes(item.requiredPermission)
                              ? currentPerms.filter(p => p !== item.requiredPermission)
                              : [...currentPerms, item.requiredPermission];
                            setEditingUser({ ...editingUser, permissions: newPerms });
                          }} 
                          className={cn(
                            "w-14 h-7 rounded-full relative cursor-pointer transition-all duration-300 shadow-inner", 
                            editingUser.permissions?.includes(item.requiredPermission) ? "bg-primary" : "bg-slate-200"
                          )}
                        >
                          <div className={cn(
                            "absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-sm flex items-center justify-center", 
                            editingUser.permissions?.includes(item.requiredPermission) ? "right-1" : "left-1"
                          )}>
                            {editingUser.permissions?.includes(item.requiredPermission) && <ShieldCheck size={10} className="text-primary" />}
                          </div>
                        </div>
                      </div>
                      <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-4 pt-6">
                  <button 
                    onClick={() => setEditingUser(null)}
                    className="px-8 py-4 text-xs font-black text-slate-500 uppercase tracking-widest hover:text-slate-800 transition-colors"
                  >
                    Vazgeç
                  </button>
                  <button 
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const updated = await apiService.updateUser(editingUser.id, { permissions: editingUser.permissions });
                        setUsers(users.map(u => u.id === updated.id ? { ...u, permissions: updated.permissions } : u));
                        alert('Yetkiler başarıyla güncellendi.');
                      } catch (err: any) {
                        alert(err.message || 'Hata oluştu.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    className="bg-primary text-white px-12 py-4 rounded-2xl text-xs font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all uppercase tracking-widest flex items-center gap-2"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    Yetkileri Kalıcı Olarak Kaydet
                  </button>
                </div>
              </div>
            ) : (
              <div className="glass-panel p-20 rounded-[40px] border-dashed flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mb-6">
                  <Users size={40} />
                </div>
                <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">İşlem Yapılacak Kullanıcıyı Seçin</h4>
                <p className="text-sm text-slate-400 font-bold max-w-sm mt-2">Yetkilerini düzenlemek istediğiniz personeli yukarıdaki listeden seçerek başlayabilirsiniz.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unit Modal */}
      <AnimatePresence>
        {showUnitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden bg-white p-8">
              <h4 className="text-xl font-bold text-slate-900 mb-6">Yeni Birim Oluştur</h4>
              <form onSubmit={handleSaveUnit} className="space-y-4">
                <input name="name" placeholder="Birim Adı" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500" />
                <textarea name="description" placeholder="Birim Açıklaması" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 resize-none" />
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowUnitModal(false)} className="px-6 py-2 text-sm font-bold text-slate-500">İptal</button>
                  <button type="submit" className="bg-primary text-white px-8 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">Kaydet</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Modal (Dahil Edilecek Firma Sorusunu Soran Versiyon) */}
      <AnimatePresence>
        {showUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden bg-white p-8">
              <h4 className="text-xl font-bold text-slate-900 mb-6">Yeni Kullanıcı & Firma Ataması</h4>
              <form onSubmit={handleSaveUser} className="space-y-4">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Dahil Edilecek Şirket</label>
                   <select name="tenantId" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500">
                      <option value="">Şirket Seçin</option>
                      {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                   </select>
                </div>
                <input name="name" placeholder="Kullanıcı Tam İsim" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500" />
                <input name="email" type="email" placeholder="Kurumsal E-posta" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500" />
                <select name="role" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500">
                  <option value="SALES_REP">Satış Temsilcisi</option>
                  <option value="PRESALES_ENG">Presales Mühendisi</option>
                  <option value="PROCUREMENT_MGR">Satın Alma Müdürü</option>
                  <option value="GENERAL_MANAGER">Genel Müdür</option>
                </select>
                <select name="unitId" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500">
                  <option value="">Birim (Opsiyonel)</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => setShowUserModal(false)} className="px-6 py-2 text-sm font-bold text-slate-500">İptal</button>
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="bg-primary text-white px-8 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : 'Kaydet ve Ata'}
                  </button>
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

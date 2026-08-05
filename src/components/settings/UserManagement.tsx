import React, { useState } from 'react';
import { UserPlus, Building2, Trash2, Loader2, UserCog, Edit3, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Unit, Tenant } from '../../types';
import { ROLE_LABELS } from '../../constants';
import { apiService } from '../../services/apiService';
import { PersonnelTransferModal, PersonnelTransferPayload } from './PersonnelTransferModal';

interface UserManagementProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  units: Unit[];
  tenants: Tenant[];
  activeTenantId: string;
  currentUser: User;
}

export const UserManagement = ({
  users,
  setUsers,
  units,
  tenants,
  activeTenantId,
  currentUser
}: UserManagementProps) => {
  const [showUserModal, setShowUserModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [delegateTarget, setDelegateTarget] = useState<User | null>(null);
  const [delegateSaving, setDelegateSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [transferTarget, setTransferTarget] = useState<{ user: User; mode: 'optional' | 'mandatory' } | null>(null);
  const [transferSaving, setTransferSaving] = useState(false);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const role = formData.get('role') as string;
    const unitId = formData.get('unitId') as string;

    if (!name || !email || !role || !activeTenantId) {
      alert('Lütfen tüm zorunlu alanları doldurun.');
      return;
    }

    const userData = {
      name,
      email,
      role,
      unitId: unitId === '' ? undefined : unitId,
      tenantId: activeTenantId,
      permissions: ['DASHBOARD_VIEW'],
      status: 'ACTIVE' as const
    };

    setLoading(true);
    try {
      const savedUser = await apiService.createUser(userData);
      const formattedUser = {
        ...savedUser,
        permissions: typeof savedUser.permissions === 'string' ? JSON.parse(savedUser.permissions) : savedUser.permissions
      };
      setUsers(prev => [...prev, formattedUser]);
      setShowUserModal(false);
      alert('Kullanıcı başarıyla oluşturuldu ve veritabanına eklendi.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Kullanıcı kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  // B-08 — vekalet: rol sahibi kullanıcı izinli/ulaşılamaz olduğunda onay yetkisini
  // devrettiği kişi. Boş seçim vekaleti kaldırır.
  const handleSaveDelegate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegateTarget) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const delegateToUserId = (formData.get('delegateToUserId') as string) || null;
    const delegateUntilRaw = formData.get('delegateUntil') as string;
    const delegateUntil = delegateToUserId && delegateUntilRaw ? delegateUntilRaw : null;

    setDelegateSaving(true);
    try {
      const updated = await apiService.updateUser(delegateTarget.id, { delegateToUserId, delegateUntil });
      setUsers(prev => prev.map(u => u.id === delegateTarget.id ? { ...u, ...updated } : u));
      setDelegateTarget(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Vekalet kaydedilemedi.');
    } finally {
      setDelegateSaving(false);
    }
  };

  // Terfi/rol değişikliği — mevcut kullanıcının rolünü/birimini düzenler.
  // Backend PUT /:id zaten destekliyordu, sadece bu edit-UI eksikti.
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const formData = new FormData(e.target as HTMLFormElement);
    const role = formData.get('role') as string;
    const unitId = (formData.get('unitId') as string) || null;
    const previousRole = editingUser.role;
    const targetId = editingUser.id;

    setEditSaving(true);
    try {
      const updated = await apiService.updateUser(targetId, { role, unitId: unitId || undefined });
      setUsers(prev => prev.map(u => u.id === targetId ? { ...u, ...updated } : u));
      setEditingUser(null);
      // Rol gerçekten değiştiyse (terfi/görev değişikliği): sahip olduğu aktif
      // kayıtları başka birine devretmek isteyip istemediği opsiyonel olarak sorulur.
      if (role && role !== previousRole) {
        const owned = await apiService.getOwnedItems(targetId);
        if (owned.totalActive > 0) {
          setTransferTarget({ user: { ...editingUser, role }, mode: 'optional' });
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Güncelleme başarısız.');
    } finally {
      setEditSaving(false);
    }
  };

  // İşten ayrılma / hesap kapatma — TRANSFER_REQUIRED gelirse zorunlu devir
  // modalı açılır (UnitManagement.handleDeleteUnit ile aynı desen).
  const attemptDeleteUser = async (id: string, transferToUserId?: string, hardDelete?: boolean) => {
    try {
      const result = await apiService.deleteUser(id, { transferToUserId, hardDelete });
      setUsers(prev => hardDelete
        ? prev.filter(u => u.id !== id)
        : prev.map(u => u.id === id ? { ...u, status: 'INACTIVE' } : u));
      setTransferTarget(null);
      alert((result as { message?: string })?.message || 'İşlem tamamlandı.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('TRANSFER_REQUIRED')) {
        const user = users.find(u => u.id === id);
        if (user) setTransferTarget({ user, mode: 'mandatory' });
      } else if (msg.includes('HARD_DELETE_BLOCKED')) {
        alert('Bu kullanıcı bazı fırsatların oluşturucusu olarak kayıtlı — kalıcı silinemez, bunun yerine pasifleştirildi/pasifleştirilmelidir.');
      } else {
        alert(msg || 'İşlem başarısız.');
      }
    } finally {
      setTransferSaving(false);
    }
  };

  const handleDeleteUser = (id: string) => {
    if (id === currentUser?.id) {
      alert('Kendinizi silemezsiniz reiz.');
      return;
    }
    if (window.confirm('Bu kullanıcıyı pasifleştirmek istediğinize emin misiniz? (Aktif iş kaydı varsa önce devir istenecek)')) {
      void attemptDeleteUser(id);
    }
  };

  const handleTransferConfirm = async (payload: PersonnelTransferPayload) => {
    if (!transferTarget) return;
    setTransferSaving(true);
    if (transferTarget.mode === 'mandatory') {
      // Silme akışının bir parçası — tek DELETE çağrısı hem devri hem pasifleştirme/silmeyi yapar.
      await attemptDeleteUser(transferTarget.user.id, payload.toUserId, payload.hardDelete);
    } else {
      // Terfi sonrası bağımsız devir — silme yok, yalnız POST /transfer.
      try {
        await apiService.transferUserOwnership(transferTarget.user.id, { toUserId: payload.toUserId, categoryKeys: payload.categoryKeys });
        setTransferTarget(null);
        alert('Kayıtlar devredildi.');
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Devir başarısız.');
      } finally {
        setTransferSaving(false);
      }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h4 className="text-xl font-bold text-slate-900">Sistem Kullanıcıları</h4>
        <button 
          onClick={() => setShowUserModal(true)} 
          className="bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all"
        >
          <UserPlus size={18} /> Yeni Kullanıcı
        </button>
      </div>

      <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">İsim / E-posta</th>
              <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">Rol / Şirket</th>
              <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">Birim</th>
              <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">Vekil</th>
              <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] text-right">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-sans">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      {user.name}
                      {user.status === 'INACTIVE' && (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-400 rounded text-[9px] font-black uppercase tracking-widest">Pasif</span>
                      )}
                    </span>
                    <span className="text-xs text-slate-400">{user.email}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-black uppercase tracking-widest w-fit">
                      {ROLE_LABELS[user.role] || user.role}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1">
                      <Building2 size={10} /> {tenants && tenants.length > 0 ? (tenants.find(t => t.id === user.tenantId)?.name || 'Şirket Tanımsız') : 'Yükleniyor...'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-600">
                  {units && units.length > 0 ? (units.find(u => u.id === user.unitId)?.name || '-') : '-'}
                </td>
                <td className="px-6 py-4 text-slate-600 text-xs">
                  {user.delegateToUserId ? (
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-700">{users.find(u => u.id === user.delegateToUserId)?.name || '?'}</span>
                      {user.delegateUntil && (
                        <span className="text-[10px] text-slate-400">{new Date(user.delegateUntil).toLocaleDateString('tr-TR')} tarihine kadar</span>
                      )}
                    </div>
                  ) : '-'}
                </td>
                <td className="px-6 py-4 text-right flex justify-end gap-2">
                  <button
                    onClick={() => setEditingUser(user)}
                    title="Rol/Birim Düzenle (Terfi)"
                    className="p-2 text-slate-400 hover:text-primary"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => setDelegateTarget(user)}
                    title="Vekil Ata"
                    className="p-2 text-slate-400 hover:text-primary"
                  >
                    <UserCog size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    title="Pasifleştir / Sil"
                    className="p-2 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* User Modal */}
      <AnimatePresence>
        {showUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }} 
              className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden bg-white p-8"
            >
              <h4 className="text-xl font-bold text-slate-900 mb-6">Yeni Kullanıcı Tanımla</h4>
              <form onSubmit={handleSaveUser} className="space-y-4">
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl mb-4">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">Seçili Şirket</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">
                    {tenants.find(t => t.id === activeTenantId)?.name || 'Şirket Seçilmedi'}
                  </p>
                  <p className="text-[9px] text-slate-400 mt-1">* Şirketi değiştirmek için Şirket Profili sayfasına gidin.</p>
                </div>
                <input 
                  name="name" 
                  placeholder="Kullanıcı Tam İsim" 
                  required 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500" 
                />
                <input 
                  name="email" 
                  type="email" 
                  placeholder="Kurumsal E-posta" 
                  required 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500" 
                />
                <select 
                  name="role" 
                  required 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500"
                >
                  <optgroup label="Yönetim">
                    <option value="ADMIN">Sistem Yöneticisi (Admin)</option>
                    <option value="GENERAL_MANAGER">Genel Müdür</option>
                  </optgroup>
                  <optgroup label="Satış & Pazarlama">
                    <option value="SALES_MGR">Satış Müdürü</option>
                    <option value="SALES_REP">Satış Temsilcisi</option>
                    <option value="SALES_SUPPORT">Satış Destek</option>
                  </optgroup>
                  <optgroup label="Teknik & Presales">
                    <option value="PRESALES_MGR">Presales Müdürü</option>
                    <option value="PRESALES_ENG">Presales Mühendisi</option>
                    <option value="TECHNICAL_SPEC">Teknik Uzman</option>
                  </optgroup>
                  <optgroup label="Proje & Operasyon">
                    <option value="PROJECT_MGR">Proje Yöneticisi</option>
                    <option value="OPERATIONS_MGR">Operasyon Müdürü</option>
                    <option value="PROCUREMENT_MGR">Satın Alma Müdürü</option>
                  </optgroup>
                  <optgroup label="Destek Birimleri">
                    <option value="FINANCE_MGR">Finans Müdürü</option>
                    <option value="HR_MGR">İnsan Kaynakları Müdürü</option>
                    <option value="AUDITOR">Denetçi / Auditor</option>
                  </optgroup>
                </select>
                <select 
                  name="unitId" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500"
                >
                  <option value="">Birim (Opsiyonel)</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <div className="flex justify-end gap-3 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowUserModal(false)} 
                    className="px-6 py-2 text-sm font-bold text-slate-500"
                  >
                    İptal
                  </button>
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

      {/* Vekil Ata Modal (B-08) */}
      <AnimatePresence>
        {delegateTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden bg-white p-8"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xl font-bold text-slate-900">Vekil Ata</h4>
                <button onClick={() => setDelegateTarget(null)} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
              </div>
              <p className="text-xs text-slate-400 mb-6">
                <span className="font-bold text-slate-600">{delegateTarget.name}</span> ({ROLE_LABELS[delegateTarget.role] || delegateTarget.role}) izinli/ulaşılamaz olduğunda,
                onay bekleyen işlerini seçtiğiniz kişi görüp onaylayabilir.
              </p>
              <form onSubmit={handleSaveDelegate} className="space-y-4">
                <select
                  name="delegateToUserId"
                  defaultValue={delegateTarget.delegateToUserId || ''}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500"
                >
                  <option value="">Vekalet yok</option>
                  {users.filter(u => u.id !== delegateTarget.id).map(u => (
                    <option key={u.id} value={u.id}>{u.name} — {ROLE_LABELS[u.role] || u.role}</option>
                  ))}
                </select>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Bitiş Tarihi (opsiyonel — boşsa süresiz)</label>
                  <input
                    name="delegateUntil"
                    type="date"
                    defaultValue={delegateTarget.delegateUntil ? delegateTarget.delegateUntil.slice(0, 10) : ''}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setDelegateTarget(null)} className="px-6 py-2 text-sm font-bold text-slate-500">
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={delegateSaving}
                    className="bg-primary text-white px-8 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2"
                  >
                    {delegateSaving ? <Loader2 size={16} className="animate-spin" /> : 'Kaydet'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rol/Birim Düzenle (Terfi) Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden bg-white p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-xl font-bold text-slate-900">Rol / Birim Düzenle</h4>
                <button onClick={() => setEditingUser(null)} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
              </div>
              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl mb-2">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest">Kullanıcı</p>
                  <p className="text-sm font-bold text-slate-900 mt-1">{editingUser.name}</p>
                </div>
                <select
                  name="role"
                  required
                  defaultValue={editingUser.role}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500"
                >
                  {Object.entries(ROLE_LABELS).map(([code, label]) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
                <select
                  name="unitId"
                  defaultValue={editingUser.unitId || ''}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500"
                >
                  <option value="">Birim (Opsiyonel)</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <p className="text-[10px] text-slate-400">
                  Rol değişirse, sahip olduğu aktif kayıtlar varsa kaydettikten sonra bir devir öneri ekranı açılır.
                </p>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setEditingUser(null)} className="px-6 py-2 text-sm font-bold text-slate-500">
                    Vazgeç
                  </button>
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="bg-primary text-white px-8 py-2 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2"
                  >
                    {editSaving ? <Loader2 size={16} className="animate-spin" /> : 'Kaydet'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Personel devri (terfi opsiyonel / işten ayrılma zorunlu) */}
      <AnimatePresence>
        {transferTarget && (
          <PersonnelTransferModal
            fromUser={transferTarget.user}
            users={users}
            units={units}
            mode={transferTarget.mode}
            saving={transferSaving}
            onClose={() => setTransferTarget(null)}
            onConfirm={handleTransferConfirm}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

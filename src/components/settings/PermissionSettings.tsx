import React, { useState } from 'react';
import { Users, ShieldCheck, Save, Loader2, CheckSquare, Square } from 'lucide-react';
import { cn } from '../../lib/utils';
import { User } from '../../types';
import { ROLE_LABELS } from '../../constants';
import { buildPermissionGroups } from '../../lib/permissionTree';
import { apiService } from '../../services/apiService';

interface PermissionSettingsProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
}

// Sidebar tek kaynağından türetilen yetki ağacı (parent + alt modüller).
const PERMISSION_GROUPS = buildPermissionGroups();

// Küçük toggle bileşeni (parent ve alt-modüller için ortak).
const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
  <div
    onClick={onClick}
    className={cn(
      'w-14 h-7 rounded-full relative cursor-pointer transition-all duration-300 shadow-inner shrink-0',
      on ? 'bg-primary' : 'bg-slate-200'
    )}
  >
    <div className={cn(
      'absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-sm flex items-center justify-center',
      on ? 'right-1' : 'left-1'
    )}>
      {on && <ShieldCheck size={10} className="text-primary" />}
    </div>
  </div>
);

export const PermissionSettings = ({
  users,
  setUsers
}: PermissionSettingsProps) => {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  const has = (perm: string) => editingUser?.permissions?.includes(perm) ?? false;
  const toggle = (perm: string) => {
    if (!editingUser) return;
    const cur = editingUser.permissions || [];
    const next = cur.includes(perm) ? cur.filter((p) => p !== perm) : [...cur, perm];
    setEditingUser({ ...editingUser, permissions: next });
  };
  // Bir grubun TÜM izinlerini (parent + alt) topluca aç/kapa.
  const setGroup = (perms: string[], on: boolean) => {
    if (!editingUser) return;
    const cur = new Set(editingUser.permissions || []);
    perms.forEach((p) => (on ? cur.add(p) : cur.delete(p)));
    setEditingUser({ ...editingUser, permissions: [...cur] });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="glass-panel p-8 rounded-[32px] border border-primary/20 bg-primary/5 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
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
              setEditingUser(user ? { ...user } : null);
            }}
            className="bg-white px-6 py-3 border border-slate-200 rounded-2xl text-xs font-black outline-none focus:ring-4 focus:ring-primary/5 min-w-[240px] uppercase tracking-tighter"
          >
            <option value="">Kullanıcı Seçin...</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} ({ROLE_LABELS[u.role] || u.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      {editingUser ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PERMISSION_GROUPS.map((group) => {
              const allPerms = [group.permission, ...group.children.map((c) => c.permission)];
              const allOn = allPerms.every((p) => has(p));
              return (
                <div
                  key={group.id}
                  className="glass-panel p-7 rounded-[32px] bg-white border border-slate-100 shadow-sm group hover:border-primary/40 transition-all flex flex-col gap-4 relative overflow-hidden"
                >
                  {/* Parent (üst modül) satırı */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                        <group.icon size={24} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-slate-900 uppercase tracking-tighter italic truncate">{group.label}</h4>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest truncate">Erişim Kodu: {group.permission}</p>
                      </div>
                    </div>
                    <Toggle on={has(group.permission)} onClick={() => toggle(group.permission)} />
                  </div>

                  {/* Alt modüller (sub-items) — her biri kendi izniyle ayrı toggle */}
                  {group.children.length > 0 && (
                    <div className="border-t border-slate-100 pt-3 mt-1 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Alt Modüller</span>
                        <button
                          type="button"
                          onClick={() => setGroup(allPerms, !allOn)}
                          className="flex items-center gap-1 text-[9px] font-black text-primary uppercase tracking-widest hover:opacity-70 transition-opacity"
                        >
                          {allOn ? <CheckSquare size={12} /> : <Square size={12} />}
                          {allOn ? 'Tümünü Kapat' : 'Tümünü Aç'}
                        </button>
                      </div>
                      {group.children.map((child) => (
                        <div key={child.permission} className="flex items-center justify-between pl-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate">{child.label}</p>
                            <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest truncate">{child.permission}</p>
                          </div>
                          <Toggle on={has(child.permission)} onClick={() => toggle(child.permission)} />
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              );
            })}
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
                  setUsers(prev => prev.map(u => u.id === updated.id ? { ...u, permissions: updated.permissions } : u));
                  alert('Yetkiler başarıyla güncellendi.');
                } catch (err) {
                  alert(err instanceof Error ? err.message : 'Hata oluştu.');
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
        <div className="glass-panel p-20 rounded-[40px] border border-dashed border-slate-200 bg-slate-50/30 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mb-6">
            <Users size={40} />
          </div>
          <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">İşlem Yapılacak Kullanıcıyı Seçin</h4>
          <p className="text-sm text-slate-400 font-bold max-w-sm mt-2">Yetkilerini düzenlemek istediğiniz personeli yukarıdaki listeden seçerek başlayabilirsiniz.</p>
        </div>
      )}
    </div>
  );
};

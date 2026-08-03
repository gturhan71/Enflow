import React, { useState, useEffect, useCallback } from 'react';
import { Building, X, ShieldCheck, Hash, Plus, Trash2, Save, DatabaseBackup, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Tenant, BackupSettings, User } from '../../types';
import { apiService } from '../../services/apiService';

// Yedekleme zamanlaması — eşik değer Şirket Profili'nden girilir (detay: Yedekleme modülü).
const BackupScheduleSettings: React.FC = () => {
  const [s, setS] = useState<BackupSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { apiService.getBackupSettings().then(r => setS(r as BackupSettings)).catch(() => undefined); }, []);
  if (!s) return null;
  const upd = (p: Partial<BackupSettings>) => setS({ ...s, ...p });
  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      const res = await apiService.updateBackupSettings({ enabled: s.enabled, intervalHours: s.intervalHours, scope: s.scope, kind: s.kind, targetType: s.targetType, location: s.location });
      setS(res as BackupSettings); setSaved(true); setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  };
  return (
    <div className="bg-white border border-slate-100 rounded-[2rem] p-8 mt-8">
      <div className="flex items-center gap-2 mb-1">
        <DatabaseBackup size={18} className="text-indigo-500" />
        <h3 className="text-lg font-black text-slate-900">Yedekleme Zamanlaması</h3>
      </div>
      <p className="text-xs text-slate-500 mb-5">Otomatik sistem yedeği aralığı (eşik değer). Hedef kimlik bilgileri ve manuel işlemler <b>Yedekleme</b> modülünde.</p>
      <label className="flex items-center gap-2 text-sm text-slate-700 mb-4">
        <input type="checkbox" checked={s.enabled} onChange={e => upd({ enabled: e.target.checked })} /> Otomatik yedeklemeyi etkinleştir
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aralık (saat)</label>
          <input type="number" min={1} value={s.intervalHours} onChange={e => upd({ intervalHours: Number(e.target.value) })} className="w-full mt-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-primary text-sm" />
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kapsam</label>
          <select value={s.scope} onChange={e => upd({ scope: e.target.value as BackupSettings['scope'] })} className="w-full mt-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-primary text-sm">
            <option value="PLATFORM">Platform (tüm DB)</option><option value="TENANT">Yalnız kiracı</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tür</label>
          <select value={s.kind} onChange={e => upd({ kind: e.target.value as BackupSettings['kind'] })} className="w-full mt-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-primary text-sm">
            <option value="FULL">Tam</option><option value="STATE">State</option><option value="DATA">Veri</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hedef</label>
          <select value={s.targetType} onChange={e => upd({ targetType: e.target.value as BackupSettings['targetType'] })} className="w-full mt-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-primary text-sm">
            <option value="LOCAL">Yerel</option><option value="NEXTCLOUD">Nextcloud</option><option value="S3">S3</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-5">
        <button onClick={save} disabled={saving} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Kaydet
        </button>
        {saved && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 size={14} /> Kaydedildi</span>}
      </div>
    </div>
  );
};

interface DocCodingProfile {
  companyCode: string;
  separator: string;
  includeYear: boolean;
  sequenceDigits: number;
  isActive: boolean;
}
interface DocCategory { id: string; code: string; label: string; sortOrder: number; }

// Özgün, tenant-yapılandırılabilir doküman kodlama notasyonu (Faz 3).
// Hiçbir sabit önek/kategori gömülü değildir — şirket kendi standardını girer.
const DocumentCodingSettings = () => {
  const [profile, setProfile] = useState<DocCodingProfile>({
    companyCode: '', separator: '-', includeYear: true, sequenceDigits: 5, isActive: true,
  });
  const [hasProfile, setHasProfile] = useState(false);
  const [categories, setCategories] = useState<DocCategory[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [newCat, setNewCat] = useState({ code: '', label: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiService.getDocCodingProfile() as { profile: (DocCodingProfile & { id: string }) | null; categories: DocCategory[]; preview: string | null };
    if (res.profile) {
      setProfile({
        companyCode: res.profile.companyCode, separator: res.profile.separator,
        includeYear: res.profile.includeYear, sequenceDigits: res.profile.sequenceDigits,
        isActive: res.profile.isActive,
      });
      setHasProfile(true);
    }
    setCategories(res.categories || []);
    setPreview(res.preview);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Canlı önizleme — kaydetmeden formattan türet
  const livePreview = (() => {
    const sep = profile.separator || '-';
    const seq = String(1).padStart(Math.max(1, profile.sequenceDigits || 5), '0');
    const parts: string[] = [];
    if (profile.companyCode) parts.push(profile.companyCode);
    parts.push(categories[0]?.code || 'ÖRN');
    if (profile.includeYear) parts.push(String(new Date().getFullYear()));
    parts.push(seq);
    return parts.join(sep);
  })();

  const saveProfile = async () => {
    setSaving(true); setMsg(null);
    try {
      const res = await apiService.updateDocCodingProfile(profile as unknown as Record<string, unknown>) as { preview: string | null };
      setPreview(res.preview); setHasProfile(true); setMsg('Profil kaydedildi.');
    } catch { setMsg('Kaydetme hatası.'); }
    setSaving(false);
  };

  const addCategory = async () => {
    if (!newCat.code.trim() || !newCat.label.trim()) return;
    try {
      await apiService.createDocCategory({ code: newCat.code.trim(), label: newCat.label.trim() });
      setNewCat({ code: '', label: '' });
      await load();
    } catch { setMsg('Kategori eklenemedi (kod benzersiz olmalı).'); }
  };

  const removeCategory = async (id: string) => {
    await apiService.deleteDocCategory(id);
    await load();
  };

  return (
    <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-6 shadow-sm">
      <div className="flex items-center gap-3">
        <Hash size={20} className="text-primary" />
        <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Doküman Kodlama Notasyonu</h4>
      </div>
      <p className="text-sm text-slate-500 italic leading-relaxed">
        Şirketinizin ISO 9001 doküman kontrol standardını burada tanımlayın. Üretilen kod formatı:
        <span className="font-mono not-italic font-bold text-slate-700"> {'{Şirket Kodu}'}{profile.separator}{'{Kategori}'}{profile.includeYear ? `${profile.separator}{Yıl}` : ''}{profile.separator}{'{Sıra}'}</span>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Profil ayarları */}
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Şirket Kodu</label>
            <input
              type="text" value={profile.companyCode}
              onChange={(e) => setProfile(p => ({ ...p, companyCode: e.target.value.toUpperCase() }))}
              placeholder="örn. ACME"
              className="w-full mt-1 px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-primary text-sm font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ayraç</label>
              <input
                type="text" maxLength={3} value={profile.separator}
                onChange={(e) => setProfile(p => ({ ...p, separator: e.target.value }))}
                className="w-full mt-1 px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-primary text-sm font-mono text-center"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sıra Hane</label>
              <input
                type="number" min={1} max={10} value={profile.sequenceDigits}
                onChange={(e) => setProfile(p => ({ ...p, sequenceDigits: Number(e.target.value) }))}
                className="w-full mt-1 px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-primary text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={profile.includeYear}
                onChange={(e) => setProfile(p => ({ ...p, includeYear: e.target.checked }))}
                className="w-4 h-4 accent-primary" />
              <span className="text-xs font-bold text-slate-700">Yıl dahil et</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={profile.isActive}
                onChange={(e) => setProfile(p => ({ ...p, isActive: e.target.checked }))}
                className="w-4 h-4 accent-primary" />
              <span className="text-xs font-bold text-slate-700">Aktif</span>
            </label>
          </div>
          <div className="p-4 bg-slate-900 rounded-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Canlı Önizleme</p>
            <p className="text-lg font-mono font-black text-primary mt-1">{livePreview}</p>
          </div>
          <button onClick={saveProfile} disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all disabled:opacity-50">
            <Save size={14} /> {saving ? 'Kaydediliyor...' : (hasProfile ? 'Profili Güncelle' : 'Profili Oluştur')}
          </button>
          {msg && <p className="text-xs text-center font-bold text-primary">{msg}</p>}
        </div>

        {/* Kategori sözlüğü */}
        <div className="space-y-4">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kategori Sözlüğü</p>
          <div className="flex gap-2">
            <input type="text" placeholder="KOD" value={newCat.code}
              onChange={(e) => setNewCat(c => ({ ...c, code: e.target.value.toUpperCase() }))}
              className="w-24 px-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-primary text-sm font-mono" />
            <input type="text" placeholder="Açıklama (örn. Sözleşme Evrakları)" value={newCat.label}
              onChange={(e) => setNewCat(c => ({ ...c, label: e.target.value }))}
              className="flex-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-primary text-sm" />
            <button onClick={addCategory}
              className="bg-slate-900 text-white px-3 rounded-xl hover:bg-slate-800 transition-all">
              <Plus size={16} />
            </button>
          </div>
          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-2 custom-scrollbar">
            {categories.length === 0 && (
              <p className="text-xs text-slate-400 italic text-center py-6">Henüz kategori tanımlanmadı. Kendi notasyonunuzu girin.</p>
            )}
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/40">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-black text-primary bg-primary/10 px-2 py-1 rounded-lg">{cat.code}</span>
                  <span className="text-xs font-bold text-slate-700">{cat.label}</span>
                </div>
                <button onClick={() => removeCategory(cat.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

interface TenantSettingsProps {
  companyLogo: string | null;
  setCompanyLogo: (logo: string | null) => void;
  activeTenantId: string;
  setActiveTenantId: (id: string) => void;
  tenants: Tenant[];
  newTenantName: string;
  setNewTenantName: (name: string) => void;
  handleCreateTenant: () => void;
  currentUser: User;
}

export const TenantSettings = ({
  companyLogo,
  setCompanyLogo,
  activeTenantId,
  setActiveTenantId,
  tenants,
  newTenantName,
  setNewTenantName,
  handleCreateTenant,
  currentUser
}: TenantSettingsProps) => {
  // Backend POST /api/tenants yalnız GENERAL_MANAGER'a açık (platform-seviyesi
  // işlem — yeni bir müşteri şirketi onboard etmek). ADMIN vb. rollere bu formu
  // göstermek "yetkiniz yok" hatasıyla sonuçlanan kullanılamaz bir UI bırakır.
  const canCreateTenant = currentUser?.role === 'GENERAL_MANAGER';
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Kurumsal Kimlik */}
      <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-8 shadow-sm">
        <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Kurumsal Kimlik</h4>
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50">
          {companyLogo ? (
            <div className="relative group">
              <img src={companyLogo} alt="Logo" className="h-24 w-auto mb-4 object-contain" />
              <button 
                onClick={() => setCompanyLogo(null)} 
                className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <Building size={48} className="text-slate-300 mb-4" />
          )}
          <h4 className="font-bold text-slate-900">Kurumsal Logo</h4>
          <p className="text-sm text-slate-500 mb-6 text-center italic">Tüm evraklarda ve PDF tekliflerde kullanılacaktır.</p>
          <input 
            type="file" 
            id="logo-upload" 
            className="hidden" 
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => setCompanyLogo(ev.target?.result as string);
                reader.readAsDataURL(file);
              }
            }} 
          />
          <label 
            htmlFor="logo-upload" 
            className="bg-primary text-white px-8 py-3 rounded-2xl text-xs font-black cursor-pointer hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all uppercase tracking-widest"
          >
            Logo Yükle
          </label>
        </div>
      </div>

      {/* Şirket / Tenant Yönetimi */}
      <div className="bg-white border border-slate-100 rounded-[2.5rem] p-8 space-y-8 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Şirket / Tenant Yönetimi</h4>
        </div>
        
        <div className="space-y-4">
          <div className="p-6 bg-slate-900 rounded-[2rem] text-white space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Şu An Yönetilen Şirket</p>
            <select 
              value={activeTenantId}
              onChange={(e) => setActiveTenantId(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:border-primary transition-all text-white"
            >
              {tenants.map(t => (
                <option key={t.id} value={t.id} className="text-slate-900">{t.name}</option>
              ))}
            </select>
            <p className="text-[10px] text-primary font-bold italic leading-relaxed">
              * Birim ve kullanıcı tanımları yukarıda seçili olan şirket üzerinden yapılacaktır. 
              Şirket değiştiğinde tüm veriler otomatik olarak senkronize edilir.
            </p>
          </div>

          {canCreateTenant && (
            <div className="p-6 border border-slate-100 rounded-[2rem] space-y-4 bg-slate-50/30">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Yeni Şirket Tanımla</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Şirket Tam Adı..."
                  value={newTenantName}
                  onChange={(e) => setNewTenantName(e.target.value)}
                  className="flex-1 px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-primary text-sm"
                />
                <button
                  onClick={handleCreateTenant}
                  className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all"
                >
                  Ekle
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
             {tenants.map(t => (
               <div key={t.id} className={cn(
                 "flex items-center justify-between p-4 rounded-2xl border transition-all",
                 activeTenantId === t.id ? "bg-primary/5 border-primary/20" : "bg-white border-slate-100"
               )}>
                  <span className="text-xs font-bold text-slate-700">{t.name}</span>
                  {activeTenantId === t.id && <ShieldCheck size={16} className="text-primary" />}
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>

    {/* Doküman Kodlama Notasyonu (Faz 3) */}
    <DocumentCodingSettings />

    {/* Yedekleme Zamanlaması (eşik değer) */}
    <BackupScheduleSettings />
    </div>
  );
};

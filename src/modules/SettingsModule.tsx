import React, { useState, useEffect } from 'react';
import { Unit, User, Subscription, UsageMetric } from '../types';
import IntegrationWizard from './IntegrationWizard';
import WorkflowBuilder from './WorkflowBuilder';
import { TenantSettings } from '../components/settings/TenantSettings';
import { UnitManagement } from '../components/settings/UnitManagement';
import { UserManagement } from '../components/settings/UserManagement';
import { SubscriptionSettings } from '../components/settings/SubscriptionSettings';
import { PermissionSettings } from '../components/settings/PermissionSettings';
import LicenseTypesModule from './LicenseTypesModule';
import RoleTemplateEditor from './dashboard/RoleTemplateEditor';
import ProductTaxonomyManagement from '../components/settings/ProductTaxonomyManagement';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { useModuleSettings } from '../hooks/useEnflowQueries';
import { useQueryClient } from '@tanstack/react-query';
import { PROMOTABLE_TEST_MODULES, NAV_ITEMS } from '../constants';
import { FlaskConical, CheckCircle2, Users as UsersIcon, Lock, Cpu, KeyRound, Loader2 } from 'lucide-react';

interface SettingsModuleProps {
  companyLogo: string | null;
  setCompanyLogo: (logo: string | null) => void;
  activeSubTab?: string;
  units: Unit[];
  setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  activeTenantId: string;
  setActiveTenantId: (id: string) => void;
}

// ── Modül Yönetimi bileşeni ───────────────────────────────────────────────
const ModuleManagement: React.FC<{ tenantId: string }> = ({ tenantId }) => {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useModuleSettings(tenantId);
  const [saving, setSaving] = useState<string | null>(null);

  const promoted = new Set(settings?.promotedModules ?? []);

  const toggle = async (id: string) => {
    setSaving(id);
    const next = new Set(promoted);
    next.has(id) ? next.delete(id) : next.add(id);
    try {
      await apiService.updateModuleSettings(Array.from(next));
      queryClient.invalidateQueries({ queryKey: ['module-settings', tenantId] });
    } finally {
      setSaving(null);
    }
  };

  if (isLoading) return <div className="text-sm text-slate-400 py-8 text-center">Yükleniyor…</div>;

  return (
    <div className="space-y-8">
      <div>
        <h4 className="text-xl font-bold text-slate-900">Modül Yönetimi</h4>
        <p className="text-sm text-slate-500 mt-1">
          Sistem modülleri izin tabanlı çalışır. Test modüllerini hazır olduğunda ana menüye alabilirsin.
        </p>
      </div>

      {/* Sistem modülleri — her zaman aktif */}
      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Sistem Modülleri</p>
        {NAV_ITEMS.map(item => (
          <div key={item.id} className="glass-card rounded-[18px] p-4 flex items-center gap-4 border border-white/20">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <item.icon size={18} className="text-primary" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-slate-800 text-sm">{item.label}</p>
                {item.subItems && (
                  <span className="text-[9px] text-slate-400 font-medium">{item.subItems.length} alt sekme</span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{item.requiredPermission}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">
              <CheckCircle2 size={11} />
              Aktif
            </div>
            <Lock size={14} className="text-slate-300 shrink-0" />
          </div>
        ))}
      </div>

      {/* Test modülleri — toggle'lı. Güvenlik Testi/Denetim İzi/Sanal Agentlar artık
          Ayarlar'ın kalıcı alt-öğeleri (bkz. constants.ts NAV_ITEMS settings.subItems,
          2026-08-19) — bu listede değiller, kalıcı olarak "ana menüde". */}
      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Test Modülleri</p>
        {PROMOTABLE_TEST_MODULES.length === 0 && (
          <p className="text-xs text-slate-400 italic px-1">Şu an tanıtılabilir bir test modülü yok.</p>
        )}
        {PROMOTABLE_TEST_MODULES.map(mod => {
          const isPromoted = promoted.has(mod.id);
          const isSaving = saving === mod.id;
          return (
            <div
              key={mod.id}
              className={`glass-card rounded-[18px] p-4 flex items-center gap-4 transition-all duration-300 ${
                isPromoted ? 'border border-emerald-500/30 bg-emerald-500/5' : 'border border-amber-500/20 bg-amber-500/3'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isPromoted ? 'bg-emerald-500/15' : 'bg-amber-500/10'
              }`}>
                <mod.icon size={18} className={isPromoted ? 'text-emerald-500' : 'text-amber-500'} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-800 text-sm">{mod.label}</p>
                  {isPromoted
                    ? <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 font-black uppercase tracking-widest">Canlıda</span>
                    : <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 font-black uppercase tracking-widest">Test</span>}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">{mod.description}</p>
                {isPromoted && (
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-emerald-600">
                    <UsersIcon size={10} />
                    <span>Tüm kullanıcılara açık — ana menüde görünür</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => toggle(mod.id)}
                disabled={isSaving}
                className={`relative shrink-0 w-11 h-6 rounded-full transition-all duration-300 ${
                  isPromoted ? 'bg-emerald-500' : 'bg-slate-300'
                } ${isSaving ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-300 ${
                  isPromoted ? 'left-5' : 'left-0.5'
                }`} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="glass-card rounded-[16px] p-4 flex items-start gap-3 border border-slate-200/60">
        <FlaskConical size={13} className="text-slate-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500">
          Toggle kapatılınca modül ana menüden kaldırılır, yalnız Genel Müdür'e görünmeye devam eder.
        </p>
      </div>
    </div>
  );
};

// ── YZ (Yapay Zeka) Entegrasyonu — sağlayıcıdan bağımsız ────────────────────
// Tenant kendi API key'ini girer; hangi YZ olduğu önemsiz (OpenAI-uyumlu uç).
// Key sunucuda saklanır, maskeli gösterilir, asla geri çekilmez.
const AISettingsCard: React.FC = () => {
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiService.getAISettings()
      .then(s => { setBaseUrl(s.baseUrl); setModel(s.model); setLabel(s.label); setHasKey(s.hasKey); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await apiService.updateAISettings({ baseUrl, model, label, apiKey: apiKey || undefined });
      setHasKey(res.hasKey);
      setApiKey('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const connected = hasKey && Boolean(baseUrl) && Boolean(model);

  return (
    <div className="glass-card p-6 rounded-2xl border border-slate-200/60">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
          <Cpu className="w-5 h-5 text-indigo-500" />
        </div>
        <div className="flex-1">
          <h5 className="text-lg font-bold text-slate-900">Yapay Zeka (YZ) Entegrasyonu</h5>
          <p className="text-xs text-slate-500">Şartname/sözleşme analizi için istediğiniz YZ sağlayıcısını bağlayın (OpenAI-uyumlu uç).</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${connected ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-slate-500'}`}>
          {connected ? '● Bağlı' : '○ Yapılandırılmadı'}
        </span>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400 py-6 text-center">Yükleniyor…</div>
      ) : (
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">API Base URL</label>
              <input
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://api.saglayici.com/v1"
                className="input-glass w-full text-sm"
              />
              <p className="text-[11px] text-slate-400 mt-1">OpenAI-uyumlu uç (sağlayıcı belgenizdeki base URL).</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Model adı</label>
              <input
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="örn. model-adı"
                className="input-glass w-full text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1">
                <KeyRound className="w-3 h-3" /> API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={hasKey ? '•••••••• (kayıtlı — değiştirmek için yeni anahtar girin)' : 'API anahtarınız'}
                className="input-glass w-full text-sm"
                autoComplete="off"
              />
              <p className="text-[11px] text-slate-400 mt-1">Anahtar yalnız sunucuda saklanır, geri gösterilmez.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Etiket (opsiyonel)</label>
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="örn. Şirket YZ'si"
                className="input-glass w-full text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Kaydet
            </button>
            {saved && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Kaydedildi</span>}
          </div>
        </div>
      )}
    </div>
  );
};

// Sürüm/Güncelleme bilgi kartı — ayrı upgrade-tool'un yazdığı durumu gösterir
// (salt-okunur; yükseltme bu uygulamada DEĞİL, ayrı araçtadır).
const UpdateInfoCard: React.FC = () => {
  const [v, setV] = useState<Awaited<ReturnType<typeof apiService.getVersion>> | null>(null);
  useEffect(() => { apiService.getVersion().then(setV).catch(() => undefined); }, []);
  const u = v?.update;
  const cur = v?.current;
  return (
    <div className="glass-card p-6 rounded-2xl">
      <div className="flex items-center gap-2 mb-1">
        <Cpu className="w-4 h-4 text-primary" />
        <h5 className="font-bold text-slate-900">Güncellemeler</h5>
      </div>
      <p className="text-sm text-slate-500 mb-4">Sürüm durumu, ayrı <span className="font-mono">upgrade-tool</span> aracı tarafından güncellenir.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Yerel sürüm</div>
          <div className="font-mono font-semibold text-slate-800">{cur?.tag || cur?.shortSha || '—'}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Durum</div>
          {u?.failed ? (
            <span className="text-xs font-bold text-red-500">Son yükseltme başarısız (geri alındı)</span>
          ) : u?.applied ? (
            <span className="text-xs font-bold text-emerald-600">Güncellendi → {u.target}</span>
          ) : u?.available ? (
            <span className="text-xs font-bold text-amber-600">⬆ Yeni sürüm mevcut: {u.target}{u.publishedAt ? ` (${new Date(u.publishedAt).toLocaleDateString('tr-TR')})` : ''}</span>
          ) : (
            <span className="text-xs font-bold text-emerald-600">Güncel</span>
          )}
        </div>
      </div>
      {u?.available && u?.notes && <p className="text-xs text-slate-500 mt-3">Not: {u.notes}</p>}
      {!v && <p className="text-xs text-slate-400 mt-2">Sürüm bilgisi alınamadı (araç henüz çalışmamış olabilir).</p>}
    </div>
  );
};

// ── Ana bileşen ───────────────────────────────────────────────────────────
const SettingsModule = ({
  companyLogo,
  setCompanyLogo,
  activeSubTab = 'company',
  units,
  setUnits,
  users,
  setUsers,
  activeTenantId,
  setActiveTenantId
}: SettingsModuleProps) => {
  const { currentUser } = useAuth();
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [newTenantName, setNewTenantName] = useState('');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageMetric[]>([]);

  useEffect(() => { fetchTenants(); }, []);

  useEffect(() => {
    if (activeSubTab === 'subscription' || activeSubTab === 'subscription-settings') fetchSubscriptionData();
  }, [activeSubTab]);

  const fetchSubscriptionData = async () => {
    try {
      const [sub, use] = await Promise.all([apiService.getSubscription(), apiService.getUsage()]);
      setSubscription(sub as Subscription | null);
      setUsage(use as UsageMetric[]);
    } catch { /* sessiz */ }
  };

  const fetchTenants = async () => {
    try {
      const data = await apiService.getTenants();
      setTenants(data);
    } catch { /* sessiz */ }
  };

  const handleCreateTenant = async () => {
    if (!newTenantName) return;
    try {
      const tenant = await apiService.createTenant({ name: newTenantName });
      setTenants((prev: { id: string; name: string }[]) => [...prev, tenant]);
      setNewTenantName('');
      alert('Şirket başarıyla tanımlandı.');
    } catch (err) {
      alert('Şirket oluşturulamadı: ' + (err instanceof Error ? err.message : 'Bilinmeyen hata'));
    }
  };

  const renderContent = () => {
    switch (activeSubTab) {
      case 'company':
        return (
          <TenantSettings
            companyLogo={companyLogo}
            setCompanyLogo={setCompanyLogo}
            activeTenantId={activeTenantId}
            setActiveTenantId={setActiveTenantId}
            tenants={tenants}
            newTenantName={newTenantName}
            setNewTenantName={setNewTenantName}
            handleCreateTenant={handleCreateTenant}
            currentUser={currentUser}
          />
        );
      case 'units':
        return <UnitManagement units={units} setUnits={setUnits} activeTenantId={activeTenantId} users={users} />;
      case 'users':
        return <UserManagement users={users} setUsers={setUsers} units={units} tenants={tenants} activeTenantId={activeTenantId} currentUser={currentUser} />;
      case 'subscription': // settings-subscription → 'subscription'
        return <SubscriptionSettings subscription={subscription} usage={usage} currentUser={currentUser} />;
      case 'license-types': // settings-license-types
        return <LicenseTypesModule />;
      case 'license-generate': // settings-license-generate (kaldırıldı)
      case 'license': // geriye dönük uyumluluk
        return (
          <div className="p-8">
            <div className="glass-card rounded-2xl p-6 border border-slate-200/60 max-w-2xl">
              <h3 className="text-lg font-bold text-slate-900 mb-1">Lisans üretimi artık burada değil</h3>
              <p className="text-sm text-slate-500">Güvenlik gereği lisanslar <b>vendor lisans aracıyla</b> (ayrı program, Ed25519 imza) üretilir; bu yazılım yalnız <b>doğrular/aktive eder</b>. Lisansınızı <b>Abonelik &amp; Kullanım</b> veya <b>Lisans Planları</b> ekranından girebilirsiniz.</p>
            </div>
          </div>
        );
      case 'workflow':
        return <WorkflowBuilder units={units} users={users} />;
      case 'integrations':
        return (
          <div className="space-y-6">
            <div>
              <h4 className="text-xl font-bold text-slate-900">Entegrasyon Yönetimi</h4>
              <p className="text-sm text-slate-500 mb-6">Yapay zeka, doküman ve iletişim servis bağlantılarını yapılandırın.</p>
            </div>
            <AISettingsCard />
            <UpdateInfoCard />
            <IntegrationWizard
              ncConfig={{ url: '', username: '', appPassword: '' }}
              setNcConfig={() => {}}
              exConfig={{ server: '', email: '', password: '' }}
              setExConfig={() => {}}
              waConfig={{ apiKey: '', phoneNumber: '' }}
              setWaConfig={() => {}}
            />
          </div>
        );
      case 'permissions':
        return <PermissionSettings users={users} setUsers={setUsers} />;
      case 'modules':
        return <ModuleManagement tenantId={activeTenantId} />;
      case 'dashboard-templates':
        return <RoleTemplateEditor />;
      case 'product-taxonomy':
        return <ProductTaxonomyManagement />;
      default:
        return null;
    }
  };

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 font-sans">Sistem Yapılandırması</h3>
          <p className="text-slate-500">Organizasyon yapısı, kullanıcılar ve birim bazlı yetkilendirme.</p>
        </div>
      </div>
      <div className="flex-1">
        {renderContent()}
      </div>
    </div>
  );
};

export default SettingsModule;

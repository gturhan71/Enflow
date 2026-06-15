import React, { useState, useEffect } from 'react';
import { Unit, User } from '../types';
import IntegrationWizard from './IntegrationWizard';
import WorkflowBuilder from './WorkflowBuilder';
import { TenantSettings } from '../components/settings/TenantSettings';
import { UnitManagement } from '../components/settings/UnitManagement';
import { UserManagement } from '../components/settings/UserManagement';
import { SubscriptionSettings } from '../components/settings/SubscriptionSettings';
import { PermissionSettings } from '../components/settings/PermissionSettings';
import LicenseGeneratorModule from './LicenseGeneratorModule';
import LicenseTypesModule from './LicenseTypesModule';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';
import { useModuleSettings } from '../hooks/useEnflowQueries';
import { useQueryClient } from '@tanstack/react-query';
import { PROMOTABLE_TEST_MODULES, NAV_ITEMS } from '../constants';
import { FlaskConical, CheckCircle2, Users as UsersIcon, Lock, ShieldCheck } from 'lucide-react';

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

      {/* Test modülleri — toggle'lı */}
      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Test Modülleri</p>
        {/* Sabit GM-only: Güvenlik Testi */}
        <div className="glass-card rounded-[18px] p-4 flex items-center gap-4 border border-white/20 opacity-60">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <ShieldCheck size={18} className="text-slate-400" strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-700 text-sm">Güvenlik Testi</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Sadece Genel Müdür — ana menüye alınamaz</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
            <Lock size={11} />
            GM Only
          </div>
          <Lock size={14} className="text-slate-300 shrink-0" />
        </div>

        {/* Tanıtılabilir test modülleri */}
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
          Toggle kapatılınca modül <span className="font-bold">Test Ortamı</span> bölümünde Genel Müdür'e görünmeye devam eder; ana menüden kaldırılır.
        </p>
      </div>
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
  const [subscription, setSubscription] = useState<unknown>(null);
  const [usage, setUsage] = useState<unknown[]>([]);

  useEffect(() => { fetchTenants(); }, []);

  useEffect(() => {
    if (activeSubTab === 'subscription' || activeSubTab === 'subscription-settings') fetchSubscriptionData();
  }, [activeSubTab]);

  const fetchSubscriptionData = async () => {
    try {
      const [sub, use] = await Promise.all([apiService.getSubscription(), apiService.getUsage()]);
      setSubscription(sub);
      setUsage(use as unknown[]);
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
          />
        );
      case 'units':
        return <UnitManagement units={units} setUnits={setUnits} activeTenantId={activeTenantId} users={users} />;
      case 'users':
        return <UserManagement users={users} setUsers={setUsers} units={units} tenants={tenants} activeTenantId={activeTenantId} currentUser={currentUser} />;
      case 'subscription': // settings-subscription → 'subscription'
        return <SubscriptionSettings subscription={subscription} usage={usage} currentUser={currentUser} fetchSubscriptionData={fetchSubscriptionData} />;
      case 'license-types': // settings-license-types
        return <LicenseTypesModule />;
      case 'license-generate': // settings-license-generate
        return <LicenseGeneratorModule />;
      case 'license': // geriye dönük uyumluluk
        return <LicenseGeneratorModule />;
      case 'workflow':
        return <WorkflowBuilder units={units} />;
      case 'integrations':
        return (
          <div className="space-y-6">
            <div>
              <h4 className="text-xl font-bold text-slate-900">Entegrasyon Yönetimi</h4>
              <p className="text-sm text-slate-500 mb-6">T-Ecosystem modülleri ve harici servis bağlantılarını yapılandırın.</p>
            </div>
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

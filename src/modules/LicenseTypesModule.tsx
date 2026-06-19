import React, { useState, useEffect } from 'react';
import {
  Package,
  Check,
  Zap,
  Building2,
  Globe,
  ChevronRight,
  Star,
  Users,
  HardDrive,
  Cpu,
  RefreshCw,
  Key,
  Lock,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';

interface SubscriptionData {
  plan: string;
  licenseModel?: string | null;
  licenseExpiryDate?: string | null;
  licensedUserLimit?: number | null;
  licensedStorageLimit?: number | null;
}

interface PlanDef {
  id: string;
  label: string;
  model: string;
  icon: React.ElementType;
  color: string;
  badgeColor: string;
  price: string;
  priceNote: string;
  userLimit: number;
  storageGB: number;
  features: { text: string; included: boolean }[];
  recommended?: boolean;
}

const PLANS: PlanDef[] = [
  {
    id: 'STARTER',
    label: 'KOBİ Starter',
    model: 'KOBI',
    icon: Zap,
    color: 'emerald',
    badgeColor: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30',
    price: '₺4.990',
    priceNote: '/ay',
    userLimit: 5,
    storageGB: 20,
    features: [
      { text: 'CRM & Fırsat Yönetimi', included: true },
      { text: 'BoM & Teklif Akışı', included: true },
      { text: 'Proje Yönetimi', included: true },
      { text: 'Sözleşme Yönetimi', included: false },
      { text: 'RBAC Güvenlik Testi', included: false },
      { text: 'API Erişimi', included: false },
    ],
  },
  {
    id: 'PROFESSIONAL',
    label: 'Professional',
    model: 'PAY_AS_YOU_GO',
    icon: Star,
    color: 'primary',
    badgeColor: 'bg-primary/15 text-primary border-primary/30',
    price: '₺14.990',
    priceNote: '/ay',
    userLimit: 25,
    storageGB: 100,
    recommended: true,
    features: [
      { text: 'CRM & Fırsat Yönetimi', included: true },
      { text: 'BoM & Teklif Akışı', included: true },
      { text: 'Proje Yönetimi', included: true },
      { text: 'Sözleşme Yönetimi', included: true },
      { text: 'RBAC Güvenlik Testi', included: true },
      { text: 'API Erişimi', included: true },
    ],
  },
  {
    id: 'ENTERPRISE',
    label: 'Enterprise',
    model: 'ON_PREMISE',
    icon: Building2,
    color: 'violet',
    badgeColor: 'bg-violet-500/15 text-violet-600 border-violet-500/30',
    price: 'Teklif Al',
    priceNote: '',
    userLimit: 999,
    storageGB: 999,
    features: [
      { text: 'CRM & Fırsat Yönetimi', included: true },
      { text: 'BoM & Teklif Akışı', included: true },
      { text: 'Proje Yönetimi', included: true },
      { text: 'Sözleşme Yönetimi', included: true },
      { text: 'RBAC Güvenlik Testi', included: true },
      { text: 'API Erişimi', included: true },
    ],
  },
];

// Lisans modeline göre hangi planlar erişilebilir
const UNLOCKED_PLANS: Record<string, string[]> = {
  KOBI: ['STARTER'],
  PAY_AS_YOU_GO: ['STARTER', 'PROFESSIONAL'],
  ON_PREMISE: ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'],
};

const COLOR_MAP: Record<string, { ring: string; bg: string; text: string; btn: string }> = {
  emerald: { ring: 'ring-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-600', btn: 'bg-emerald-500 hover:bg-emerald-400 text-white' },
  primary:  { ring: 'ring-primary/40',    bg: 'bg-primary/10',     text: 'text-primary',     btn: 'bg-primary hover:bg-primary/90 text-white' },
  violet:   { ring: 'ring-violet-500/30', bg: 'bg-violet-500/10',  text: 'text-violet-600',  btn: 'bg-violet-600 hover:bg-violet-500 text-white' },
};

const LicenseTypesModule: React.FC = () => {
  const { currentUser } = useAuth();
  const isGM = currentUser?.role === 'GENERAL_MANAGER';

  const [sub, setSub] = useState<SubscriptionData>({ plan: 'STARTER' });
  const [saving, setSaving] = useState(false);
  const [licenseInput, setLicenseInput] = useState('');
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);
  const [activateSuccess, setActivateSuccess] = useState(false);

  const fetchSub = () => {
    apiService.getSubscription()
      .then((data) => setSub(data as SubscriptionData))
      .catch(() => {});
  };

  useEffect(() => { fetchSub(); }, []);

  const unlocked = sub.licenseModel ? (UNLOCKED_PLANS[sub.licenseModel] ?? null) : null;

  const isPlanUnlocked = (planId: string) => !unlocked || unlocked.includes(planId);

  const handleChangePlan = async (planId: string) => {
    if (!isGM || planId === sub.plan || !isPlanUnlocked(planId)) return;
    setSaving(true);
    try {
      await apiService.updateTenantSubscription(currentUser!.tenantId ?? '', planId);
      setSub((prev) => ({ ...prev, plan: planId }));
    } catch { /* sessiz */ }
    finally { setSaving(false); }
  };

  const handleActivate = async () => {
    if (!licenseInput.trim()) return;
    setActivating(true);
    setActivateError(null);
    setActivateSuccess(false);
    try {
      const result = await apiService.activateLicense(licenseInput.trim()) as SubscriptionData;
      setSub(result);
      setActivateSuccess(true);
      setLicenseInput('');
      setTimeout(() => setActivateSuccess(false), 4000);
    } catch (err) {
      setActivateError(err instanceof Error ? err.message : 'Lisans aktivasyonu başarısız.');
    } finally {
      setActivating(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

  const isExpired = sub.licenseExpiryDate ? new Date(sub.licenseExpiryDate) < new Date() : false;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h4 className="text-xl font-bold text-slate-900">Lisans Planları</h4>
        <p className="text-sm text-slate-500 mt-1">
          {isGM
            ? 'Lisansınızı aktifleştirin ve şirketinizin plan ayarlarını yönetin.'
            : 'Şirketinizin aktif lisans ve plan bilgileri.'}
        </p>
      </div>

      {/* Aktif lisans bilgisi */}
      {sub.licenseModel ? (
        <div className={cn(
          'glass-card rounded-[20px] p-5 border',
          isExpired ? 'border-red-300/40 bg-red-500/5' : 'border-emerald-300/40 bg-emerald-500/5'
        )}>
          <div className="flex items-start gap-4">
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', isExpired ? 'bg-red-500/10' : 'bg-emerald-500/10')}>
              <Key size={18} className={isExpired ? 'text-red-500' : 'text-emerald-500'} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-slate-900 text-sm">Aktif Lisans</p>
                <span className={cn(
                  'text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border',
                  isExpired ? 'bg-red-500/15 text-red-600 border-red-500/30' : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                )}>
                  {isExpired ? 'Süresi Doldu' : 'Geçerli'}
                </span>
                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {sub.licenseModel}
                </span>
              </div>
              <div className="mt-2 flex gap-6 flex-wrap">
                {sub.licenseExpiryDate && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar size={12} />
                    <span>Son Geçerlilik: <strong className="text-slate-700">{formatDate(sub.licenseExpiryDate)}</strong></span>
                  </div>
                )}
                {sub.licensedUserLimit && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Users size={12} />
                    <span>{sub.licensedUserLimit} kullanıcı</span>
                  </div>
                )}
                {sub.licensedStorageLimit && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <HardDrive size={12} />
                    <span>{sub.licensedStorageLimit} GB</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-[20px] p-5 border border-slate-200/60 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <Globe size={18} className="text-slate-400" />
          </div>
          <div>
            <p className="font-bold text-slate-700 text-sm">Aktif Plan: <span className="text-primary">{sub.plan}</span></p>
            <p className="text-xs text-slate-400 mt-0.5">Lisans anahtarı aktivasyonu yapılmamış — tüm planları görebilirsiniz.</p>
          </div>
        </div>
      )}

      {/* Lisans aktivasyonu */}
      <div className="glass-card rounded-[20px] p-5 border border-white/20 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Lisans Anahtarı Aktivasyonu</p>
        <div className="flex gap-2">
          <textarea
            value={licenseInput}
            onChange={(e) => { setLicenseInput(e.target.value); setActivateError(null); }}
            placeholder="Lisans anahtarını buraya yapıştırın…"
            rows={3}
            className="input-glass flex-1 resize-none font-mono text-xs"
          />
        </div>
        {activateError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-500/5 border border-red-300/30 rounded-xl px-3 py-2">
            <AlertCircle size={14} />
            {activateError}
          </div>
        )}
        {activateSuccess && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-500/5 border border-emerald-300/30 rounded-xl px-3 py-2">
            <CheckCircle2 size={14} />
            Lisans başarıyla aktifleştirildi. Plan güncellendi.
          </div>
        )}
        <button
          onClick={handleActivate}
          disabled={!licenseInput.trim() || activating}
          className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {activating ? <RefreshCw size={15} className="animate-spin" /> : <Key size={15} />}
          Lisansı Aktifleştir
        </button>
      </div>

      {/* Plan kartları */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">
          {unlocked ? `Lisansınız (${sub.licenseModel}) ile erişilebilen planlar` : 'Mevcut Planlar'}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PLANS.map((plan) => {
            const isActive = sub.plan === plan.id;
            const isLocked = !isPlanUnlocked(plan.id);
            const cm = COLOR_MAP[plan.color];

            return (
              <div
                key={plan.id}
                className={cn(
                  'glass-card rounded-[24px] p-6 flex flex-col gap-4 border transition-all duration-300',
                  isActive ? `ring-2 ${cm.ring} border-transparent` : 'border-white/20',
                  isLocked ? 'opacity-50' : 'hover:border-white/40'
                )}
              >
                {plan.recommended && !isActive && !isLocked && (
                  <span className="self-start text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                    Önerilen
                  </span>
                )}

                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', isLocked ? 'bg-slate-100' : cm.bg)}>
                    {isLocked
                      ? <Lock size={16} className="text-slate-300" />
                      : <plan.icon size={18} className={cm.text} strokeWidth={2} />}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm leading-tight">{plan.label}</p>
                    <span className={cn('text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border', plan.badgeColor)}>
                      {plan.model}
                    </span>
                  </div>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900">{plan.price}</span>
                  {plan.priceNote && <span className="text-xs text-slate-500">{plan.priceNote}</span>}
                </div>

                <div className="flex gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {plan.userLimit === 999 ? 'Sınırsız' : `${plan.userLimit} kullanıcı`}
                  </span>
                  <span className="flex items-center gap-1">
                    <HardDrive size={12} />
                    {plan.storageGB === 999 ? 'Sınırsız' : `${plan.storageGB} GB`}
                  </span>
                </div>

                <ul className="space-y-1.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f.text} className="flex items-center gap-2 text-xs">
                      <Check size={12} strokeWidth={3} className={f.included ? cm.text : 'text-slate-300'} />
                      <span className={f.included ? 'text-slate-700' : 'text-slate-400 line-through'}>
                        {f.text}
                      </span>
                    </li>
                  ))}
                </ul>

                {isLocked ? (
                  <div className="text-center text-[10px] font-black uppercase tracking-widest py-2.5 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center gap-1.5">
                    <Lock size={11} /> Lisans Gerekli
                  </div>
                ) : isGM ? (
                  <button
                    onClick={() => handleChangePlan(plan.id)}
                    disabled={isActive || saving}
                    className={cn(
                      'w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5',
                      isActive ? `${cm.btn} cursor-default` : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95',
                      saving ? 'opacity-50 cursor-wait' : ''
                    )}
                  >
                    {saving ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : isActive ? (
                      <><Check size={12} strokeWidth={3} /> Aktif Plan</>
                    ) : (
                      <><ChevronRight size={12} /> Bu Plana Geç</>
                    )}
                  </button>
                ) : isActive ? (
                  <div className={cn('text-center text-[10px] font-black uppercase tracking-widest py-2 rounded-xl', cm.bg, cm.text)}>
                    <Check size={11} className="inline mr-1" strokeWidth={3} />
                    Aktif Planınız
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Kapasite özeti */}
      {(() => {
        const active = PLANS.find((p) => p.id === sub.plan);
        if (!active) return null;
        return (
          <div className="glass-card rounded-[20px] p-5 grid grid-cols-2 md:grid-cols-4 gap-4 border border-white/20">
            {[
              { icon: Users,      label: 'Kullanıcı Limiti', value: sub.licensedUserLimit ?? (active.userLimit === 999 ? 'Sınırsız' : active.userLimit) },
              { icon: HardDrive,  label: 'Depolama',          value: sub.licensedStorageLimit ? `${sub.licensedStorageLimit} GB` : (active.storageGB === 999 ? 'Sınırsız' : `${active.storageGB} GB`) },
              { icon: Package,    label: 'Lisans Modeli',     value: sub.licenseModel ?? active.model },
              { icon: Cpu,        label: 'Aktif Plan',        value: sub.plan },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-slate-500" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{label}</p>
                  <p className="text-sm font-black text-slate-900">{value}</p>
                </div>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
};

export default LicenseTypesModule;

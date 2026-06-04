import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CreditCard, 
  ShieldCheck, 
  Zap, 
  Server, 
  CheckCircle2, 
  AlertCircle, 
  Activity, 
  Lock,
  ArrowRight,
  TrendingUp,
  Users,
  HardDrive,
  Cpu,
  Key,
  Database,
  Trash2,
  X
} from 'lucide-react';
import { LicenseModel, SubscriptionPlan, LicenseData } from '../types';

const PLANS: SubscriptionPlan[] = [
  {
    id: 'plan_kobi',
    name: 'KOBİ (SaaS)',
    model: 'KOBI',
    price: 49,
    features: [
      'Bulut Tabanlı Erişim',
      '5 Aktif Kullanıcı',
      'Temel CRM & Satış Fırsatları',
      'Sözleşme Takibi',
      'Haftalık Raporlama'
    ],
    limits: {
      users: 5,
      storage: 10 // GB
    },
    isActive: true
  },
  {
    id: 'plan_paygo',
    name: 'Pay-As-You-Go',
    model: 'PAY_AS_YOU_GO',
    price: 0,
    features: [
      'Sınırsız Kullanıcı',
      'Dinamik Depolama Alanı',
      'Proje Başına Lisanslama',
      'Anlık Kullanım Takibi'
    ],
    limits: {
      users: 999,
      storage: 999
    },
    isActive: false
  },
  {
    id: 'plan_onprem',
    name: 'On-Premise (Enterprise)',
    model: 'ON_PREMISE',
    price: 4990,
    features: [
      'Kendi Sunucunda Barındırma',
      'Sınırsız Özelleştirme',
      'Logo/Netsis/Mikro Entegrasyonu',
      'Hibrit AI Desteği (External)',
      'Ömür Boyu Lisans + Yıllık Bakım',
      'Öncelikli 7/24 Destek'
    ],
    limits: {
      users: 9999,
      storage: 9999
    },
    isActive: false
  }
];

const SubscriptionModule: React.FC = () => {
  const [activeModel, setActiveModel] = useState<LicenseModel>('KOBI');
  const [isInstalling, setIsInstalling] = useState(false);
  const [installStep, setInstallStep] = useState(0);
  const [licenseKey, setLicenseKey] = useState('');
  const [activeLicense, setActiveLicense] = useState<LicenseData | null>(null);
  const [showHandoffModal, setShowHandoffModal] = useState(false);
  const [pendingLicense, setPendingLicense] = useState<LicenseData | null>(null);

  const handleActivateLicense = () => {
    try {
      const decoded: LicenseData = JSON.parse(atob(licenseKey));
      
      // Eğer mevcut lisans Trial ise ve yeni lisans Gerçek ise sor
      if (activeLicense?.isTrial && !decoded.isTrial) {
        setPendingLicense(decoded);
        setShowHandoffModal(true);
      } else {
        applyLicense(decoded);
      }
    } catch (err) {
      alert('Geçersiz Lisans Anahtarı!');
    }
  };

  const applyLicense = (license: LicenseData, wipeData: boolean = false) => {
    setActiveLicense(license);
    if (wipeData) {
      console.log('🧹 Tüm tenant verileri temizleniyor (Temiz Kurulum)...');
      // Burada backend endpoint'i çağrılır: apiService.resetTenantData()
    }
    handleInstall(license.model);
    setLicenseKey('');
    setShowHandoffModal(false);
  };

  const handleInstall = (model: LicenseModel) => {
    setActiveModel(model);
    setIsInstalling(true);
    setInstallStep(0);
    
    const intervals = [500, 1500, 2500, 3500];
    intervals.forEach((delay, index) => {
      setTimeout(() => setInstallStep(index + 1), delay);
    });
    
    setTimeout(() => {
      setIsInstalling(false);
    }, 4500);
  };

  // Dinamik limitleri kullan (lisans varsa oradan, yoksa default plandan)
  const basePlan = PLANS.find(p => p.model === activeModel) || PLANS[0];
  const currentLimits = activeLicense ? activeLicense.limits : basePlan.limits;
  const currentPlanName = activeLicense ? `${activeLicense.companyName} - ${activeLicense.model}` : basePlan.name;

  const getRemainingDays = () => {
    if (!activeLicense) return null;
    const expiry = new Date(activeLicense.expiryDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const remainingDays = getRemainingDays();

  return (
    <div className="space-y-8 animate-in fade-in duration-700 h-full relative">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-[#00f59b]" />
            Pricing & Subscription Management
          </h1>
          <p className="text-slate-400 mt-2">Enflow lisans modellerini yapılandırın, kullanım metriklerini izleyin ve sistemi aktifleştirin.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl">
          <div className="w-10 h-10 rounded-xl bg-[#00f59b]/10 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-[#00f59b]" />
          </div>
          <div>
            <div className="text-xs text-slate-500 uppercase font-semibold">Aktif Lisans Modeli</div>
            <div className="flex items-center gap-2">
              <div className="text-white font-bold">{currentPlanName}</div>
              {activeLicense?.isTrial && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  <span className="text-[9px] font-black text-amber-500 uppercase tracking-tighter">Deneme ({remainingDays} Gün)</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* License Activation Bar */}
      <div className="bg-amber-500/10 border border-amber-500/20 p-6 rounded-3xl flex flex-col md:flex-row items-center gap-6">
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center">
            <Key className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <div className="text-white font-bold tracking-tight">Lisans Anahtarı ile Aktifleştir</div>
            <div className="text-amber-500/60 text-xs">Master Admin tarafından verilen anahtarı girin.</div>
          </div>
        </div>
        
        <div className="flex-1 w-full relative">
          <input 
            type="text"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-[10px] font-mono text-amber-200 focus:border-amber-500/50 outline-none transition-all pr-32"
            placeholder="Aktivasyon kodunu buraya yapıştırın..."
          />
          <button 
            onClick={handleActivateLicense}
            disabled={!licenseKey}
            className="absolute right-2 top-2 bottom-2 px-6 bg-amber-500 hover:bg-amber-400 disabled:bg-white/5 disabled:text-slate-600 text-black text-xs font-bold rounded-lg transition-all"
          >
            Uygula
          </button>
        </div>
      </div>

      {/* Plan Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isSelected = activeModel === plan.model;
          return (
            <div 
              key={plan.id}
              className={`relative group rounded-3xl border transition-all duration-500 overflow-hidden ${
                isSelected 
                  ? 'bg-gradient-to-br from-[#00f59b]/10 to-transparent border-[#00f59b]/40 shadow-[0_0_40px_-15px_rgba(0,245,155,0.3)]' 
                  : 'bg-white/5 border-white/10 hover:border-white/20'
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 right-0 p-4">
                  <div className="bg-[#00f59b] text-black text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 uppercase">
                    <CheckCircle2 className="w-3 h-3" /> Aktif
                  </div>
                </div>
              )}
              
              <div className="p-8">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110 ${
                  plan.model === 'KOBI' ? 'bg-blue-500/10 text-blue-400' :
                  plan.model === 'PAY_AS_YOU_GO' ? 'bg-[#00f59b]/10 text-[#00f59b]' :
                  'bg-purple-500/10 text-purple-400'
                }`}>
                  {plan.model === 'KOBI' && <Users className="w-8 h-8" />}
                  {plan.model === 'PAY_AS_YOU_GO' && <Zap className="w-8 h-8" />}
                  {plan.model === 'ON_PREMISE' && <Server className="w-8 h-8" />}
                </div>

                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-bold text-white">
                    {plan.price === 0 ? 'Dinamik' : `$${plan.price.toLocaleString()}`}
                  </span>
                  <span className="text-slate-500 text-sm">
                    {plan.model === 'KOBI' ? '/ ay' : plan.model === 'PAY_AS_YOU_GO' ? '/ kullanım' : 'tek seferlik'}
                  </span>
                </div>

                <div className="space-y-3 mb-8">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-slate-300">
                      <CheckCircle2 className="w-4 h-4 text-[#00f59b]" />
                      {feature}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => handleInstall(plan.model)}
                  disabled={isSelected || isInstalling}
                  className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                    isSelected
                      ? 'bg-white/5 text-slate-500 cursor-default'
                      : 'bg-white text-black hover:bg-[#00f59b] active:scale-95'
                  }`}
                >
                  {isSelected ? 'Mevcut Plan' : 'Sistemi Kur & Aktif Et'}
                  {!isSelected && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Usage Analytics & Install Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Usage Stats */}
        <div className="lg:col-span-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="w-6 h-6 text-[#00f59b]" />
              Kullanım Metrikleri & Kotasız Takip
            </h3>
            <div className="text-xs text-slate-500 bg-white/5 px-3 py-1 rounded-full uppercase tracking-widest">Canlı Akış</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-[#00f59b]/20 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <Users className="w-6 h-6 text-blue-400" />
                <span className="text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">%{Math.round((3/currentLimits.users)*100)} Dolu</span>
              </div>
              <div className="text-2xl font-bold text-white mb-1">3 / {currentLimits.users}</div>
              <div className="text-sm text-slate-500">Aktif Kullanıcı</div>
              <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400 transition-all duration-1000" style={{ width: `${(3/currentLimits.users)*100}%` }}></div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-[#00f59b]/20 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <HardDrive className="w-6 h-6 text-purple-400" />
                <span className="text-xs text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">1.2 GB</span>
              </div>
              <div className="text-2xl font-bold text-white mb-1">%{Math.round((1.2/currentLimits.storage)*100)}</div>
              <div className="text-sm text-slate-500">Arşiv Doluluğu</div>
              <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-purple-400 transition-all duration-1000" style={{ width: `${(1.2/currentLimits.storage)*100}%` }}></div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-[#00f59b]/20 transition-all group relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <Cpu className="w-6 h-6 text-[#00f59b]" />
                <span className="text-[10px] text-[#00f59b] bg-[#00f59b]/10 px-2 py-0.5 rounded-full uppercase font-bold tracking-tighter">External Cloud Service</span>
              </div>
              <div className="text-2xl font-bold text-white mb-1">124 Analiz</div>
              <div className="text-sm text-slate-500">AI Sistem Aktivitesi</div>
              <div className="mt-4 p-2 bg-white/5 rounded-lg border border-white/5">
                <p className="text-[9px] text-slate-400 leading-tight">
                  <AlertCircle className="w-3 h-3 inline mr-1 text-[#00f59b]" />
                  Bulut ve On-Premise kurulumlarda AI servisleri, ana lisanstan bağımsız harici kullanici aboneliği üzerinden hibrit olarak çalışır.
                </p>
              </div>
            </div>

          </div>

          <div className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-blue-500/10 to-transparent border border-blue-500/20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <div className="text-white font-bold text-lg">Finansal Öngörü</div>
                <div className="text-slate-400 text-sm">Mevcut kullanım trendine göre bir sonraki fatura döneminde tasarruf edebilirsiniz.</div>
              </div>
            </div>
            <button className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-all border border-white/10">
              Analizi Gör
            </button>
          </div>
        </div>

        {/* Installation Status / Lock Panel */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
          {isInstalling ? (
            <div className="space-y-6 relative z-10 w-full">
              <div className="w-20 h-20 border-4 border-[#00f59b]/20 border-t-[#00f59b] rounded-full animate-spin mx-auto"></div>
              <div>
                <h4 className="text-xl font-bold text-white mb-2">Sistem Yapılandırılıyor</h4>
                <p className="text-slate-400 text-sm mb-6">Lisans anahtarları ve veritabanı şemaları yeni modele göre optimize ediliyor...</p>
                
                <div className="space-y-3 text-left max-w-[240px] mx-auto">
                  <div className={`flex items-center gap-3 text-sm transition-all duration-500 ${installStep >= 1 ? 'text-[#00f59b]' : 'text-slate-600'}`}>
                    {installStep >= 1 ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-slate-600"></div>}
                    Tenant ID Doğrulama
                  </div>
                  <div className={`flex items-center gap-3 text-sm transition-all duration-500 ${installStep >= 2 ? 'text-[#00f59b]' : 'text-slate-600'}`}>
                    {installStep >= 2 ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-slate-600"></div>}
                    API Feature Gate Kilidi Açılıyor
                  </div>
                  <div className={`flex items-center gap-3 text-sm transition-all duration-500 ${installStep >= 3 ? 'text-[#00f59b]' : 'text-slate-600'}`}>
                    {installStep >= 3 ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-slate-600"></div>}
                    Kullanım Metrikleri Sıfırlandı
                  </div>
                  <div className={`flex items-center gap-3 text-sm transition-all duration-500 ${installStep >= 4 ? 'text-[#00f59b]' : 'text-slate-600'}`}>
                    {installStep >= 4 ? <CheckCircle2 className="w-4 h-4" /> : <div className="w-4 h-4 rounded-full border border-slate-600"></div>}
                    Sistem Yeniden Başlatılıyor
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 relative z-10">
              <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto border border-white/10 group-hover:scale-110 transition-transform">
                <Lock className="w-10 h-10 text-slate-400" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-white mb-2">Güvenli Mod Aktif</h4>
                <p className="text-slate-400 text-sm">
                  Lisans modelini değiştirmek için **GENERAL_MANAGER** yetkisi gerekmektedir. Tüm değişiklikler `activity_log` üzerinde kayıt altına alınır.
                </p>
              </div>
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-left">
                <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
                <span className="text-xs text-amber-200">Model değişikliği veritabanı kotalarını anlık olarak günceller ve eski limitleri geçersiz kılar.</span>
              </div>
            </div>
          )}
          
          {/* Decorative Mesh */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#00f59b]/5 blur-[100px] pointer-events-none"></div>
        </div>
      </div>

      {/* Handoff Modal (Trial to Real) */}
      <AnimatePresence>
        {showHandoffModal && pendingLicense && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => setShowHandoffModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[40px] overflow-hidden shadow-2xl"
            >
              <div className="p-10">
                <div className="flex justify-between items-start mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                      <Zap className="w-8 h-8 text-amber-500" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white tracking-tight italic uppercase">Gerçek Lisans Devri</h2>
                      <p className="text-slate-400 text-sm mt-1">Deneme sürecinden tam sürüme geçiş algılandı.</p>
                    </div>
                  </div>
                  <button onClick={() => setShowHandoffModal(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-500 transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="p-6 bg-white/5 rounded-3xl border border-white/5 mb-8">
                  <p className="text-slate-300 text-sm leading-relaxed">
                    Tebrikler! **{pendingLicense.companyName}** için hazırlanan gerçek lisans anahtarı doğrulandı. 
                    Deneme süresi boyunca oluşturduğunuz verileri saklayarak devam edebilir veya tüm sistemi sıfırlayarak 
                    tertemiz bir başlangıç yapabilirsiniz.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                    onClick={() => applyLicense(pendingLicense, false)}
                    className="flex flex-col items-center gap-4 p-8 rounded-[32px] bg-white/5 border border-white/10 hover:border-[#00f59b]/40 hover:bg-[#00f59b]/5 transition-all group"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-[#00f59b]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Database className="w-8 h-8 text-[#00f59b]" />
                    </div>
                    <div className="text-center">
                      <div className="text-white font-bold mb-1 italic">Verileri Sakla</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Deneme verileri korunur</div>
                    </div>
                  </button>

                  <button 
                    onClick={() => applyLicense(pendingLicense, true)}
                    className="flex flex-col items-center gap-4 p-8 rounded-[32px] bg-white/5 border border-white/10 hover:border-red-500/40 hover:bg-red-500/5 transition-all group"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Trash2 className="w-8 h-8 text-red-500" />
                    </div>
                    <div className="text-center">
                      <div className="text-white font-bold mb-1 italic">Sistemi Sıfırla</div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Temiz bir sayfa açılır</div>
                    </div>
                  </button>
                </div>
              </div>
              
              <div className="bg-amber-500/10 p-4 text-center border-t border-white/5">
                <p className="text-[10px] text-amber-500 font-bold uppercase tracking-[0.2em]">⚠️ Bu işlem geri alınamaz</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SubscriptionModule;

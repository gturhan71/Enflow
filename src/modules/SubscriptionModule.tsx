import React, { useState } from 'react';
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
  Cpu
} from 'lucide-react';
import { LicenseModel, SubscriptionPlan } from '../types';

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

  const handleInstall = (model: LicenseModel) => {
    setActiveModel(model);
    setIsInstalling(true);
    setInstallStep(0);
    
    // Kurulum simülasyonu
    const intervals = [500, 1500, 2500, 3500];
    intervals.forEach((delay, index) => {
      setTimeout(() => setInstallStep(index + 1), delay);
    });
    
    setTimeout(() => {
      setIsInstalling(false);
    }, 4500);
  };

  const currentPlan = PLANS.find(p => p.model === activeModel) || PLANS[0];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
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
            <div className="text-white font-bold">{currentPlan.name}</div>
          </div>
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
                <span className="text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">%{Math.round((3/currentPlan.limits.users)*100)} Dolu</span>
              </div>
              <div className="text-2xl font-bold text-white mb-1">3 / {currentPlan.limits.users}</div>
              <div className="text-sm text-slate-500">Aktif Kullanıcı</div>
              <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400 transition-all duration-1000" style={{ width: `${(3/currentPlan.limits.users)*100}%` }}></div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-[#00f59b]/20 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <HardDrive className="w-6 h-6 text-purple-400" />
                <span className="text-xs text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">1.2 GB</span>
              </div>
              <div className="text-2xl font-bold text-white mb-1">%{Math.round((1.2/currentPlan.limits.storage)*100)}</div>
              <div className="text-sm text-slate-500">Arşiv Doluluğu</div>
              <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-purple-400 transition-all duration-1000" style={{ width: `${(1.2/currentPlan.limits.storage)*100}%` }}></div>
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
                  Bulut ve On-Premise kurulumlarda AI servisleri, ana lisanstan bağımsız harici kullanıcı aboneliği üzerinden hibrit olarak çalışır.
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
    </div>
  );
};

export default SubscriptionModule;

import React, { useState } from 'react';
import { 
  Key, 
  Copy, 
  Download, 
  CheckCircle2, 
  Building2, 
  Calendar, 
  ShieldAlert,
  Hash,
  RefreshCw,
  Terminal,
  Zap
} from 'lucide-react';
import { LicenseModel, LicenseData } from '../types';

const LicenseGeneratorModule: React.FC = () => {
  const [formData, setFormData] = useState({
    companyName: '',
    model: 'KOBI' as LicenseModel,
    validMonths: 12,
    userLimit: 5,
    storageLimit: 10,
    isTrial: false
  });

  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const generateLicenseKey = () => {
    const issuedAt = new Date().toISOString();
    const expiryDate = new Date();
    // Deneme ise tam 30 gün, değilse seçilen ay kadar
    if (formData.isTrial) {
      expiryDate.setDate(expiryDate.getDate() + 30);
    } else {
      expiryDate.setMonth(expiryDate.getMonth() + formData.validMonths);
    }

    const license: LicenseData = {
      companyName: formData.companyName + (formData.isTrial ? ' (DENEME)' : ''),
      model: formData.model,
      expiryDate: expiryDate.toISOString(),
      issuedAt: issuedAt,
      isTrial: formData.isTrial,
      limits: {
        users: formData.userLimit,
        storage: formData.storageLimit
      },
      signature: `SIG-${formData.isTrial ? 'TRIAL-' : ''}${Math.random().toString(36).substring(2, 15).toUpperCase()}`
    };

    const encoded = btoa(JSON.stringify(license));
    setGeneratedKey(encoded);
    setIsCopied(false);
  };

  const copyToClipboard = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-4 border-b border-white/10 pb-6">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center">
          <Key className="w-6 h-6 text-amber-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight italic uppercase">Master License Generator</h1>
          <p className="text-slate-500 text-sm">Firmalara özel lisans anahtarları ve yetki paketleri üretin.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Form Section */}
        <div className="space-y-6 bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-[32px]">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl mb-6">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${formData.isTrial ? 'bg-amber-500/20 text-amber-500' : 'bg-white/5 text-slate-500'}`}>
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Deneme Lisansı (Trial)</div>
                  <div className="text-[10px] text-slate-500 italic">30 gün boyunca ücretsiz kullanım sağlar.</div>
                </div>
              </div>
              <button 
                onClick={() => setFormData({...formData, isTrial: !formData.isTrial})}
                className={`w-12 h-6 rounded-full transition-all relative ${formData.isTrial ? 'bg-amber-500' : 'bg-white/10'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${formData.isTrial ? 'left-7' : 'left-1'}`}></div>
              </button>
            </div>

            <label className="block">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Firma Adı</span>
              <div className="mt-2 relative">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="text"
                  value={formData.companyName}
                  onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:border-amber-500/50 outline-none transition-all"
                  placeholder="Müşteri Firma A.Ş."
                />
              </div>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Lisans Modeli</span>
                <select 
                  value={formData.model}
                  onChange={(e) => setFormData({...formData, model: e.target.value as LicenseModel})}
                  className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-amber-500/50 outline-none transition-all appearance-none"
                >
                  <option value="KOBI">KOBİ (SaaS)</option>
                  <option value="PAY_AS_YOU_GO">Pay-As-You-Go</option>
                  <option value="ON_PREMISE">On-Premise</option>
                </select>
              </label>

              <label className="block opacity-80">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Geçerlilik (Ay)</span>
                <div className="mt-2 relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    type="number"
                    disabled={formData.isTrial}
                    value={formData.isTrial ? 1 : formData.validMonths}
                    onChange={(e) => setFormData({...formData, validMonths: parseInt(e.target.value)})}
                    className={`w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:border-amber-500/50 outline-none transition-all ${formData.isTrial ? 'cursor-not-allowed opacity-50' : ''}`}
                  />
                </div>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Kullanıcı Limiti</span>
                <input 
                  type="number"
                  value={formData.userLimit}
                  onChange={(e) => setFormData({...formData, userLimit: parseInt(e.target.value)})}
                  className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-amber-500/50 outline-none transition-all"
                />
              </label>

              <label className="block">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Depolama (GB)</span>
                <input 
                  type="number"
                  value={formData.storageLimit}
                  onChange={(e) => setFormData({...formData, storageLimit: parseInt(e.target.value)})}
                  className="mt-2 w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-white focus:border-amber-500/50 outline-none transition-all"
                />
              </label>
            </div>
          </div>

          <button 
            onClick={generateLicenseKey}
            disabled={!formData.companyName}
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-white/5 disabled:text-slate-600 text-black font-black uppercase tracking-widest rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Lisans Anahtarı Üret
          </button>
        </div>

        {/* Output Section */}
        <div className="flex flex-col">
          {generatedKey ? (
            <div className="flex-1 bg-black/60 border border-amber-500/20 rounded-[32px] p-8 space-y-6 relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <h3 className="text-amber-500 font-bold uppercase tracking-widest flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  Oluşturulan Anahtar
                </h3>
                <span className="text-[10px] text-amber-500/50 font-mono">SECURE GENERATION</span>
              </div>

              <div className="bg-black/40 border border-white/5 rounded-2xl p-4 font-mono text-[10px] text-slate-400 break-all leading-relaxed max-h-[200px] overflow-y-auto custom-scrollbar italic">
                {generatedKey}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={copyToClipboard}
                  className="flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-all border border-white/10"
                >
                  {isCopied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  {isCopied ? 'Kopyalandı' : 'Kodu Kopyala'}
                </button>
                <button className="flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-all border border-white/10">
                  <Download className="w-4 h-4" />
                  Dosya İndir
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                <div className="flex items-center gap-3 text-amber-500 mb-2">
                  <ShieldAlert className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase">Kritik Uyarı</span>
                </div>
                <p className="text-[10px] text-amber-200/60 leading-normal">
                  Bu anahtar sadece **{formData.companyName}** firması için geçerlidir. {formData.validMonths} ay süreyle **{formData.model}** özelliklerini aktifleştirecektir.
                </p>
              </div>

              {/* Background Glow */}
              <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-amber-500/10 blur-[60px] pointer-events-none group-hover:bg-amber-500/20 transition-all duration-700"></div>
            </div>
          ) : (
            <div className="flex-1 border-2 border-dashed border-white/5 rounded-[32px] flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                <Hash className="w-8 h-8 text-slate-700" />
              </div>
              <div>
                <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Henüz Anahtar Üretilmedi</p>
                <p className="text-slate-600 text-[10px] mt-2 max-w-[200px]">Sol taraftaki formu doldurarak yeni bir aktivasyon kodu oluşturabilirsiniz.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LicenseGeneratorModule;

import React, { useState, useEffect } from 'react';
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
  Zap,
  Lock,
  Terminal,
  ChevronDown,
} from 'lucide-react';
import { LicenseModel, LicenseData } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../services/apiService';

interface TenantOption {
  id: string;
  name: string;
}

const LicenseGeneratorModule: React.FC = () => {
  const { currentUser } = useAuth();
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [formData, setFormData] = useState({
    targetTenantId: '',
    companyName: '',
    model: 'KOBI' as LicenseModel,
    validMonths: 12,
    userLimit: 5,
    storageLimit: 10,
    isTrial: false,
  });
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    apiService.getTenants()
      .then((data: TenantOption[]) => setTenants(data))
      .catch(() => {});
  }, []);

  if (currentUser?.role !== 'GENERAL_MANAGER') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <Lock size={28} className="text-red-400" />
        </div>
        <p className="font-bold text-slate-700">Bu sayfaya erişim yetkiniz yok.</p>
        <p className="text-sm text-slate-400">Lisans anahtarı oluşturma yalnızca Genel Müdür'e açıktır.</p>
      </div>
    );
  }

  const handleTenantSelect = (tenantId: string) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    setFormData((prev) => ({
      ...prev,
      targetTenantId: tenantId,
      companyName: tenant?.name ?? prev.companyName,
    }));
    setGeneratedKey(null);
  };

  const generateLicenseKey = () => {
    const issuedAt = new Date().toISOString();
    const expiryDate = new Date();
    if (formData.isTrial) {
      expiryDate.setDate(expiryDate.getDate() + 30);
    } else {
      expiryDate.setMonth(expiryDate.getMonth() + formData.validMonths);
    }

    const license: LicenseData & { tenantId: string } = {
      tenantId: formData.targetTenantId,
      companyName: formData.companyName + (formData.isTrial ? ' (DENEME)' : ''),
      model: formData.model,
      expiryDate: expiryDate.toISOString(),
      issuedAt,
      isTrial: formData.isTrial,
      limits: {
        users: formData.userLimit,
        storage: formData.storageLimit,
      },
      signature: `SIG-${formData.isTrial ? 'TRIAL-' : ''}${Math.random().toString(36).substring(2, 15).toUpperCase()}`,
    };

    setGeneratedKey(btoa(JSON.stringify(license)));
    setIsCopied(false);
  };

  const copyToClipboard = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const downloadKey = () => {
    if (!generatedKey) return;
    const blob = new Blob([generatedKey], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `enflow-license-${formData.companyName.replace(/\s+/g, '_')}.lic`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isFormValid = formData.targetTenantId && formData.companyName;

  const MODEL_LABELS: Record<LicenseModel, string> = {
    KOBI: 'KOBİ → Starter Plan',
    PAY_AS_YOU_GO: 'Pay-As-You-Go → Professional Plan',
    ON_PREMISE: 'On-Premise → Enterprise Plan',
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-2xl bg-amber-500/15 flex items-center justify-center shrink-0">
          <Key size={20} className="text-amber-500" />
        </div>
        <div>
          <h4 className="text-xl font-bold text-slate-900">Lisans Anahtarı Oluştur</h4>
          <p className="text-sm text-slate-500 mt-0.5">
            Firmalara özel, tenant'a bağlı aktivasyon anahtarları üretin.
          </p>
        </div>
        <span className="ml-auto text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-600 border border-amber-500/20 shrink-0">
          GM Only
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Form */}
        <div className="glass-card rounded-[24px] p-6 border border-white/20 space-y-5">
          {/* Tenant seçimi */}
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Hedef Şirket (Tenant)
            </span>
            <div className="mt-1.5 relative">
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={formData.targetTenantId}
                onChange={(e) => handleTenantSelect(e.target.value)}
                className="input-glass w-full appearance-none pr-8"
              >
                <option value="">— Tenant seçin —</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.id})
                  </option>
                ))}
              </select>
            </div>
            {formData.targetTenantId && (
              <p className="mt-1.5 text-[10px] font-mono text-slate-400 bg-slate-100 rounded-lg px-3 py-1.5 break-all">
                tenantId: <span className="text-primary font-bold">{formData.targetTenantId}</span>
              </p>
            )}
          </div>

          {/* Trial toggle */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-500/5 border border-amber-500/15">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${formData.isTrial ? 'bg-amber-500/20' : 'bg-slate-100'}`}>
                <Zap size={16} className={formData.isTrial ? 'text-amber-500' : 'text-slate-400'} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">Deneme Lisansı (Trial)</p>
                <p className="text-[10px] text-slate-400">30 gün ücretsiz kullanım</p>
              </div>
            </div>
            <button
              onClick={() => setFormData({ ...formData, isTrial: !formData.isTrial })}
              className={`relative w-11 h-6 rounded-full transition-all ${formData.isTrial ? 'bg-amber-500' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${formData.isTrial ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>

          {/* Firma adı */}
          <label className="block">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Firma Adı</span>
            <div className="mt-1.5 relative">
              <Building2 size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="Müşteri Firma A.Ş."
                className="input-glass w-full pl-10"
              />
            </div>
          </label>

          {/* Model */}
          <label className="block">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lisans Modeli</span>
            <div className="mt-1.5 relative">
              <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value as LicenseModel })}
                className="input-glass mt-0 w-full appearance-none pr-8"
              >
                {(Object.keys(MODEL_LABELS) as LicenseModel[]).map((m) => (
                  <option key={m} value={m}>{MODEL_LABELS[m]}</option>
                ))}
              </select>
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Süre (Ay)</span>
              <div className="mt-1.5 relative">
                <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="number"
                  min={1}
                  disabled={formData.isTrial}
                  value={formData.isTrial ? 1 : formData.validMonths}
                  onChange={(e) => setFormData({ ...formData, validMonths: parseInt(e.target.value) })}
                  className={`input-glass w-full pl-10 ${formData.isTrial ? 'opacity-40 cursor-not-allowed' : ''}`}
                />
              </div>
            </label>
            <label className="block">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kullanıcı Limiti</span>
              <input
                type="number"
                min={1}
                value={formData.userLimit}
                onChange={(e) => setFormData({ ...formData, userLimit: parseInt(e.target.value) })}
                className="input-glass mt-1.5 w-full"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Depolama Limiti (GB)</span>
            <input
              type="number"
              min={1}
              value={formData.storageLimit}
              onChange={(e) => setFormData({ ...formData, storageLimit: parseInt(e.target.value) })}
              className="input-glass mt-1.5 w-full"
            />
          </label>

          <button
            onClick={generateLicenseKey}
            disabled={!isFormValid}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw size={16} />
            Anahtar Üret
          </button>
        </div>

        {/* Output */}
        <div className="flex flex-col gap-4">
          {generatedKey ? (
            <div className="flex-1 glass-card rounded-[24px] p-6 border border-amber-500/20 space-y-5">
              <div className="flex items-center gap-2">
                <Terminal size={15} className="text-amber-500" />
                <span className="text-sm font-bold text-amber-600 uppercase tracking-widest">Oluşturulan Anahtar</span>
              </div>

              <div className="bg-slate-900/60 rounded-xl p-4 font-mono text-[10px] text-emerald-400 break-all leading-relaxed max-h-40 overflow-y-auto custom-scrollbar">
                {generatedKey}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={copyToClipboard}
                  className="btn-secondary flex items-center justify-center gap-2 text-sm"
                >
                  {isCopied
                    ? <><CheckCircle2 size={14} className="text-emerald-500" /> Kopyalandı</>
                    : <><Copy size={14} /> Kopyala</>}
                </button>
                <button
                  onClick={downloadKey}
                  className="btn-secondary flex items-center justify-center gap-2 text-sm"
                >
                  <Download size={14} />
                  .lic İndir
                </button>
              </div>

              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-600">
                  <ShieldAlert size={13} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Önemli</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Bu anahtar yalnızca{' '}
                  <strong className="text-slate-700">{formData.companyName}</strong> firmasının{' '}
                  <span className="font-mono text-primary text-[10px]">{formData.targetTenantId}</span>{' '}
                  tenant'ına özgüdür.{' '}
                  {formData.isTrial ? '30 gün deneme' : `${formData.validMonths} ay`}{' '}
                  <strong className="text-slate-700">{MODEL_LABELS[formData.model]}</strong> lisansını aktifleştirir.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 glass-card rounded-[24px] p-6 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
                <Hash size={24} className="text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Anahtar Üretilmedi</p>
                <p className="text-xs text-slate-300 mt-1 max-w-[200px]">
                  Tenant seçin, formu doldurun ve Anahtar Üret butonuna basın.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LicenseGeneratorModule;

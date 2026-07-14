import React, { useEffect, useState } from 'react';
import { ServerCog, Building2, UserCog, KeyRound, CheckCircle2, Loader2, ArrowRight, ArrowLeft, ShieldCheck } from 'lucide-react';
import { apiService } from '../services/apiService';
import { User } from '../types';

interface SetupWizardProps {
  // Kurulum tamamlanınca mevcut handleLogin ile otomatik giriş.
  onComplete: (tenantId: string, token: string, user: User) => void;
}

const STEPS = ['Sistem', 'Şirket', 'Yönetici', 'Lisans', 'Tamamla'];

// Statik minimum gereksinimler (kullanıcıyı bilgilendirme).
const REQUIREMENTS = [
  { label: 'Node.js', value: '≥ 20 LTS (öneri 22)' },
  { label: 'pnpm', value: '10.33+' },
  { label: 'Disk', value: '≥ 2 GB boş' },
  { label: 'Backend portu', value: '3002' },
];

export const SetupWizard = ({ onComplete }: SetupWizardProps) => {
  const [step, setStep] = useState(0);
  const [health, setHealth] = useState<'checking' | 'ok' | 'down'>('checking');
  const [company, setCompany] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [license, setLicense] = useState('');
  const [useTrial, setUseTrial] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/health').then((r) => setHealth(r.ok ? 'ok' : 'down')).catch(() => setHealth('down'));
  }, []);

  const canNext = (): boolean => {
    if (step === 1) return company.trim().length > 1;
    if (step === 2) return adminName.trim().length > 1 && /\S+@\S+\.\S+/.test(adminEmail) && adminPassword.length >= 6;
    if (step === 3) return useTrial || license.trim().length > 10;
    return true;
  };

  const submit = async () => {
    setSubmitting(true); setError(null);
    try {
      const res = await apiService.runSetup({
        company: { name: company.trim() },
        admin: { name: adminName.trim(), email: adminEmail.trim(), password: adminPassword },
        license: useTrial ? undefined : license.trim(),
      });
      onComplete(res.tenantId, res.token, res.user as unknown as User);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kurulum başarısız.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 to-indigo-50/40 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl glass-card rounded-[28px] p-8 shadow-xl">
        {/* Başlık + adım göstergesi */}
        <div className="flex items-center gap-3 mb-1">
          <div className="w-11 h-11 rounded-2xl bg-primary text-white flex items-center justify-center"><ServerCog size={22} /></div>
          <div>
            <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Enflow Kurulumu</h1>
            <p className="text-xs text-slate-500 font-bold">İlk çalıştırma — sistemi tanımlayın</p>
          </div>
        </div>
        <div className="flex items-center gap-1 my-6">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 ${i === step ? 'text-primary' : i < step ? 'text-emerald-600' : 'text-slate-300'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black border-2 ${i === step ? 'border-primary' : i < step ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200'}`}>
                  {i < step ? <CheckCircle2 size={14} /> : i + 1}
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${i < step ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Adım içerikleri */}
        <div className="min-h-[240px]">
          {step === 0 && (
            <div>
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><ServerCog size={18} /> Sistem Gereksinimleri</h3>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {REQUIREMENTS.map((r) => (
                  <div key={r.label} className="p-3 rounded-xl bg-white/60 border border-slate-100">
                    <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">{r.label}</div>
                    <div className="text-sm font-semibold text-slate-700">{r.value}</div>
                  </div>
                ))}
              </div>
              <div className={`flex items-center gap-2 text-sm font-bold ${health === 'ok' ? 'text-emerald-600' : health === 'down' ? 'text-red-500' : 'text-slate-400'}`}>
                {health === 'checking' ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Backend bağlantısı: {health === 'ok' ? 'çalışıyor (3002)' : health === 'down' ? 'erişilemiyor' : 'kontrol ediliyor…'}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><Building2 size={18} /> Şirket Bilgileri</h3>
              <label className="block text-xs font-bold text-slate-500 mb-1">Şirket / Kurum Adı *</label>
              <input className="input-glass w-full" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Örn. Acme Teknoloji A.Ş." autoFocus />
              <p className="text-xs text-slate-400 mt-2">Bu, sisteminizin tek kiracısı (tenant) olur.</p>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><UserCog size={18} /> İlk Yönetici (Genel Müdür)</h3>
              <label className="block text-xs font-bold text-slate-500 mb-1">Ad Soyad *</label>
              <input className="input-glass w-full mb-3" value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Örn. Ada Yönetici" autoFocus />
              <label className="block text-xs font-bold text-slate-500 mb-1">E-posta *</label>
              <input className="input-glass w-full mb-3" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="ada@acme.com" />
              <label className="block text-xs font-bold text-slate-500 mb-1">Şifre * (en az 6 karakter)</label>
              <input className="input-glass w-full" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
              <p className="text-xs text-slate-400 mt-2">Bu kullanıcı GENEL_MÜDÜR rolüyle açılır; diğer kullanıcıları sonra Ayarlar'dan ekler.</p>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><KeyRound size={18} /> Lisans</h3>
              <div className="space-y-2">
                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${useTrial ? 'border-primary bg-primary/5' : 'border-slate-200'}`} onClick={() => setUseTrial(true)}>
                  <input type="radio" checked={useTrial} onChange={() => setUseTrial(true)} className="mt-1" />
                  <div>
                    <div className="font-bold text-slate-800 text-sm flex items-center gap-2"><ShieldCheck size={14} className="text-emerald-600" /> 30 günlük deneme ile başla</div>
                    <div className="text-xs text-slate-500">Lisansı sonra Ayarlar → Abonelik'ten girebilirsiniz.</div>
                  </div>
                </label>
                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer ${!useTrial ? 'border-primary bg-primary/5' : 'border-slate-200'}`} onClick={() => setUseTrial(false)}>
                  <input type="radio" checked={!useTrial} onChange={() => setUseTrial(false)} className="mt-1" />
                  <div className="flex-1">
                    <div className="font-bold text-slate-800 text-sm">Lisans anahtarım var</div>
                    {!useTrial && (
                      <textarea className="input-glass w-full mt-2 font-mono text-xs" rows={3} value={license} onChange={(e) => setLicense(e.target.value)} placeholder="ENF1.xxxxx.yyyyy" />
                    )}
                  </div>
                </label>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><CheckCircle2 size={18} /> Özet & Tamamla</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between p-2 rounded-lg bg-white/60"><span className="text-slate-500">Şirket</span><span className="font-semibold text-slate-800">{company}</span></div>
                <div className="flex justify-between p-2 rounded-lg bg-white/60"><span className="text-slate-500">Yönetici</span><span className="font-semibold text-slate-800">{adminName} ({adminEmail})</span></div>
                <div className="flex justify-between p-2 rounded-lg bg-white/60"><span className="text-slate-500">Lisans</span><span className="font-semibold text-slate-800">{useTrial ? '30 günlük deneme' : 'Anahtar girildi'}</span></div>
              </div>
              {error && <p className="text-sm text-red-500 font-bold mt-3">{error}</p>}
            </div>
          )}
        </div>

        {/* Gezinme */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100">
          <button onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || submitting} className="btn-secondary text-sm flex items-center gap-1 disabled:opacity-40"><ArrowLeft size={16} /> Geri</button>
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep((s) => s + 1)} disabled={!canNext()} className="btn-primary text-sm flex items-center gap-1 disabled:opacity-40">İleri <ArrowRight size={16} /></button>
          ) : (
            <button onClick={submit} disabled={submitting} className="btn-primary text-sm flex items-center gap-2">
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Kurulumu Tamamla
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;

// Enflow — Yedekleme / Geri Yükleme modülü (Backup Admin + GM)
// Sistemin yedeğini alır, doğrular, fark analizi ile geri yükler; zamanlama ayarı.
import React, { useState, useEffect, useCallback } from 'react';
import {
  DatabaseBackup, ShieldCheck, RotateCcw, Clock, Loader2, CheckCircle2,
  AlertCircle, Download, Play, HardDrive, Cloud, Server,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { BackupJob, RestoreJob, BackupSettings } from '../types';

type TabKey = 'jobs' | 'restore' | 'schedule';
const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'jobs', label: 'Yedekler', icon: DatabaseBackup },
  { key: 'restore', label: 'Geri Yükle', icon: RotateCcw },
  { key: 'schedule', label: 'Zamanlama', icon: Clock },
];

const fmtBytes = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`;
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleString('tr-TR') : '—';

const verifyBadge = (s: string) => {
  if (s === 'PASSED') return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600">✓ Doğrulandı</span>;
  if (s === 'FAILED') return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600">✗ Başarısız</span>;
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">⏳ Bekliyor</span>;
};
const statusBadge = (s: string) => {
  const tone = s === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-600' : s === 'FAILED' ? 'bg-red-500/10 text-red-600' : 'bg-sky-500/10 text-sky-600';
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tone}`}>{s}</span>;
};
const targetIcon = (t: string) => t === 'NEXTCLOUD' ? <Cloud className="w-3.5 h-3.5" /> : t === 'S3' ? <Server className="w-3.5 h-3.5" /> : <HardDrive className="w-3.5 h-3.5" />;

// Yetki header'lı indirme — tarayıcı navigasyonu x-tenant-id/Authorization gönderemez,
// bu yüzden blob'u fetch ile çekip client-side indir.
const downloadArtifact = async (id: string, artifact: 'data' | 'state') => {
  const tid = localStorage.getItem('enflow_active_tenant_id') || '';
  const token = localStorage.getItem('enflow_auth_token') || 'mock-token';
  const res = await fetch(`/api/backup/jobs/${id}/download?artifact=${artifact}`, {
    headers: { 'x-tenant-id': tid, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) { alert('İndirme başarısız: ' + res.status); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-${id}-${artifact}.${artifact === 'state' ? 'db' : 'json'}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const BackupModule = () => {
  const [tab, setTab] = useState<TabKey>('jobs');
  const [jobs, setJobs] = useState<BackupJob[]>([]);
  const [restores, setRestores] = useState<RestoreJob[]>([]);
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  // Yeni yedek formu
  const [form, setForm] = useState({ scope: 'PLATFORM', kind: 'FULL', targetType: 'LOCAL', location: '' });

  const load = useCallback(async () => {
    const [j, r] = await Promise.all([apiService.getBackupJobs(), apiService.getRestoreJobs()]);
    setJobs(j as BackupJob[]);
    setRestores(r as RestoreJob[]);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { apiService.getBackupSettings().then(s => setSettings(s as BackupSettings)).catch(() => undefined); }, []);

  const flash = (tone: 'ok' | 'err', text: string) => { setMsg({ tone, text }); setTimeout(() => setMsg(null), 4000); };

  const runBackup = async () => {
    setBusy('create');
    try {
      await apiService.createBackupJob(form);
      flash('ok', 'Yedek alındı.');
      await load();
    } catch (e) { flash('err', 'Yedek hatası: ' + (e instanceof Error ? e.message : '')); }
    finally { setBusy(null); }
  };

  const verify = async (id: string) => {
    setBusy('verify-' + id);
    try { const r = await apiService.verifyBackupJob(id) as { status: string }; flash(r.status === 'PASSED' ? 'ok' : 'err', `Doğrulama: ${r.status}`); await load(); }
    catch (e) { flash('err', 'Doğrulama hatası: ' + (e instanceof Error ? e.message : '')); }
    finally { setBusy(null); }
  };

  const startRestore = async (backupId: string) => {
    setBusy('analyze-' + backupId);
    try { await apiService.analyzeRestore(backupId); flash('ok', 'Fark analizi tamamlandı — Geri Yükle sekmesine bakın.'); await load(); setTab('restore'); }
    catch (e) { flash('err', 'Analiz hatası: ' + (e instanceof Error ? e.message : '')); }
    finally { setBusy(null); }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 h-full overflow-y-auto pb-24">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
          <DatabaseBackup className="w-6 h-6 text-indigo-500" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Yedekleme & Geri Yükleme</h2>
          <p className="text-sm text-slate-500">Sistem yedeği · doğrulama · fark analizli geri yükleme · zamanlama</p>
        </div>
      </div>

      {msg && (
        <div className={`text-sm px-4 py-2 rounded-xl flex items-center gap-2 ${msg.tone === 'ok' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-red-500/10 text-red-700'}`}>
          {msg.tone === 'ok' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {msg.text}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${tab === t.key ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'jobs' && (
        <JobsTab jobs={jobs} form={form} setForm={setForm} busy={busy} onRun={runBackup} onVerify={verify} onRestore={startRestore} />
      )}
      {tab === 'restore' && (
        <RestoreTab restores={restores} jobs={jobs} busy={busy} setBusy={setBusy} flash={flash} reload={load} />
      )}
      {tab === 'schedule' && (
        <ScheduleTab settings={settings} setSettings={setSettings} flash={flash} />
      )}
    </div>
  );
};

// ── Yedekler sekmesi ──────────────────────────────────────────────────────────
const JobsTab = ({ jobs, form, setForm, busy, onRun, onVerify, onRestore }: {
  jobs: BackupJob[]; form: { scope: string; kind: string; targetType: string; location: string };
  setForm: React.Dispatch<React.SetStateAction<{ scope: string; kind: string; targetType: string; location: string }>>;
  busy: string | null; onRun: () => void; onVerify: (id: string) => void; onRestore: (id: string) => void;
}) => (
  <div className="space-y-6">
    <div className="glass-card p-5 rounded-2xl border border-slate-200/60">
      <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><Play className="w-4 h-4 text-indigo-500" /> Şimdi Yedekle</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Select label="Kapsam" value={form.scope} onChange={v => setForm(f => ({ ...f, scope: v }))} options={[['PLATFORM', 'Platform (tüm DB)'], ['TENANT', 'Yalnız kiracı verisi']]} />
        <Select label="Tür" value={form.kind} onChange={v => setForm(f => ({ ...f, kind: v }))} options={[['FULL', 'Tam (state + veri)'], ['STATE', 'State (dosya)'], ['DATA', 'Veri (mantıksal)']]} />
        <Select label="Hedef" value={form.targetType} onChange={v => setForm(f => ({ ...f, targetType: v }))} options={[['LOCAL', 'Yerel dizin'], ['NEXTCLOUD', 'Nextcloud'], ['S3', 'S3 / uyumlu']]} />
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Lokasyon (ops.)</label>
          <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="dizin / prefix" className="input-glass w-full text-sm" />
        </div>
      </div>
      <button onClick={onRun} disabled={busy === 'create'} className="btn-primary text-sm mt-4 flex items-center gap-2">
        {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <DatabaseBackup className="w-4 h-4" />} Yedekle
      </button>
    </div>

    <div className="glass-card rounded-2xl border border-slate-200/60 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs">
          <tr>
            <th className="text-left px-4 py-3">Tarih</th><th className="text-left px-4 py-3">Kapsam / Tür</th>
            <th className="text-left px-4 py-3">Hedef</th><th className="text-left px-4 py-3">Boyut</th>
            <th className="text-left px-4 py-3">Durum</th><th className="text-left px-4 py-3">Doğrulama</th>
            <th className="text-right px-4 py-3">İşlem</th>
          </tr>
        </thead>
        <tbody>
          {jobs.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-8">Henüz yedek yok.</td></tr>}
          {jobs.map(j => (
            <tr key={j.id} className="border-t border-slate-100">
              <td className="px-4 py-3 text-slate-700">{fmtDate(j.startedAt)}<div className="text-[11px] text-slate-400">{j.trigger === 'SCHEDULED' ? 'Zamanlı' : 'Manuel'}{j.startedByName ? ` · ${j.startedByName}` : ''}</div></td>
              <td className="px-4 py-3"><span className="font-medium text-slate-800">{j.scope}</span> · {j.kind}<div className="text-[11px] text-slate-400">{j.dbProvider}</div></td>
              <td className="px-4 py-3"><span className="inline-flex items-center gap-1 text-slate-600">{targetIcon(j.targetType)} {j.targetType}</span></td>
              <td className="px-4 py-3 text-slate-600">{fmtBytes(j.sizeBytes)}</td>
              <td className="px-4 py-3">{statusBadge(j.status)}{j.error && <div className="text-[11px] text-red-500 max-w-[180px] truncate" title={j.error}>{j.error}</div>}</td>
              <td className="px-4 py-3">{verifyBadge(j.verifyStatus)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1.5">
                  <button onClick={() => onVerify(j.id)} disabled={busy === 'verify-' + j.id || j.status !== 'COMPLETED'} title="Doğrula" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 disabled:opacity-40">
                    {busy === 'verify-' + j.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  </button>
                  {j.targetType === 'LOCAL' && j.dataRef && (
                    <button onClick={() => downloadArtifact(j.id, 'data')} title="Veri indir (JSON)" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Download className="w-4 h-4" /></button>
                  )}
                  {j.targetType === 'LOCAL' && j.stateRef && (
                    <button onClick={() => downloadArtifact(j.id, 'state')} title="State indir (.db)" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><HardDrive className="w-4 h-4" /></button>
                  )}
                  <button onClick={() => onRestore(j.id)} disabled={busy === 'analyze-' + j.id || j.status !== 'COMPLETED' || !j.dataRef} title="Geri yükle (analiz)" className="p-1.5 rounded-lg hover:bg-slate-100 text-indigo-500 disabled:opacity-40">
                    {busy === 'analyze-' + j.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ── Geri Yükle sekmesi ────────────────────────────────────────────────────────
const RestoreTab = ({ restores, busy, setBusy, flash, reload }: {
  restores: RestoreJob[]; jobs: BackupJob[]; busy: string | null;
  setBusy: (s: string | null) => void; flash: (t: 'ok' | 'err', s: string) => void; reload: () => Promise<void>;
}) => {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const confirm = async (id: string, mode: 'LOGICAL' | 'STATE') => {
    setBusy('restore-' + id); setConfirmId(null);
    try { await apiService.confirmRestore(id, mode); flash('ok', mode === 'STATE' ? 'State dosyası hazırlandı (kontrollü restart gerekir).' : 'Geri yükleme tamamlandı.'); await reload(); }
    catch (e) { flash('err', 'Geri yükleme hatası: ' + (e instanceof Error ? e.message : '')); }
    finally { setBusy(null); }
  };

  return (
    <div className="space-y-4">
      {restores.length === 0 && <div className="glass-card p-8 rounded-2xl text-center text-slate-400">Henüz geri yükleme analizi yok. <b>Yedekler</b> sekmesinden bir yedeği "Geri Yükle" ile analiz edin.</div>}
      {restores.map(r => {
        const diff = r.diffReport ? JSON.parse(r.diffReport) as { totalModelsWithDiff: number; scope: string; models: Record<string, { added: number; removed: number; changed: number }> } : null;
        return (
          <div key={r.id} className="glass-card p-5 rounded-2xl border border-slate-200/60">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="font-bold text-slate-900">Geri Yükleme · {fmtDate(r.startedAt)}</div>
                <div className="text-xs text-slate-500">Yedek: {r.backupId.slice(0, 8)}… · {statusBadge(r.status)} {r.preRestoreBackupId && <span className="ml-1 text-emerald-600">· güvenlik snapshot alındı</span>}</div>
              </div>
              {r.status === 'AWAITING_CONFIRM' && (
                <div className="flex gap-2">
                  <button onClick={() => setConfirmId(r.id)} disabled={busy === 'restore-' + r.id} className="btn-primary text-sm flex items-center gap-2">
                    {busy === 'restore-' + r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Geri Yükle (Onayla)
                  </button>
                </div>
              )}
            </div>

            {diff && (
              <div className="mt-4">
                <div className="text-sm text-slate-600 mb-2">Fark: <b>{diff.totalModelsWithDiff}</b> modelde değişiklik (kapsam: {diff.scope})</div>
                {diff.totalModelsWithDiff === 0 ? (
                  <div className="text-sm text-emerald-600">Mevcut veri yedekle birebir aynı — geri yükleme gereksiz.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {Object.entries(diff.models).map(([model, d]) => (
                      <div key={model} className="text-xs bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                        <div className="font-semibold text-slate-700">{model}</div>
                        <div className="flex gap-3 mt-1">
                          <span className="text-emerald-600">+{d.added}</span>
                          <span className="text-red-500">−{d.removed}</span>
                          <span className="text-amber-600">~{d.changed}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {confirmId === r.id && (
              <div className="mt-4 p-4 rounded-xl bg-amber-500/5 border border-amber-300/40">
                <div className="text-sm text-amber-800 flex items-center gap-2 mb-3"><AlertCircle className="w-4 h-4" /> Bu işlem mevcut veriyi yedekteki haliyle değiştirir. Önce otomatik güvenlik snapshot alınır. Devam?</div>
                <div className="flex gap-2">
                  <button onClick={() => confirm(r.id, 'LOGICAL')} className="btn-primary text-sm">Mantıksal Geri Yükle</button>
                  <button onClick={() => confirm(r.id, 'STATE')} className="btn-secondary text-sm">State Dosyası Hazırla</button>
                  <button onClick={() => setConfirmId(null)} className="btn-secondary text-sm">Vazgeç</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Zamanlama sekmesi ─────────────────────────────────────────────────────────
const ScheduleTab = ({ settings, setSettings, flash }: {
  settings: BackupSettings | null; setSettings: (s: BackupSettings) => void; flash: (t: 'ok' | 'err', s: string) => void;
}) => {
  const [saving, setSaving] = useState(false);
  if (!settings) return <div className="glass-card p-8 rounded-2xl text-center text-slate-400">Yükleniyor…</div>;
  const s = settings;
  const upd = (patch: Partial<BackupSettings>) => setSettings({ ...s, ...patch });

  const save = async () => {
    setSaving(true);
    try {
      const res = await apiService.updateBackupSettings({
        enabled: s.enabled, intervalHours: s.intervalHours, scope: s.scope, kind: s.kind,
        targetType: s.targetType, location: s.location,
        nextcloud: { url: s.nextcloud.url, username: s.nextcloud.username, folder: s.nextcloud.folder, appPassword: (s.nextcloud as { appPassword?: string }).appPassword },
        s3: { endpoint: s.s3.endpoint, region: s.s3.region, bucket: s.s3.bucket, prefix: s.s3.prefix, accessKeyId: s.s3.accessKeyId, secretAccessKey: (s.s3 as { secretAccessKey?: string }).secretAccessKey },
      });
      setSettings(res as BackupSettings);
      flash('ok', 'Zamanlama ayarları kaydedildi.');
    } catch (e) { flash('err', 'Kaydetme hatası: ' + (e instanceof Error ? e.message : '')); }
    finally { setSaving(false); }
  };

  return (
    <div className="glass-card p-6 rounded-2xl border border-slate-200/60 max-w-2xl space-y-5">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-indigo-500" />
        <h3 className="font-bold text-slate-900">Otomatik Yedekleme Zamanlaması</h3>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={s.enabled} onChange={e => upd({ enabled: e.target.checked })} /> Otomatik yedeklemeyi etkinleştir
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Aralık (saat) — eşik değer</label>
          <input type="number" min={1} value={s.intervalHours} onChange={e => upd({ intervalHours: Number(e.target.value) })} className="input-glass w-full text-sm" />
        </div>
        <Select label="Kapsam" value={s.scope} onChange={v => upd({ scope: v as BackupSettings['scope'] })} options={[['PLATFORM', 'Platform (tüm DB)'], ['TENANT', 'Yalnız kiracı']]} />
        <Select label="Tür" value={s.kind} onChange={v => upd({ kind: v as BackupSettings['kind'] })} options={[['FULL', 'Tam'], ['STATE', 'State'], ['DATA', 'Veri']]} />
        <Select label="Hedef" value={s.targetType} onChange={v => upd({ targetType: v as BackupSettings['targetType'] })} options={[['LOCAL', 'Yerel'], ['NEXTCLOUD', 'Nextcloud'], ['S3', 'S3']]} />
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Lokasyon (dizin / prefix)</label>
          <input value={s.location} onChange={e => upd({ location: e.target.value })} className="input-glass w-full text-sm" />
        </div>
      </div>

      {s.targetType === 'NEXTCLOUD' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
          <Field label="Nextcloud URL" value={s.nextcloud.url} onChange={v => upd({ nextcloud: { ...s.nextcloud, url: v } })} />
          <Field label="Kullanıcı" value={s.nextcloud.username} onChange={v => upd({ nextcloud: { ...s.nextcloud, username: v } })} />
          <Field label="Klasör" value={s.nextcloud.folder} onChange={v => upd({ nextcloud: { ...s.nextcloud, folder: v } })} />
          <Field label={`App Şifre ${s.nextcloud.hasPassword ? '(kayıtlı)' : ''}`} type="password" value={(s.nextcloud as { appPassword?: string }).appPassword || ''} onChange={v => upd({ nextcloud: { ...s.nextcloud, appPassword: v } as BackupSettings['nextcloud'] })} placeholder={s.nextcloud.hasPassword ? '•••••• (değiştirmek için gir)' : ''} />
        </div>
      )}
      {s.targetType === 'S3' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
          <Field label="Endpoint (ops.)" value={s.s3.endpoint} onChange={v => upd({ s3: { ...s.s3, endpoint: v } })} />
          <Field label="Region" value={s.s3.region} onChange={v => upd({ s3: { ...s.s3, region: v } })} />
          <Field label="Bucket" value={s.s3.bucket} onChange={v => upd({ s3: { ...s.s3, bucket: v } })} />
          <Field label="Prefix" value={s.s3.prefix} onChange={v => upd({ s3: { ...s.s3, prefix: v } })} />
          <Field label="Access Key" value={s.s3.accessKeyId} onChange={v => upd({ s3: { ...s.s3, accessKeyId: v } })} />
          <Field label={`Secret ${s.s3.hasSecret ? '(kayıtlı)' : ''}`} type="password" value={(s.s3 as { secretAccessKey?: string }).secretAccessKey || ''} onChange={v => upd({ s3: { ...s.s3, secretAccessKey: v } as BackupSettings['s3'] })} placeholder={s.s3.hasSecret ? '•••••• (değiştirmek için gir)' : ''} />
        </div>
      )}

      <button onClick={save} disabled={saving} className="btn-primary text-sm flex items-center gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Kaydet
      </button>
      <p className="text-[11px] text-slate-400">Not: Bu eşik değer Şirket Profili sayfasından da düzenlenebilir. Zamanlayıcı süreç çalışırken aktiftir.</p>
    </div>
  );
};

// ── Küçük ortak bileşenler ────────────────────────────────────────────────────
const Select = ({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)} className="input-glass w-full text-sm">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  </div>
);
const Field = ({ label, value, onChange, type, placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
    <input type={type || 'text'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" className="input-glass w-full text-sm" />
  </div>
);

export default BackupModule;

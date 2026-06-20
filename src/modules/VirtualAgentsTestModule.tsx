import React, { useState, useEffect, useCallback } from 'react';
import {
  Bot, KeyRound, Power, PlayCircle, CheckCircle2, XCircle, AlertTriangle,
  Sparkles, Clock, Hash, ShieldCheck, Zap, Lightbulb, Wand2, Copy, ArrowDownToLine,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import { EntitlementWithCatalog, PluginDefinition, AgentRun } from '../types';
import { isAgentActor } from '../lib/agentProvenance';

// ── Sanal Agent Test Modülü (Faz 8) ──────────────────────────────────────────
// Çekirdek ticari sürümün DIŞINDA, ayrı lisanslanan upsell eklentileri.
// Boş koltuğu dolduran vekil: bir birimin işini yapar, gerçek kişiye devreder.
// Yalnızca GENERAL_MANAGER görür (Test Ortamı). Açık tema.

type TabKey = 'catalog' | 'runs';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'catalog', label: 'Eklenti Kataloğu', icon: <Sparkles size={16} /> },
  { key: 'runs', label: 'Çalıştırmalar', icon: <PlayCircle size={16} /> },
];

const RUN_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING_RATIFICATION: { label: 'Onay Bekliyor', cls: 'bg-amber-100 text-amber-700' },
  RATIFIED: { label: 'Onaylandı', cls: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: 'Reddedildi', cls: 'bg-red-100 text-red-700' },
};

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const VirtualAgentsTestModule = () => {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState<TabKey>('catalog');
  const [items, setItems] = useState<EntitlementWithCatalog[]>([]);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // license generation (satıcı/yönetici konsolu)
  const [genPlugin, setGenPlugin] = useState<string>('');
  const [genDays, setGenDays] = useState<string>('365');
  const [genKey, setGenKey] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // license activation
  const [licenseKey, setLicenseKey] = useState('');

  // run form
  const [runPlugin, setRunPlugin] = useState<string>('');
  const [runEntityId, setRunEntityId] = useState('');

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const data: EntitlementWithCatalog[] = await apiService.getPluginEntitlements();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setError('Katalog yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRuns = useCallback(async () => {
    try {
      const data: AgentRun[] = await apiService.getAgentRuns();
      setRuns(Array.isArray(data) ? data : []);
    } catch {
      setError('Çalıştırmalar yüklenemedi.');
    }
  }, []);

  useEffect(() => { loadCatalog(); loadRuns(); }, [loadCatalog, loadRuns]);

  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(null), 3500); };

  const handleGenerate = async () => {
    setError(null);
    setGenKey('');
    setCopied(false);
    if (!genPlugin) { setError('Önce bir eklenti seçin.'); return; }
    const days = genDays.trim() === '' ? 0 : parseInt(genDays, 10);
    if (genDays.trim() !== '' && (Number.isNaN(days) || days < 0)) { setError('Geçersiz gün değeri.'); return; }
    try {
      const res = await apiService.generatePluginLicenseKey(genPlugin, days);
      if (res?.ok && res.licenseKey) {
        setGenKey(res.licenseKey);
        flash('Lisans anahtarı üretildi.');
      } else {
        setError(res?.error || 'Anahtar üretilemedi.');
      }
    } catch {
      setError('Anahtar üretilemedi.');
    }
  };

  const handleCopyKey = async () => {
    if (!genKey) return;
    try { await navigator.clipboard.writeText(genKey); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  };

  const handleUseKey = () => {
    if (!genKey) return;
    setLicenseKey(genKey);
    flash('Anahtar aktivasyon alanına aktarıldı.');
  };

  const handleActivate = async () => {
    setError(null);
    if (!licenseKey.trim()) { setError('Lisans anahtarı girin.'); return; }
    try {
      const res = await apiService.activatePluginLicense(licenseKey.trim(), currentUser?.id);
      if (res?.ok) {
        flash(`Lisans etkin: ${res.pluginKey}`);
        setLicenseKey('');
        await loadCatalog();
      } else {
        setError(res?.error || 'Aktivasyon başarısız.');
      }
    } catch {
      setError('Geçersiz lisans anahtarı.');
    }
  };

  const handleSetMode = async (pluginKey: string, mode: 'ADVISORY' | 'AUTONOMOUS') => {
    setError(null);
    try {
      const res = await apiService.updatePluginEntitlement(pluginKey, { mode });
      if (res?.ok) { flash('Mod güncellendi.'); await loadCatalog(); }
      else setError(res?.error || 'Mod değiştirilemedi.');
    } catch {
      setError('Bu eklenti için bu mod izinli değil.');
    }
  };

  const handleDisable = async (pluginKey: string) => {
    try {
      await apiService.disablePluginEntitlement(pluginKey);
      flash('Lisans devre dışı bırakıldı.');
      await loadCatalog();
    } catch {
      setError('Devre dışı bırakılamadı.');
    }
  };

  const handleRun = async () => {
    setError(null);
    if (!runPlugin || !runEntityId.trim()) { setError('Eklenti ve varlık ID gerekli.'); return; }
    try {
      const res = await apiService.runAgent(runPlugin, runEntityId.trim(), currentUser?.id);
      if (res?.error) { setError(res.error); return; }
      flash('Agent çalıştı — çıktı onay bekliyor.');
      setRunEntityId('');
      await loadRuns();
      setTab('runs');
    } catch (e) {
      // 402 = lisans yok (upsell sinyali)
      setError('Çalıştırılamadı — bu eklenti için aktif lisans olmayabilir (upsell).');
    }
  };

  const handleRatify = async (id: string, decision: 'RATIFY' | 'REJECT') => {
    try {
      const res = await apiService.ratifyAgentRun(id, { decision, ratifiedById: currentUser?.id });
      if (res?.ok) { flash(decision === 'RATIFY' ? 'Çıktı onaylandı.' : 'Çıktı reddedildi.'); await loadRuns(); }
      else setError(res?.error || 'İşlem başarısız.');
    } catch {
      setError('Ratifikasyon başarısız.');
    }
  };

  // AVAILABLE = handler hazır (AGENT_TENDER/AGENT_PROJECT); entitlement objesi
  // hasHandler taşımadığı için status üzerinden çözülür.
  const availablePlugins = items.filter((i) => i.active && i.plugin.status === 'AVAILABLE');

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Bot size={22} className="text-primary" />
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Sanal Agentlar</h1>
            <span className="text-[9px] px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 font-black uppercase tracking-widest">Test · Eklenti</span>
          </div>
          <p className="text-sm text-slate-500 max-w-2xl">
            Boş birim koltuğunu dolduran vekiller. Ticari sürümün dışında, <strong>ayrı lisansla</strong> devreye alınır.
            Danışman modunda çıktı üretip gerçek kişiye onaya devreder — akış sağlıklı sürer.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              tab === t.key
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-100'
            }`}
          >
            {t.icon}{t.label}
            {t.key === 'runs' && runs.some((r) => r.status === 'PENDING_RATIFICATION') && (
              <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-400 text-white font-black">
                {runs.filter((r) => r.status === 'PENDING_RATIFICATION').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 text-red-700 text-sm border border-red-100">
            <AlertTriangle size={16} /> {error}
          </motion.div>
        )}
        {notice && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 text-sm border border-emerald-100">
            <CheckCircle2 size={16} /> {notice}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CATALOG ─────────────────────────────────────────────── */}
      {tab === 'catalog' && (
        <div className="space-y-5">
          {/* License generation — satıcı/yönetici konsolu (GM-only) */}
          <div className="glass-card rounded-2xl p-4 border border-amber-200/60 bg-amber-50/30">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Wand2 size={16} className="text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">Lisans Anahtarı Üret</h3>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200 font-black uppercase tracking-widest">GM Only</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <select value={genPlugin} onChange={(e) => setGenPlugin(e.target.value)} className="input-glass text-sm sm:w-72">
                <option value="">Eklenti seç…</option>
                {items.map((i) => (
                  <option key={i.plugin.key} value={i.plugin.key}>{i.plugin.name} ({i.plugin.key})</option>
                ))}
              </select>
              <div className="relative sm:w-44">
                <input
                  type="number"
                  min={0}
                  value={genDays}
                  onChange={(e) => setGenDays(e.target.value)}
                  placeholder="Gün (boş=süresiz)"
                  className="input-glass w-full text-sm pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">GÜN</span>
              </div>
              <button onClick={handleGenerate} className="btn-primary text-sm whitespace-nowrap flex items-center gap-1.5">
                <Wand2 size={14} /> Üret
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              İmzalı anahtar (HMAC). Gün boş bırakılırsa süresiz lisans. Üretilen anahtarı kopyalayıp müşteriye iletin veya aşağıdaki aktivasyona aktarın.
            </p>
            {genKey && (
              <div className="mt-3 p-3 rounded-xl bg-slate-900 flex flex-col sm:flex-row sm:items-center gap-2">
                <code className="flex-1 text-[12px] font-mono text-emerald-300 break-all">{genKey}</code>
                <div className="flex gap-2 shrink-0">
                  <button onClick={handleCopyKey} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-white/10 text-white hover:bg-white/20">
                    {copied ? <><CheckCircle2 size={13} /> Kopyalandı</> : <><Copy size={13} /> Kopyala</>}
                  </button>
                  <button onClick={handleUseKey} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-primary text-white hover:opacity-90">
                    <ArrowDownToLine size={13} /> Aktivasyona aktar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* License activation */}
          <div className="glass-card rounded-2xl p-4 border border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <KeyRound size={16} className="text-primary" />
              <h3 className="font-bold text-slate-900 text-sm">Lisans Aktivasyonu</h3>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="ENF-PLUGIN-AGENT_TENDER-365"
                className="input-glass flex-1 text-sm font-mono"
              />
              <button onClick={handleActivate} className="btn-primary text-sm whitespace-nowrap">
                Lisansı Etkinleştir
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-2">
              Anahtar formatı: <code>ENF-PLUGIN-&lt;EKLENTİ&gt;[-&lt;gün&gt;]</code>. Onay mekanizmasının içindeki tek lisans kapısı.
            </p>
          </div>

          {loading && <p className="text-sm text-slate-400">Yükleniyor…</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {items.map(({ plugin, entitlement, active }) => (
              <PluginCard
                key={plugin.key}
                plugin={plugin}
                active={active}
                mode={entitlement?.mode}
                expiresAt={entitlement?.expiresAt}
                onSetMode={handleSetMode}
                onDisable={handleDisable}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── RUNS ────────────────────────────────────────────────── */}
      {tab === 'runs' && (
        <div className="space-y-5">
          {/* Run form */}
          <div className="glass-card rounded-2xl p-4 border border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-primary" />
              <h3 className="font-bold text-slate-900 text-sm">Agent Çalıştır</h3>
            </div>
            {availablePlugins.length === 0 ? (
              <p className="text-sm text-amber-600 flex items-center gap-2">
                <AlertTriangle size={15} /> Çalıştırılabilir (lisanslı + hazır) eklenti yok. Önce katalogdan lisans etkinleştirin.
              </p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <select value={runPlugin} onChange={(e) => setRunPlugin(e.target.value)} className="input-glass text-sm sm:w-64">
                  <option value="">Eklenti seç…</option>
                  {availablePlugins.map((i) => (
                    <option key={i.plugin.key} value={i.plugin.key}>{i.plugin.name}</option>
                  ))}
                </select>
                <input
                  value={runEntityId}
                  onChange={(e) => setRunEntityId(e.target.value)}
                  placeholder="Varlık ID (örn. ihale/proje id)"
                  className="input-glass flex-1 text-sm font-mono"
                />
                <button onClick={handleRun} className="btn-primary text-sm whitespace-nowrap">Çalıştır</button>
              </div>
            )}
          </div>

          {runs.length === 0 ? (
            <p className="text-sm text-slate-400">Henüz çalıştırma yok.</p>
          ) : (
            <div className="space-y-3">
              {runs.map((run) => (
                <RunCard key={run.id} run={run} onRatify={handleRatify} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Plugin Card ───────────────────────────────────────────────────────────────
const PluginCard: React.FC<{
  plugin: PluginDefinition;
  active: boolean;
  mode?: string;
  expiresAt?: string | null;
  onSetMode: (key: string, mode: 'ADVISORY' | 'AUTONOMOUS') => void;
  onDisable: (key: string) => void;
}> = ({ plugin, active, mode, expiresAt, onSetMode, onDisable }) => {
  const comingSoon = plugin.status === 'COMING_SOON';
  const advisoryOnly = plugin.allowedModes?.length === 1 && plugin.allowedModes[0] === 'ADVISORY';
  return (
    <div className={`glass-card rounded-2xl p-4 border ${active ? 'border-primary/30' : 'border-slate-100'} ${comingSoon ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${active ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-400'}`}>
            <Bot size={18} />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 text-sm leading-tight">{plugin.name}</h4>
            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">{plugin.key}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {active
            ? <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-black uppercase tracking-widest">Aktif</span>
            : <span className="text-[9px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-black uppercase tracking-widest">Pasif</span>}
          {comingSoon && <span className="text-[9px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-500 font-black uppercase tracking-widest">Yakında</span>}
          {!comingSoon && !active && <span className="text-[9px] px-2 py-0.5 rounded bg-amber-50 text-amber-600 font-black uppercase tracking-widest">Hazır</span>}
        </div>
      </div>

      <p className="text-xs text-slate-600 mb-3 leading-relaxed">{plugin.description}</p>

      <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-3">
        {plugin.role && <span className="px-2 py-0.5 rounded bg-slate-100 font-bold">{plugin.role}</span>}
        {plugin.entityType && <span className="px-2 py-0.5 rounded bg-slate-100 font-bold">{plugin.entityType}</span>}
        {advisoryOnly && (
          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-600 font-bold flex items-center gap-1">
            <ShieldCheck size={11} /> Sadece danışman
          </span>
        )}
      </div>

      {active ? (
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Mod:</span>
            <div className="flex rounded-lg overflow-hidden border border-slate-200">
              {(['ADVISORY', 'AUTONOMOUS'] as const).map((m) => {
                const allowed = !plugin.allowedModes || plugin.allowedModes.includes(m);
                return (
                  <button
                    key={m}
                    disabled={!allowed}
                    onClick={() => onSetMode(plugin.key, m)}
                    title={!allowed ? 'Bu eklenti için izinli değil' : ''}
                    className={`px-2 py-1 text-[10px] font-bold transition-all ${
                      mode === m ? 'bg-primary text-white' : allowed ? 'bg-white text-slate-500 hover:text-slate-900' : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                    }`}
                  >
                    {m === 'ADVISORY' ? 'Danışman' : 'Otonom'}
                  </button>
                );
              })}
            </div>
          </div>
          <button onClick={() => onDisable(plugin.key)} className="flex items-center gap-1 text-[10px] text-red-500 hover:text-red-700 font-bold">
            <Power size={13} /> Devre dışı
          </button>
        </div>
      ) : (
        <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400">
          {comingSoon ? 'Altyapı hazır — handler sonraki fazda.' : 'Lisans etkinleştirildiğinde devreye girer.'}
        </div>
      )}
      {active && expiresAt && (
        <p className="text-[9px] text-slate-400 mt-2 flex items-center gap-1"><Clock size={10} /> Bitiş: {fmtDate(expiresAt)}</p>
      )}
    </div>
  );
};

// ── Run Card ──────────────────────────────────────────────────────────────────
const RunCard: React.FC<{ run: AgentRun; onRatify: (id: string, d: 'RATIFY' | 'REJECT') => void }> = ({ run, onRatify }) => {
  const st = RUN_STATUS[run.status] || { label: run.status, cls: 'bg-slate-100 text-slate-600' };
  let output: Record<string, unknown> = {};
  try { output = run.outputJson ? JSON.parse(run.outputJson) : {}; } catch { /* ignore */ }
  return (
    <div className="glass-card rounded-2xl p-4 border border-slate-100">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Bot size={16} /></div>
          <div>
            <p className="font-bold text-slate-900 text-sm">{run.pluginKey}</p>
            <p className="text-[10px] text-slate-400 font-mono">{run.entityType} · {run.entityId}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-widest ${st.cls}`}>{st.label}</span>
          <span className="text-[9px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-bold">{run.mode === 'AUTONOMOUS' ? 'Otonom' : 'Danışman'}</span>
        </div>
      </div>

      {run.rationale && (
        <div className="flex gap-2 text-xs text-slate-600 bg-slate-50 rounded-xl p-3 mb-2">
          <Lightbulb size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{run.rationale}</span>
        </div>
      )}

      {run.actionTaken && (
        <div className="flex gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-xl p-3 mb-2 font-semibold">
          <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
          <span className="leading-relaxed">Otonom eylem: {run.actionTaken}</span>
        </div>
      )}

      {!!Object.keys(output).length && (
        <details className="mb-2">
          <summary className="text-[11px] text-slate-400 cursor-pointer font-bold">Yapısal çıktı</summary>
          <pre className="text-[10px] text-slate-500 bg-slate-50 rounded-lg p-2 mt-1 overflow-x-auto">{JSON.stringify(output, null, 2)}</pre>
        </details>
      )}

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
        <span className="text-[10px] text-slate-400 flex items-center gap-1"><Clock size={11} /> {fmtDate(run.createdAt)}</span>
        {run.status === 'PENDING_RATIFICATION' ? (
          <div className="flex gap-2">
            <button onClick={() => onRatify(run.id, 'REJECT')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100">
              <XCircle size={14} /> Reddet
            </button>
            <button onClick={() => onRatify(run.id, 'RATIFY')} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-primary hover:opacity-90">
              <CheckCircle2 size={14} /> Onayla & Devral
            </button>
          </div>
        ) : (
          <span className="text-[10px] text-slate-400">{run.ratifyNote || (isAgentActor(run.ratifiedById) ? 'Otonom onay' : 'İşlendi')}</span>
        )}
      </div>
    </div>
  );
};

export default VirtualAgentsTestModule;

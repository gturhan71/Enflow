import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, ShieldAlert, Play, RefreshCw, CheckCircle2,
  XCircle, Minus, Clock, AlertTriangle, ArrowLeft, ChevronDown, ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiClient } from '../services/apiClient';

// ── Tipler ────────────────────────────────────────────────────────────────
interface PwSpec {
  title: string;
  tests: { results: { status: string; duration: number; errors?: { message?: string }[] }[] }[];
}
interface PwSuite { title: string; specs?: PwSpec[]; suites?: PwSuite[] }
interface PwStats {
  startTime: string;
  duration: number;
  expected: number;
  unexpected: number;
  skipped: number;
}
interface PwJson { suites: PwSuite[]; stats: PwStats }

interface FlatSpec {
  file: string;
  suite: string;
  title: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  duration: number;
  error?: string;
}

const FILE_LABELS: Record<string, string> = {
  'auth/auth.setup.ts':             'Kimlik Doğrulama Setup',
  'tests/api-permissions.spec.ts':  'API Yetki Matrisi',
  'tests/tenant-isolation.spec.ts': 'Tenant İzolasyonu (IDOR)',
  'tests/ui-access.spec.ts':        'UI Erişim Kontrolü',
};

// ── Yardımcılar ───────────────────────────────────────────────────────────
function flattenSuite(file: string, suite: PwSuite, stack: string[] = []): FlatSpec[] {
  const out: FlatSpec[] = [];
  const cur = [...stack, ...(suite.title && suite.title !== file ? [suite.title] : [])];
  for (const spec of suite.specs ?? []) {
    const attempt = spec.tests[0]?.results[0];
    if (!attempt) continue;
    out.push({
      file,
      suite:    cur.join(' › '),
      title:    spec.title,
      status:   attempt.status as FlatSpec['status'],
      duration: attempt.duration,
      error:    attempt.errors?.[0]?.message?.replace(/\x1B\[[0-9;]*m/g, '').slice(0, 300),
    });
  }
  for (const sub of suite.suites ?? []) out.push(...flattenSuite(file, sub, cur));
  return out;
}

function parseResults(data: PwJson): { specs: FlatSpec[]; byFile: Map<string, FlatSpec[]> } {
  const specs: FlatSpec[] = [];
  for (const top of data.suites) specs.push(...flattenSuite(top.title, top));
  const byFile = new Map<string, FlatSpec[]>();
  for (const s of specs) {
    if (!byFile.has(s.file)) byFile.set(s.file, []);
    byFile.get(s.file)!.push(s);
  }
  return { specs, byFile };
}

// ── Küçük bileşenler ──────────────────────────────────────────────────────
const StatusIcon = ({ status }: { status: FlatSpec['status'] }) => {
  if (status === 'passed')  return <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />;
  if (status === 'skipped') return <Minus size={14} className="text-slate-400 shrink-0" />;
  return <XCircle size={14} className="text-red-500 shrink-0" />;
};

// ── Bekleme Ekranı ────────────────────────────────────────────────────────
const RunningScreen: React.FC = () => {
  const steps = [
    'Test ortamı hazırlanıyor…',
    'Playwright başlatılıyor…',
    'Kimlik doğrulama testleri çalışıyor…',
    'API yetki matrisi kontrol ediliyor…',
    'Tenant izolasyonu (IDOR) test ediliyor…',
    'UI erişim kontrolleri yapılıyor…',
    'Sonuçlar derleniyor…',
  ];
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep(s => (s + 1) % steps.length), 3500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="fixed inset-0 z-[300] bg-slate-900/95 backdrop-blur-2xl flex flex-col items-center justify-center gap-10">
      {/* Spinner */}
      <div className="relative w-32 h-32">
        <motion.div
          className="absolute inset-0 rounded-full border-4 border-amber-500/20"
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-2 rounded-full border-4 border-t-amber-500 border-r-amber-500/40 border-b-transparent border-l-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <ShieldCheck size={36} className="text-amber-500" />
        </div>
      </div>

      {/* Başlık */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">
          Güvenlik Testi Çalışıyor
        </h2>
        <p className="text-slate-400 text-sm">Bu işlem yaklaşık 40–60 saniye sürer.</p>
      </div>

      {/* Adım göstergesi */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35 }}
          className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-2xl px-6 py-3"
        >
          <RefreshCw size={14} className="text-amber-400 animate-spin shrink-0" />
          <span className="text-sm text-slate-300 font-medium">{steps[step]}</span>
        </motion.div>
      </AnimatePresence>

      {/* İlerleme çubuğu */}
      <div className="w-72 h-1 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    </div>
  );
};

// ── Rapor Penceresi ───────────────────────────────────────────────────────
interface ReportProps {
  data: PwJson;
  onDone: () => void;
}

const ReportScreen: React.FC<ReportProps> = ({ data, onDone }) => {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  const { specs, byFile } = parseResults(data);
  const stats   = data.stats;
  const passed  = specs.filter(s => s.status === 'passed').length;
  const failed  = specs.filter(s => s.status === 'failed' || s.status === 'timedOut').length;
  const skipped = specs.filter(s => s.status === 'skipped').length;
  const total   = specs.length;
  const allGood = failed === 0 && total > 0;
  const durationSec = (stats.duration / 1000).toFixed(1);
  const runDate = new Date(stats.startTime).toLocaleString('tr-TR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const toggleFile = (file: string) => setExpandedFiles(prev => {
    const next = new Set(prev);
    next.has(file) ? next.delete(file) : next.add(file);
    return next;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[300] bg-slate-900/95 backdrop-blur-2xl overflow-y-auto"
    >
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Header kartı */}
        <div className={`rounded-[24px] overflow-hidden border ${allGood ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-red-500/30 bg-red-500/10'}`}>
          <div className="px-8 py-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {allGood
                ? <ShieldCheck size={40} className="text-emerald-400 shrink-0" />
                : <ShieldAlert size={40} className="text-red-400 shrink-0" />}
              <div>
                <h1 className="text-xl font-black text-white uppercase tracking-tight">
                  {allGood ? 'Tüm Testler Geçti — Sistem Güvenli' : `${failed} Test Başarısız`}
                </h1>
                <p className="text-sm text-slate-400 mt-0.5">Son çalışma: {runDate}</p>
              </div>
            </div>

            <button
              onClick={onDone}
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-black text-xs uppercase tracking-widest transition-all shrink-0"
            >
              <ArrowLeft size={14} />
              Test Bitti
            </button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-white/10 border-t border-white/10">
            {[
              { label: 'Toplam',    value: total,         color: 'text-white' },
              { label: 'Geçti',     value: passed,        color: 'text-emerald-400' },
              { label: 'Başarısız', value: failed,        color: failed > 0 ? 'text-red-400' : 'text-slate-500' },
              { label: 'Atlandı',   value: skipped,       color: 'text-slate-400' },
              { label: 'Süre',      value: durationSec + 's', color: 'text-amber-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="py-5 text-center">
                <div className={`text-3xl font-black ${color}`}>{value}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Dosya kartları */}
        <div className="space-y-3">
          {Array.from(byFile.entries()).map(([file, fileSpecs]) => {
            const fileFail = fileSpecs.filter(s => s.status === 'failed' || s.status === 'timedOut').length;
            const filePass = fileSpecs.filter(s => s.status === 'passed').length;
            const isExpanded = expandedFiles.has(file);

            return (
              <div key={file} className="rounded-[20px] border border-white/10 bg-white/5 overflow-hidden">
                <button
                  onClick={() => toggleFile(file)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {fileFail === 0
                      ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      : <XCircle size={16} className="text-red-500 shrink-0" />}
                    <span className="font-bold text-sm text-white">
                      {FILE_LABELS[file] ?? file}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {fileFail === 0
                      ? <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                          ✓ {filePass}/{fileSpecs.length}
                        </span>
                      : <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-lg">
                          ✗ {fileFail} hata — {filePass}/{fileSpecs.length}
                        </span>}
                    {isExpanded
                      ? <ChevronUp size={14} className="text-slate-400" />
                      : <ChevronDown size={14} className="text-slate-400" />}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-white/10">
                        {fileSpecs.map((spec, i) => {
                          const isFail = spec.status === 'failed' || spec.status === 'timedOut';
                          return (
                            <div
                              key={i}
                              className={`px-6 py-3 flex items-start gap-3 border-b border-white/5 last:border-0 ${isFail ? 'bg-red-500/5' : ''}`}
                            >
                              <StatusIcon status={spec.status} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-baseline gap-2 flex-wrap">
                                  {spec.suite && (
                                    <span className="text-[10px] text-slate-500 shrink-0">{spec.suite}</span>
                                  )}
                                  <span className="text-xs text-slate-300">{spec.title}</span>
                                </div>
                                {spec.error && (
                                  <p className="text-[11px] text-red-400 font-mono mt-1 break-all">{spec.error}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0 text-[10px] text-slate-500">
                                <Clock size={10} />
                                {spec.duration}ms
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Alt "Test Bitti" butonu */}
        <div className="flex justify-center pt-4 pb-8">
          <button
            onClick={onDone}
            className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/30"
          >
            <CheckCircle2 size={18} />
            Test Bitti — Dashboard'a Dön
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ── Ana modül ─────────────────────────────────────────────────────────────
interface Props {
  onDone: () => void;
}

type View = 'idle' | 'running' | 'report';

export const SecurityTestModule: React.FC<Props> = ({ onDone }) => {
  const [view, setView]   = useState<View>('idle');
  const [data, setData]   = useState<PwJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadResults = useCallback(async () => {
    try {
      const res = await apiClient.fetchWithAuth('/admin/security-test/results');
      if (res.hasResults) setData(res.data);
    } catch { /* sessiz */ }
  }, []);

  useEffect(() => { loadResults(); }, [loadResults]);

  const handleRun = async () => {
    setView('running');
    setError(null);
    try {
      const res = await apiClient.fetchWithAuth('/admin/security-test/run', { method: 'POST' });
      if (res.hasResults) {
        setData(res.data);
        setView('report');
      } else {
        setError('Test tamamlandı ancak sonuç alınamadı.');
        setView('idle');
      }
    } catch (e) {
      setError((e as Error).message ?? 'Test çalıştırılamadı.');
      setView('idle');
    }
  };

  const allGood = data
    ? (() => {
        const { specs } = parseResults(data);
        return specs.filter(s => s.status === 'failed' || s.status === 'timedOut').length === 0 && specs.length > 0;
      })()
    : null;

  const runDate = data?.stats
    ? new Date(data.stats.startTime).toLocaleString('tr-TR', {
        day: '2-digit', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <>
      {/* Tam ekran katmanlar */}
      <AnimatePresence>
        {view === 'running' && <RunningScreen key="running" />}
      </AnimatePresence>
      <AnimatePresence>
        {view === 'report' && data && (
          <ReportScreen key="report" data={data} onDone={onDone} />
        )}
      </AnimatePresence>

      {/* Idle: normal sayfa */}
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        {/* Kart */}
        <div className="glass-card rounded-[24px] overflow-hidden">
          <div className="px-8 py-8 flex flex-col items-center gap-6 text-center">
            <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center shadow-lg ${
              allGood === null ? 'bg-amber-500/15 shadow-amber-500/20' :
              allGood           ? 'bg-emerald-500/15 shadow-emerald-500/20' :
                                  'bg-red-500/15 shadow-red-500/20'
            }`}>
              {allGood === null
                ? <ShieldCheck size={36} className="text-amber-500" />
                : allGood
                  ? <ShieldCheck size={36} className="text-emerald-500" />
                  : <ShieldAlert size={36} className="text-red-500" />}
            </div>

            <div>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                RBAC &amp; Güvenlik Denetimi
              </h1>
              {runDate
                ? <p className="text-sm text-slate-400 mt-1">Son çalışma: {runDate}</p>
                : <p className="text-sm text-slate-400 mt-1">Henüz test çalıştırılmadı</p>}
            </div>

            {data && (() => {
              const { specs } = parseResults(data);
              const passed = specs.filter(s => s.status === 'passed').length;
              const failed = specs.filter(s => s.status === 'failed' || s.status === 'timedOut').length;
              return (
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-black text-slate-900">{specs.length}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Toplam</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-black text-emerald-600">{passed}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Geçti</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-3xl font-black ${failed > 0 ? 'text-red-600' : 'text-slate-300'}`}>{failed}</div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Başarısız</div>
                  </div>
                </div>
              );
            })()}

            {error && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3 text-sm text-red-700">
                <AlertTriangle size={14} className="shrink-0" />
                {error}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleRun}
                className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-amber-500/30"
              >
                <Play size={15} />
                Testi Çalıştır
              </button>

              {data && (
                <button
                  onClick={() => setView('report')}
                  className="flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white/60 hover:bg-white/80 border border-white/40 text-slate-700 font-black text-xs uppercase tracking-widest transition-all"
                >
                  <ShieldCheck size={15} />
                  Son Raporu Gör
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bilgi */}
        <div className="glass-card rounded-[20px] px-6 py-5 flex items-start gap-4">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck size={16} className="text-blue-500" />
          </div>
          <div className="text-sm text-slate-600 space-y-1">
            <p className="font-bold text-slate-800">Bu test ne yapar?</p>
            <p>Playwright ile RBAC yetki matrisini, IDOR (tenant izolasyonu) ve UI erişim kontrollerini denetler. Canlıya almadan önce çalıştırın.</p>
            <p className="text-xs text-slate-400 mt-2">Sonuçlar otomatik olarak admin e-postasına gönderilir <span className="font-mono bg-slate-100 px-1 rounded">(SMTP yapılandırılmışsa)</span>.</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default SecurityTestModule;

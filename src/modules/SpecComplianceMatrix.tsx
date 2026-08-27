import React, { useState, useEffect, useCallback } from 'react';
import {
  FileSearch,
  Upload,
  FileText,
  Loader2,
  AlertCircle,
  Download,
  Plus,
  Trash2,
  Sparkles,
  ShoppingCart,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { cn } from '../lib/utils';
import { extractTextFromFile, extractCombinedText } from '../lib/docText';
import { apiService } from '../services/apiService';
import { useAIGate } from '../contexts/AIGateContext';
import { logger } from '../utils/logger';
import {
  SpecComplianceResult,
  SpecComplianceGroupResult,
  SpecComplianceStatus,
} from '../types';

interface SpecComplianceMatrixProps {
  opportunityId: string;
  onTransferToBoM?: (products: { pn: string; description: string; quantity: number }[]) => void;
}

interface UICandidate {
  key: string;
  label: string;
  file: File | null;
  text: string;
  parsing: boolean;
}
interface UIGroup {
  key: string;
  name: string;
  requirements: string[];
  candidates: UICandidate[];
}
// Fırsat oluşturulurken yüklenmiş şartname evrakı (opportunity-docs) — otomatik kaynak.
interface AutoDoc {
  docId: string;
  docType: string;
  name: string;
  fileName: string;
  fileUrl: string;
  use: boolean;
}

const genKey = () => Math.random().toString(36).slice(2, 9);

const STATUS_META: Record<SpecComplianceStatus, { tr: string; cls: string }> = {
  MEETS: { tr: 'Karşılıyor', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  PARTIAL: { tr: 'Kısmen', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  FAILS: { tr: 'Karşılamıyor', cls: 'bg-red-100 text-red-700 border-red-200' },
  UNKNOWN: { tr: 'Belirsiz', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const SpecComplianceMatrix = ({ opportunityId, onTransferToBoM }: SpecComplianceMatrixProps) => {
  const { requireAI } = useAIGate();
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  const [specFiles, setSpecFiles] = useState<File[]>([]);
  const [autoDocs, setAutoDocs] = useState<AutoDoc[]>([]);
  const [autoLoading, setAutoLoading] = useState(false);
  const [groups, setGroups] = useState<UIGroup[]>([]);
  const [parsingSpec, setParsingSpec] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [result, setResult] = useState<SpecComplianceResult | null>(null);

  useEffect(() => {
    apiService.getAIStatus().then(s => setAiConfigured(s.configured)).catch(() => setAiConfigured(null));
  }, []);

  // Fırsatta zaten yüklü teknik/idari şartname evrakı varsa otomatik kaynak yap
  // (TECH_SPEC varsayılan işaretli). Fırsat değişince yeniden çek.
  useEffect(() => {
    if (!opportunityId) { setAutoDocs([]); return; }
    let alive = true;
    setAutoLoading(true);
    apiService.getOpportunityRequiredDocs(opportunityId)
      .then(docs => {
        if (!alive) return;
        const specs = (docs || []).filter(d =>
          (d.docType === 'TECH_SPEC' || d.docType === 'ADMIN_SPEC') && d.status === 'UPLOADED' && d.fileUrl);
        setAutoDocs(specs.map(d => ({
          docId: d.id,
          docType: d.docType,
          name: d.name,
          fileName: d.fileName || 'sartname',
          fileUrl: d.fileUrl as string,
          use: d.docType === 'TECH_SPEC',
        })));
      })
      .catch(() => { if (alive) setAutoDocs([]); })
      .finally(() => { if (alive) setAutoLoading(false); });
    return () => { alive = false; };
  }, [opportunityId]);

  const hasSpecSource = specFiles.length > 0 || autoDocs.some(a => a.use);

  // Fırsattan gelen (işaretli) evraklar + elle yüklenen dosyalardan birleşik şartname metni.
  const buildSpecText = async (): Promise<{ text: string; failed: string[] }> => {
    let combined = '';
    const failed: string[] = [];
    for (const ad of autoDocs.filter(a => a.use)) {
      try {
        const resp = await fetch(ad.fileUrl);
        if (!resp.ok) throw new Error(String(resp.status));
        const blob = await resp.blob();
        const file = new File([blob], ad.fileName, { type: blob.type });
        const text = await extractTextFromFile(file);
        if (text.trim()) combined += `\n--- Fırsat evrakı: ${ad.name} (${ad.fileName}) ---\n${text}\n`;
        else failed.push(`${ad.name} (metin çıkarılamadı)`);
      } catch {
        failed.push(ad.name);
      }
    }
    if (specFiles.length) combined += await extractCombinedText(specFiles);
    return { text: combined, failed };
  };

  // ── Grup / madde / aday düzenleyicileri ────────────────────────────────────
  const addGroup = () =>
    setGroups(g => [...g, { key: genKey(), name: '', requirements: [], candidates: [] }]);
  const removeGroup = (key: string) => setGroups(g => g.filter(x => x.key !== key));
  const patchGroup = (key: string, patch: Partial<UIGroup>) =>
    setGroups(g => g.map(x => (x.key === key ? { ...x, ...patch } : x)));

  const addRequirement = (gKey: string) =>
    setGroups(g => g.map(x => (x.key === gKey ? { ...x, requirements: [...x.requirements, ''] } : x)));
  const patchRequirement = (gKey: string, idx: number, val: string) =>
    setGroups(g => g.map(x => (x.key === gKey ? { ...x, requirements: x.requirements.map((r, i) => (i === idx ? val : r)) } : x)));
  const removeRequirement = (gKey: string, idx: number) =>
    setGroups(g => g.map(x => (x.key === gKey ? { ...x, requirements: x.requirements.filter((_, i) => i !== idx) } : x)));

  const addCandidate = (gKey: string) =>
    setGroups(g => g.map(x => (x.key === gKey
      ? { ...x, candidates: [...x.candidates, { key: genKey(), label: '', file: null, text: '', parsing: false }] }
      : x)));
  const removeCandidate = (gKey: string, cKey: string) =>
    setGroups(g => g.map(x => (x.key === gKey ? { ...x, candidates: x.candidates.filter(c => c.key !== cKey) } : x)));
  const patchCandidate = (gKey: string, cKey: string, patch: Partial<UICandidate>) =>
    setGroups(g => g.map(x => (x.key === gKey
      ? { ...x, candidates: x.candidates.map(c => (c.key === cKey ? { ...c, ...patch } : c)) }
      : x)));

  const handleCandidateFile = async (gKey: string, cKey: string, file: File) => {
    const defaultLabel = file.name.replace(/\.[^.]+$/, '');
    patchCandidate(gKey, cKey, { file, parsing: true });
    try {
      const text = await extractTextFromFile(file);
      // label boşsa dosya adından ön-doldur (mevcut label'ı ezmeden)
      setGroups(g => g.map(x => (x.key === gKey
        ? { ...x, candidates: x.candidates.map(c => (c.key === cKey ? { ...c, text, parsing: false, label: c.label || defaultLabel } : c)) }
        : x)));
      if (!text.trim()) setError(`"${file.name}" dosyasından metin çıkarılamadı (taranmış PDF olabilir).`);
    } catch (e) {
      logger.error('specsheet parse failed', e);
      patchCandidate(gKey, cKey, { parsing: false });
      setError(`"${file.name}" işlenirken hata oluştu.`);
    }
  };

  // ── Şartnameyi YZ ile çözümle → ürün gruplarını taslak oluştur ─────────────
  const parseSpec = async () => {
    setError(null);
    if (!hasSpecSource) { setError('Şartname yok — fırsattan otomatik gelen evrak bulunamadı, elle yükleyin.'); return; }
    if (!(await requireAI('Şartname çözümleme'))) return;
    setParsingSpec(true);
    try {
      const { text, failed } = await buildSpecText();
      if (!text.trim()) {
        setError(failed.length
          ? `Şartname metni çıkarılamadı: ${failed.join(', ')}. Elle yükleyin.`
          : 'Şartname dosyalarından metin çıkarılamadı.');
        return;
      }
      const data = await apiService.presalesSpecExtract({ text, opportunityId: opportunityId || undefined });
      if (!data.usedAI) {
        setError(data.summary || 'Şartname çözümlenemedi — YZ entegrasyonunu kontrol edin.');
        return;
      }
      const drafted: UIGroup[] = (data.extractedProducts || []).map(p => ({
        key: genKey(),
        name: p.description || p.pn || 'Ürün',
        requirements: [],
        candidates: [],
      }));
      setGroups(g => [...g, ...drafted]);
      if (drafted.length === 0) setError('Şartnameden ürün çıkarılamadı — grupları elle ekleyin.');
    } catch {
      setError('Şartname çözümleme sırasında hata oluştu.');
    } finally {
      setParsingSpec(false);
    }
  };

  // ── Karşılaştır ───────────────────────────────────────────────────────────
  const runCompare = async () => {
    setError(null);
    setWarn(null);
    setResult(null);
    if (!hasSpecSource) { setError('Teknik şartname gerekli — fırsattan otomatik gelen yok, elle yükleyin.'); return; }
    const usableGroups = groups
      .map(g => ({
        key: g.key,
        name: g.name.trim() || 'Ürün',
        requirements: g.requirements.map(r => r.trim()).filter(Boolean),
        candidates: g.candidates.filter(c => c.text.trim()).map(c => ({ key: c.key, label: c.label.trim() || 'Aday', text: c.text })),
      }))
      .filter(g => g.candidates.length > 0);
    if (usableGroups.length === 0) {
      setError('En az bir ürün grubuna, metni okunabilen bir specsheet ekleyin.');
      return;
    }
    if (!(await requireAI('Şartname–ürün uygunluk karşılaştırması'))) return;

    setAnalyzing(true);
    try {
      const { text: specText, failed } = await buildSpecText();
      if (!specText.trim()) {
        setError(failed.length
          ? `Şartname metni çıkarılamadı: ${failed.join(', ')}. Elle yükleyin.`
          : 'Şartname dosyalarından metin çıkarılamadı.');
        return;
      }
      if (failed.length) setWarn(`Bazı fırsat evrakları okunamadı (${failed.join(', ')}) — kalanla devam edildi. Gerekirse elle yükleyin.`);
      const data = await apiService.presalesSpecCompliance({
        opportunityId: opportunityId || undefined,
        specText,
        groups: usableGroups,
      });
      if (!data.usedAI) {
        setError(data.message || 'Bu özellik yalnızca Ayarlar → Entegrasyonlar\'da bir YZ API anahtarı tanımlıysa çalışır.');
        return;
      }
      setResult(data);
    } catch {
      setError('Karşılaştırma sırasında bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setAnalyzing(false);
    }
  };

  // ── XLSX çıktısı ──────────────────────────────────────────────────────────
  const exportXlsx = useCallback(() => {
    if (!result) return;
    try {
      const wb = XLSX.utils.book_new();

      const summaryAoa: (string | number)[][] = [['Ürün Grubu', 'Önerilen Marka/Model', 'Skor', 'Karşılıyor', 'Kısmen', 'Karşılamıyor', 'Belirsiz', 'Gerekçe']];
      result.groups.forEach(g => {
        const rec = g.candidates.find(c => c.key === g.recommendation.candidateKey);
        const s = g.summary.find(x => x.candidateKey === g.recommendation.candidateKey);
        summaryAoa.push([g.name, rec?.label || '—', s?.score ?? '', s?.meets ?? '', s?.partial ?? '', s?.fails ?? '', s?.unknown ?? '', g.recommendation.rationale || '']);
      });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryAoa), 'Özet');

      result.groups.forEach((g, gi) => {
        const header: string[] = ['Şartname Maddesi'];
        g.candidates.forEach(c => { header.push(`${c.label} — Durum`, `${c.label} — Kanıt / Not`); });
        const aoa: (string | number)[][] = [header];
        g.requirements.forEach(r => {
          const row: (string | number)[] = [r.text];
          g.candidates.forEach(c => {
            const cell = g.cells.find(x => x.requirementKey === r.key && x.candidateKey === c.key);
            row.push(
              STATUS_META[cell?.status || 'UNKNOWN'].tr,
              [cell?.evidence, cell?.note].filter(Boolean).join(' — '),
            );
          });
          aoa.push(row);
        });
        const scoreRow: (string | number)[] = ['TOPLAM SKOR'];
        g.candidates.forEach(c => {
          const s = g.summary.find(x => x.candidateKey === c.key);
          scoreRow.push(s?.score ?? '', `✓${s?.meets || 0}  ~${s?.partial || 0}  ✗${s?.fails || 0}  ?${s?.unknown || 0}`);
        });
        aoa.push(scoreRow);
        const recRow: (string | number)[] = ['ÖNERİ'];
        recRow.push(g.candidates.find(c => c.key === g.recommendation.candidateKey)?.label || '—', g.recommendation.rationale || '');
        aoa.push(recRow);

        const sheetName = `${gi + 1}. ${g.name}`.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheetName);
      });

      XLSX.writeFile(wb, `sartname_uygunluk_${opportunityId || 'rapor'}.xlsx`);
    } catch (e) {
      logger.error('xlsx export failed', e);
      setError('XLSX oluşturulurken hata oluştu.');
    }
  }, [result, opportunityId]);

  const transferGroup = (g: SpecComplianceGroupResult) => {
    if (!onTransferToBoM) return;
    const rec = g.candidates.find(c => c.key === g.recommendation.candidateKey);
    if (!rec) return;
    onTransferToBoM([{ pn: rec.label, description: `${g.name} — ${rec.label}`, quantity: 1 }]);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* YZ gereksinim notu — kalıcı */}
      <div className={cn(
        'flex items-start gap-3 rounded-2xl p-4 mb-6 border text-xs font-medium',
        aiConfigured === false
          ? 'bg-amber-50 border-amber-200 text-amber-800'
          : 'bg-indigo-50/60 border-indigo-100 text-indigo-700',
      )}>
        <Info size={16} className="mt-0.5 shrink-0" />
        <p>
          Bu ekran teknik şartname maddelerini, yüklediğiniz ürün specsheet'leriyle madde-madde karşılaştırır ve
          bir <span className="font-bold">xlsx</span> raporu üretir.{' '}
          <span className="font-bold">
            Yalnızca Ayarlar → Entegrasyonlar bölümünden bir yapay zekâ (YZ) API anahtarı tanımlandığında çalışır.
          </span>
          {aiConfigured === false && ' Şu anda tanımlı bir YZ anahtarı bulunamadı.'}
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Sol: Girdi */}
        <div className="space-y-6">
          {/* Şartname yükleme */}
          <div className="glass-panel rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-4">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <FileSearch size={18} className="text-indigo-600" /> 1. Teknik Şartname
            </h4>

            {/* Fırsattan otomatik gelen şartname evrakları */}
            {opportunityId && (
              autoLoading ? (
                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium">
                  <Loader2 size={12} className="animate-spin" /> Fırsat evrakları kontrol ediliyor…
                </div>
              ) : autoDocs.length > 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-1.5">
                  <p className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Fırsattan gelen şartname evrakları
                  </p>
                  {autoDocs.map(ad => (
                    <label key={ad.docId} className="flex items-center gap-2 text-[11px] text-slate-600 cursor-pointer">
                      <input
                        type="checkbox" checked={ad.use}
                        onChange={(e) => setAutoDocs(list => list.map(x => (x.docId === ad.docId ? { ...x, use: e.target.checked } : x)))}
                      />
                      <span className="font-semibold text-slate-700">{ad.name}</span>
                      <span className="text-slate-400 truncate">{ad.fileName}</span>
                    </label>
                  ))}
                  <p className="text-[10px] text-emerald-700/80">Karşılaştırmada otomatik kullanılır; ek dosya gerekiyorsa aşağıdan yükleyin.</p>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">Bu fırsatta yüklü teknik/idari şartname evrakı yok — aşağıdan elle yükleyin.</p>
              )
            )}

            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer relative">
              <input
                type="file" multiple accept=".pdf,.docx,.xlsx,.xls"
                onChange={(e) => { if (e.target.files) setSpecFiles(Array.from(e.target.files)); }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <FileText size={28} className="mx-auto text-indigo-500 mb-2" />
              {specFiles.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {specFiles.map((f, i) => (
                    <span key={i} className="text-[10px] bg-white px-2 py-1 rounded-md border border-slate-200 text-slate-600">{f.name}</span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  {autoDocs.some(a => a.use) ? 'Ek şartname dosyası (opsiyonel) — .pdf, .docx, .xlsx' : 'Şartname dosyalarını seçin (.pdf, .docx, .xlsx)'}
                </p>
              )}
            </div>
            <button
              onClick={parseSpec}
              disabled={parsingSpec || !hasSpecSource}
              className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 transition-all disabled:opacity-40"
            >
              {parsingSpec ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              Şartnameyi Çözümle (ürün taslağı çıkar)
            </button>
            <p className="text-[11px] text-slate-400">
              İsteğe bağlı — grupları aşağıdan elle de ekleyebilirsiniz.
            </p>
          </div>

          {/* Ürün grupları */}
          <div className="glass-panel rounded-3xl bg-white border border-slate-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <FileText size={18} className="text-indigo-600" /> 2. Şartname Ürünleri & Specsheet'ler
              </h4>
              <button onClick={addGroup} className="text-xs font-bold text-indigo-600 border border-indigo-200 rounded-lg px-2 py-1 flex items-center gap-1">
                <Plus size={13} /> Ürün ekle
              </button>
            </div>

            {groups.length === 0 && (
              <p className="text-xs text-slate-400 italic">Henüz ürün yok. "Şartnameyi Çözümle" ya da "Ürün ekle" ile başlayın.</p>
            )}

            {groups.map((g, gi) => (
              <div key={g.key} className="rounded-2xl border border-slate-200 p-4 space-y-3 bg-slate-50/60">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400">#{gi + 1}</span>
                  <input
                    value={g.name}
                    onChange={(e) => patchGroup(g.key, { name: e.target.value })}
                    placeholder="Ürün adı (ör. 48 Portlu Yönetilebilir Switch)"
                    className="flex-1 px-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg outline-none"
                  />
                  <button onClick={() => removeGroup(g.key)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                </div>

                {/* Maddeler */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Şartname Maddeleri</span>
                    <button onClick={() => addRequirement(g.key)} className="text-[11px] font-bold text-indigo-600">+ madde</button>
                  </div>
                  {g.requirements.length === 0 && (
                    <p className="text-[11px] text-slate-400 italic">Boş bırakılırsa YZ maddeleri şartname metninden çıkarır.</p>
                  )}
                  {g.requirements.map((r, ri) => (
                    <div key={ri} className="flex items-center gap-2">
                      <input
                        value={r}
                        onChange={(e) => patchRequirement(g.key, ri, e.target.value)}
                        placeholder={`Madde ${ri + 1}`}
                        className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none"
                      />
                      <button onClick={() => removeRequirement(g.key, ri)} className="text-slate-300 hover:text-red-500"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>

                {/* Adaylar (specsheet) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aday Ürün Specsheet'leri (rakip markalar)</span>
                    <button onClick={() => addCandidate(g.key)} className="text-[11px] font-bold text-indigo-600">+ specsheet</button>
                  </div>
                  {g.candidates.length === 0 && (
                    <p className="text-[11px] text-amber-600 italic">En az bir specsheet ekleyin.</p>
                  )}
                  {g.candidates.map(c => (
                    <div key={c.key} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2">
                      <input
                        value={c.label}
                        onChange={(e) => patchCandidate(g.key, c.key, { label: e.target.value })}
                        placeholder="Marka / Model"
                        className="w-40 px-2 py-1 text-xs font-bold border border-slate-200 rounded outline-none"
                      />
                      <label className="text-[11px] font-bold text-slate-500 hover:text-indigo-600 cursor-pointer border border-slate-200 rounded px-2 py-1 flex items-center gap-1">
                        {c.parsing ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                        {c.file ? 'Değiştir' : 'Dosya'}
                        <input
                          type="file" className="hidden" accept=".pdf,.docx,.xlsx,.xls"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCandidateFile(g.key, c.key, f); e.target.value = ''; }}
                        />
                      </label>
                      <span className="flex-1 text-[10px] text-slate-400 truncate">
                        {c.file ? c.file.name : 'dosya seçilmedi'}
                        {c.file && !c.parsing && (c.text.trim() ? ` · ${c.text.length.toLocaleString('tr-TR')} karakter` : ' · metin yok')}
                      </span>
                      <button onClick={() => removeCandidate(g.key, c.key)} className="text-slate-300 hover:text-red-500"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
              <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700 font-medium">{error}</p>
            </div>
          )}
          {warn && !error && (
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
              <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-[11px] text-amber-700 font-medium">{warn}</p>
            </div>
          )}

          <button
            onClick={runCompare}
            disabled={analyzing || groups.length === 0 || aiConfigured === false}
            title={aiConfigured === false ? 'Ayarlar → Entegrasyonlar\'dan bir YZ API anahtarı tanımlayın' : undefined}
            className={cn(
              'w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl',
              analyzing || groups.length === 0 || aiConfigured === false
                ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100',
            )}
          >
            {analyzing ? <><Loader2 size={20} className="animate-spin" /> Karşılaştırılıyor…</> : <><FileSearch size={20} /> Uygunluğu Karşılaştır</>}
          </button>
        </div>

        {/* Sağ: Sonuç */}
        <div className="glass-panel rounded-3xl bg-white border border-slate-100 shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <FileSearch size={18} className="text-indigo-600" /> Uygunluk Matrisi
            </h4>
            {result && result.groups.length > 0 && (
              <button
                onClick={exportXlsx}
                className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition-all"
              >
                <Download size={14} /> XLSX İndir
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {!result ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60 space-y-3 py-16">
                <FileSearch size={56} />
                <p className="text-sm text-center max-w-xs">
                  Şartname + specsheet'leri yükleyip "Uygunluğu Karşılaştır" deyin. Sonuç burada ve indirilebilir xlsx'te görünür.
                </p>
              </div>
            ) : result.groups.length === 0 ? (
              <p className="text-sm text-slate-500">{result.message || 'Sonuç üretilemedi.'}</p>
            ) : (
              result.groups.map(g => {
                const recLabel = g.candidates.find(c => c.key === g.recommendation.candidateKey)?.label;
                return (
                  <motion.div key={g.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h5 className="text-sm font-black text-slate-900 border-l-4 border-indigo-600 pl-3">{g.name}</h5>
                      {recLabel && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
                          ★ Önerilen: {recLabel}
                        </span>
                      )}
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-100">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50">
                            <th className="px-3 py-2 font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 min-w-[180px]">Madde</th>
                            {g.candidates.map(c => (
                              <th key={c.key} className="px-3 py-2 font-bold text-slate-600 border-b border-slate-100 min-w-[130px]">{c.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {g.requirements.map(r => (
                            <tr key={r.key} className="hover:bg-slate-50/50 align-top">
                              <td className="px-3 py-2 text-slate-700">{r.text}</td>
                              {g.candidates.map(c => {
                                const cell = g.cells.find(x => x.requirementKey === r.key && x.candidateKey === c.key);
                                const meta = STATUS_META[cell?.status || 'UNKNOWN'];
                                return (
                                  <td key={c.key} className="px-3 py-2">
                                    <span className={cn('inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border', meta.cls)}>{meta.tr}</span>
                                    {(cell?.evidence || cell?.note) && (
                                      <p className="text-[10px] text-slate-400 mt-1 leading-snug">{[cell?.evidence, cell?.note].filter(Boolean).join(' — ')}</p>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                          <tr className="bg-slate-50 font-bold">
                            <td className="px-3 py-2 text-slate-500 uppercase text-[10px] tracking-widest">Skor</td>
                            {g.candidates.map(c => {
                              const s = g.summary.find(x => x.candidateKey === c.key);
                              return (
                                <td key={c.key} className="px-3 py-2 text-slate-700">
                                  {s?.score ?? 0}
                                  <span className="block text-[10px] font-medium text-slate-400">✓{s?.meets || 0} ~{s?.partial || 0} ✗{s?.fails || 0} ?{s?.unknown || 0}</span>
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {g.recommendation.rationale && (
                      <p className="text-[11px] text-slate-500 italic">Gerekçe: {g.recommendation.rationale}</p>
                    )}

                    {onTransferToBoM && g.recommendation.candidateKey && (
                      <button
                        onClick={() => transferGroup(g)}
                        className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 hover:bg-emerald-100 transition-all"
                      >
                        <ShoppingCart size={13} /> Önerilen markayı BoM'a aktar
                      </button>
                    )}
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpecComplianceMatrix;

import { FileText, BookOpen, Upload, Loader2, Cpu, AlertCircle, Star, ClipboardList } from 'lucide-react';
import { AiAnalysis } from './types';

export default function AnalysisTab({
  contractText, setContractText, specText, setSpecText, onSaveTexts, loading, onAnalyse, analysing, aiConfigured, analysisUsedAI, analysis,
}: {
  contractText: string;
  setContractText: (v: string) => void;
  specText: string;
  setSpecText: (v: string) => void;
  onSaveTexts: () => void;
  loading: boolean;
  onAnalyse: () => void;
  analysing: boolean;
  aiConfigured: boolean | null;
  analysisUsedAI: boolean | null;
  analysis: AiAnalysis | null;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1">
            <FileText className="w-3 h-3" /> Sözleşme Metni
          </label>
          <textarea
            className="input-glass w-full h-56 resize-none font-mono text-xs"
            placeholder="Sözleşme metnini buraya yapıştırın..."
            value={contractText}
            onChange={e => setContractText(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 mb-1 block flex items-center gap-1">
            <BookOpen className="w-3 h-3" /> İdari Şartname
          </label>
          <textarea
            className="input-glass w-full h-56 resize-none font-mono text-xs"
            placeholder="İdari şartname metnini buraya yapıştırın..."
            value={specText}
            onChange={e => setSpecText(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onSaveTexts} disabled={loading} className="btn-secondary flex items-center gap-2 text-sm">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          Kaydet
        </button>
        <button
          onClick={onAnalyse}
          disabled={analysing || (!contractText.trim() && !specText.trim())}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          {analysing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5" />}
          {analysing ? 'AI Analiz Yapıyor...' : 'AI ile Analiz Et'}
        </button>
        {aiConfigured === false && (
          <span className="text-xs text-amber-400 flex items-center gap-1 ml-auto">
            <AlertCircle className="w-3 h-3" /> YZ yapılandırılmadı (Ayarlar → Entegrasyonlar) — örnek çıktı gösterilecek
          </span>
        )}
      </div>

      {/* Analysis results */}
      {analysis && (
        <div className="space-y-4 mt-2">
          {analysisUsedAI === false && aiConfigured !== false && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-xs text-amber-300">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              YZ yapılandırılmış ama bu analiz çağrısı başarısız oldu (sağlayıcıya ulaşılamadı, API anahtarı/model adı geçersiz olabilir ya da sağlayıcı hesabında bakiye/kota sorunu olabilir) — aşağıdaki liste örnek (standart) evrak listesidir, belgenizin gerçek içeriğini yansıtmaz. Ayarlar → Entegrasyonlar'ı kontrol edip tekrar deneyin.
            </div>
          )}
          {/* Summary card */}
          <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <h3 className="text-sm font-semibold text-blue-300 mb-3 flex items-center gap-2">
              <Star className="w-4 h-4" /> Sözleşme Özeti
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400">Tür:</span>
                <span className="text-slate-200 ml-2">{analysis.contract_summary?.type}</span>
              </div>
              {analysis.contract_summary?.tax_obligations?.length > 0 && (
                <div>
                  <span className="text-slate-400 block mb-1">Vergi Yükümlülükleri:</span>
                  {analysis.contract_summary.tax_obligations.map((t, i) => (
                    <span key={i} className="block text-amber-300">• {t}</span>
                  ))}
                </div>
              )}
              {analysis.contract_summary?.project_impacts?.length > 0 && (
                <div className="col-span-2">
                  <span className="text-slate-400 block mb-1">Proje Etkileri:</span>
                  {analysis.contract_summary.project_impacts.map((p, i) => (
                    <span key={i} className="block text-slate-300">• {p}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Key clauses */}
          {analysis.key_clauses?.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <h3 className="text-sm font-semibold text-amber-300 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> Önemli Maddeler
              </h3>
              <div className="space-y-2">
                {analysis.key_clauses.map((c, i) => (
                  <div key={i} className="text-xs border border-white/10 rounded-lg p-3">
                    <div className="font-medium text-slate-200">{c.clause}</div>
                    <div className="text-slate-400 mt-1">Etki: {c.impact}</div>
                    <div className="text-amber-300 mt-1">↗ {c.action_required}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tasks preview */}
          {analysis.tasks?.length > 0 && (
            <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
              <h3 className="text-sm font-semibold text-purple-300 mb-3 flex items-center gap-2">
                <ClipboardList className="w-4 h-4" /> Yapılacaklar ({analysis.tasks.length} görev)
              </h3>
              <div className="space-y-1.5">
                {analysis.tasks.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      t.priority === 'HIGH' ? 'bg-red-400' : t.priority === 'LOW' ? 'bg-slate-400' : 'bg-amber-400'
                    }`} />
                    <span className="text-slate-300">{t.order}. {t.title}</span>
                    <span className="ml-auto text-slate-500 whitespace-nowrap">~{t.estimated_days}g</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

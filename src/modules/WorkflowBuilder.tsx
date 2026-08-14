import React, { useState, useEffect, useMemo } from 'react';
import { logger } from '../utils/logger';
import { motion, AnimatePresence } from 'motion/react';
import {
  GitBranch, ArrowRight, Plus, Settings2, Activity, CheckCircle2,
  AlertCircle, Save, Zap, Info, ChevronRight, Play, Pause, RefreshCw, ListTodo,
  Building, Power, ShieldAlert, X, Users, Split, Trash2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Unit, User, Workflow, WorkflowStep } from '../types';
import {
  PROCESS_KEYS, PROCESS_KEY_LABEL, LIVE_PROCESS_KEYS, ProcessKey,
  STAGE_ACTION_KEYS, STAGE_ACTION_LABEL, LIVE_STAGE_ACTION_KEYS,
  ENTITY_TYPES, ENTITY_TYPE_LABEL, ENTITY_FIELD_SPECS, EntityType,
} from '../types/workflow';
import { ROLE_LABELS } from '../constants';
import { apiService } from '../services/apiService';
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext';

const emptyWorkflowFor = (processKey: string, name: string, entityType?: string | null): Workflow => ({
  id: `wf-${Date.now()}`,
  name,
  description: '',
  processKey,
  entityType: entityType ?? null,
  steps: [],
});

const parseActionConfig = (raw?: string | null): { fields: string[] } => {
  try {
    const parsed = raw ? (JSON.parse(raw) as { fields?: string[] }) : null;
    return { fields: Array.isArray(parsed?.fields) ? parsed.fields : [] };
  } catch {
    return { fields: [] };
  }
};

// Türkçe bir süreç adından ("Proje Kapanış Onayı") tenant-özel bir processKey
// üretir — sabit taksonomiden (PROCESS_KEYS) bağımsız. `CUSTOM_` öneki, sabit
// listeyle asla çakışmamasını garantiler.
const toCustomProcessKey = (name: string): string => {
  const trMap: Record<string, string> = { 'ç': 'c', 'Ç': 'C', 'ğ': 'g', 'Ğ': 'G', 'ı': 'i', 'İ': 'I', 'ö': 'o', 'Ö': 'O', 'ş': 's', 'Ş': 'S', 'ü': 'u', 'Ü': 'U' };
  const ascii = name.split('').map(ch => trMap[ch] ?? ch).join('');
  const base = 'CUSTOM_' + ascii.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return base.slice(0, 60) || `CUSTOM_${Date.now()}`;
};

const WorkflowBuilder = ({ units = [], users = [] }: { units?: Unit[]; users?: User[] }) => {
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const [processKey, setProcessKey] = useState<string>('OPPORTUNITY_APPROVAL');
  // Tenant'ın kendi tanımladığı, sabit taksonomide (PROCESS_KEYS) olmayan
  // süreçler — "+ Yeni Süreç" ile eklenenler + sunucudan (GET /workflows)
  // keşfedilen daha önce oluşturulmuş özel süreçler.
  const [customProcesses, setCustomProcesses] = useState<{ key: string; name: string; entityType: string | null }[]>([]);
  const [newProcessModal, setNewProcessModal] = useState(false);
  const [newProcessName, setNewProcessName] = useState('');
  const [newProcessEntityType, setNewProcessEntityType] = useState<EntityType | ''>('');
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'builder' | 'simulation'>('builder');

  const [currentSimStep, setCurrentSimStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  // Devir simülasyonu: hangi adımların gereklilikleri "tamamlandı" işaretlendi (kalıcı değil)
  const [simCompleted, setSimCompleted] = useState<Set<string>>(new Set());
  const [handoffModal, setHandoffModal] = useState<{
    step: WorkflowStep;
    nextUnitName: string | null;
    nextDescription: string | null;
    fallbackUsed: boolean;
    removedUnitName: string | null;
    blocked: boolean;
  } | null>(null);

  // Simülasyon adımları = GERÇEK aktif iş akışının adımları (sahte senaryo yok).
  // Birim adı units prop'undan; sıra order'a göre; tip/gereklilik/etkin bilgisi gerçek.
  const simSteps = useMemo(() => {
    const steps = [...(activeWorkflow?.steps ?? [])].sort((a, b) => a.order - b.order);
    return steps.map((s, i) => ({
      id: s.id,
      index: i,
      unit: units.find(u => u.id === s.unitId)?.name || 'Birim',
      description: s.description || '',
      type: s.type,
      enabled: s.enabled !== false,
      requiresCompletion: !!s.requiresCompletion,
    }));
  }, [activeWorkflow, units]);

  useEffect(() => {
    fetchWorkflowForProcessKey(processKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processKey]);

  // Tenant'ın daha önce oluşturduğu özel (sabit taksonomi dışı) süreçleri
  // keşfet — sayfa her açıldığında sekme listesine eklensinler.
  useEffect(() => {
    apiService.getWorkflows().then((wfs) => {
      const known = new Set<string>(PROCESS_KEYS as readonly string[]);
      const discovered = (wfs || [])
        .filter((w) => w.processKey && !known.has(w.processKey))
        .map((w) => ({ key: w.processKey as string, name: w.name, entityType: w.entityType ?? null }));
      if (discovered.length) {
        setCustomProcesses((prev) => {
          const existingKeys = new Set(prev.map((c) => c.key));
          return [...prev, ...discovered.filter((d) => !existingKeys.has(d.key))];
        });
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const labelForProcessKey = (key: string): string =>
    (PROCESS_KEY_LABEL as Record<string, string>)[key] ?? customProcesses.find((c) => c.key === key)?.name ?? key;

  const handleCreateCustomProcess = () => {
    setNewProcessName('');
    setNewProcessEntityType('');
    setNewProcessModal(true);
  };

  const handleConfirmCreateCustomProcess = () => {
    const name = newProcessName.trim();
    if (!name) return;
    if (!newProcessEntityType) return;
    const key = toCustomProcessKey(name);
    const allKeys = [...(PROCESS_KEYS as readonly string[]), ...customProcesses.map((c) => c.key)];
    if (allKeys.includes(key)) {
      alert('Bu isimde (veya çok benzer) bir süreç zaten var. Farklı bir ad deneyin.');
      return;
    }
    setCustomProcesses((prev) => [...prev, { key, name, entityType: newProcessEntityType }]);
    setProcessKey(key);
    setNewProcessModal(false);
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isAutoPlaying && simSteps.length > 0) {
      interval = setInterval(() => {
        setCurrentSimStep(prev => (prev >= simSteps.length - 1 ? 0 : prev + 1));
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isAutoPlaying, simSteps.length]);

  // Süreç Motoru (Faz A) — her processKey kendi WorkflowStep zincirine sahiptir
  // (tenant başına süreç başına tek workflow, backend `@@unique([tenantId, processKey])`).
  // Tenant bu süreci henüz kurgulamadıysa (404) boş bir taslak gösterilir — hiçbir
  // eski/hardcoded şablon otomatik önerilmez (kaydedilene kadar hiçbir işlevi yok).
  const fetchWorkflowForProcessKey = async (key: string) => {
    setLoading(true);
    setCurrentSimStep(0);
    try {
      const wf = await apiService.getWorkflowByProcessKey(key);
      setActiveWorkflow(wf);
      setNotConfigured(false);
    } catch {
      setActiveWorkflow(emptyWorkflowFor(key, labelForProcessKey(key), customProcesses.find((c) => c.key === key)?.entityType ?? null));
      setNotConfigured(true);
    } finally {
      setLoading(false);
    }
  };

  // parallel=true → yeni adım son adımla AYNI order'ı paylaşır (çoklu onaylayıcı/
  // paralel aşama — Süreç Motoru ANY/ALL modunu bu şekilde ayırt eder).
  const handleAddStep = (parallel = false) => {
    const steps = activeWorkflow?.steps ?? [];
    const maxOrder = steps.length ? Math.max(...steps.map(s => s.order)) : -1;
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      unitId: units && units.length > 0 ? units[0].id : 'default-unit',
      role: null,
      delegateUserId: null,
      approvalMode: 'ANY',
      actionKey: null,
      // Değişmez kural: bir adım yalnız açıkça "otomatik devir" işaretlenirse
      // onaysız ilerler — varsayılan her zaman MANUAL (insan onayı gerektirir).
      type: 'MANUAL',
      description: 'Yeni işlem adımı',
      order: parallel && steps.length ? maxOrder : maxOrder + 1,
      nextStepId: null,
      enabled: true,
      requiresCompletion: false,
      completionNote: null
    };

    const fallbackEntityType = customProcesses.find((c) => c.key === processKey)?.entityType ?? null;
    const base: Workflow = activeWorkflow ?? emptyWorkflowFor(processKey, labelForProcessKey(processKey), fallbackEntityType);
    setActiveWorkflow({ ...base, steps: [...steps, newStep] });
  };

  // Birim akıştan çıkarılınca step silinmez; enabled=false yapılır → sıra korunur,
  // skip-logic onu atlar (görevler bir sonraki aktif birime yönlenir).
  const handleToggleEnabled = (id: string) => {
    if (!activeWorkflow) return;
    const updatedSteps = (activeWorkflow.steps || []).map(s =>
      s.id === id ? { ...s, enabled: s.enabled === false } : s
    );
    setActiveWorkflow({ ...activeWorkflow, steps: updatedSteps });
  };

  const handleUpdateStep = (id: string, data: Partial<WorkflowStep>) => {
    if (!activeWorkflow) return;
    const updatedSteps = (activeWorkflow.steps || []).map(s => s.id === id ? { ...s, ...data } : s);
    setActiveWorkflow({ ...activeWorkflow, steps: updatedSteps });
  };

  // ANY/ALL modu mantıken bir tek adıma değil, aynı order'ı paylaşan TÜM
  // paralel adımlara (çoklu onaylayıcı grubuna) ait — hepsinde senkron tutulur.
  const handleSetGroupMode = (order: number, mode: 'ANY' | 'ALL') => {
    if (!activeWorkflow) return;
    const updatedSteps = (activeWorkflow.steps || []).map(s => s.order === order ? { ...s, approvalMode: mode } : s);
    setActiveWorkflow({ ...activeWorkflow, steps: updatedSteps });
  };

  const handleRemoveStep = (id: string) => {
    if (!activeWorkflow) return;
    setActiveWorkflow({ ...activeWorkflow, steps: (activeWorkflow.steps || []).filter(s => s.id !== id) });
  };

  const unitName = (id: string) => units.find(u => u.id === id)?.name ?? 'Bilinmeyen Birim';

  // Skip-resolution (processEngine.ts'in walkForward'daki order/enabled mantığıyla
  // aynı prensip — anlık UI önizlemesi için lokal hesap): bir adımdan sonra
  // görevin aktarılacağı ilk AKTİF (enabled) adımı bulur.
  const getNextInfo = (step: WorkflowStep) => {
    const steps = activeWorkflow?.steps ?? [];
    const sorted = [...steps].sort((a, b) => a.order - b.order);
    const nextActive = sorted.find(s => s.order > step.order && s.enabled !== false) ?? null;
    let fallbackUsed = false;
    let removedUnitName: string | null = null;
    if (step.nextStepId) {
      const literal = sorted.find(s => s.id === step.nextStepId);
      if (literal && literal.enabled === false) {
        fallbackUsed = true;
        removedUnitName = unitName(literal.unitId);
      }
    }
    return { nextActive, fallbackUsed, removedUnitName };
  };

  const toggleSimCompleted = (id: string) => {
    setSimCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // "Sonraki birime aktar": hangi birime gideceğini gösterir; hazırlayan birim
  // gerekliliklerini tamamlamadıysa (requiresCompletion) önce uyarı verir.
  const handleForward = (step: WorkflowStep) => {
    const { nextActive, fallbackUsed, removedUnitName } = getNextInfo(step);
    const blocked = !!step.requiresCompletion && !simCompleted.has(step.id);
    setHandoffModal({
      step,
      nextUnitName: nextActive ? unitName(nextActive.unitId) : null,
      nextDescription: nextActive ? nextActive.description : null,
      fallbackUsed,
      removedUnitName,
      blocked
    });
  };

  const handleSave = async () => {
    if (!activeWorkflow) return;
    setSaving(true);
    try {
      if (activeWorkflow.id && !activeWorkflow.id.startsWith('wf-')) {
        const saved = await apiService.updateWorkflow(activeWorkflow.id, activeWorkflow);
        setActiveWorkflow(saved);
      } else {
        const saved = await apiService.createWorkflow(activeWorkflow);
        setActiveWorkflow(saved);
      }
      setNotConfigured(false);
      alert('İş akışı başarıyla kaydedildi.');
    } catch (error) {
      alert((error instanceof Error ? error.message : '') || 'Kayıt sırasında hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const [deleting, setDeleting] = useState(false);
  // Bir süreci tamamen silmek (yalnız adım silmek değil) — kaydedilmemiş taslak
  // (id 'wf-' ile başlıyorsa) zaten sunucuda yok, doğrudan yerel boş taslağa döner.
  const handleDeleteWorkflow = async () => {
    if (!activeWorkflow) return;
    if (!activeWorkflow.id || activeWorkflow.id.startsWith('wf-')) {
      setActiveWorkflow(emptyWorkflowFor(processKey, labelForProcessKey(processKey), activeWorkflow.entityType ?? customProcesses.find((c) => c.key === processKey)?.entityType ?? null));
      return;
    }
    if (!confirm(`"${labelForProcessKey(processKey)}" sürecini tamamen silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) return;
    setDeleting(true);
    try {
      await apiService.deleteWorkflow(activeWorkflow.id);
      setActiveWorkflow(emptyWorkflowFor(processKey, labelForProcessKey(processKey), activeWorkflow.entityType ?? customProcesses.find((c) => c.key === processKey)?.entityType ?? null));
      setNotConfigured(true);
    } catch (error) {
      alert((error instanceof Error ? error.message : '') || 'Silme sırasında hata oluştu.');
    } finally {
      setDeleting(false);
    }
  };

  const activeSimStep = simSteps[currentSimStep] || simSteps[0];

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Akışlar Yükleniyor...</p>
      </div>
    );
  }

  // Safety check for units
  if (!units || units.length === 0) {
    return (
      <div className="p-12 text-center glass-panel rounded-[40px] bg-white border border-slate-100 shadow-xl max-w-2xl mx-auto mt-10">
        <div className="w-24 h-24 bg-amber-50 text-amber-500 rounded-3xl flex items-center justify-center mb-8 mx-auto shadow-inner">
          <Building size={48} />
        </div>
        <h4 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">Birim Tanımlanmamış</h4>
        <p className="text-sm text-slate-500 font-bold max-w-sm mt-4 mx-auto leading-relaxed">
          İş akışlarını yapılandırabilmek için sistemde en az bir adet <span className="text-primary font-black">Kurumsal Birim</span> (Satış, Presales, Operasyon vb.) tanımlı olmalıdır.
        </p>
        <div className="mt-10 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 text-center">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">HIZLI ÇÖZÜM</p>
           <p className="text-xs text-slate-600 font-medium">Lütfen önce <span className="font-bold text-slate-900 underline">"Kurumsal Birimler"</span> sekmesine giderek şirketinize ait departmanları oluşturun.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 font-geist">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 glass-panel p-8 rounded-[32px] bg-white/40 border-white/60">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-inner">
            <GitBranch size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
                İş Akışı Tasarımcısı
              </h4>
              {notConfigured && (
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[9px] font-black uppercase tracking-tighter">Henüz Yapılandırılmadı</span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-bold">Şirketinizin gerçek süreç haritası — hangi birim/rol hangi sırada devralır ve onaylar, buradan kurgulanır.</p>
          </div>
        </div>

        {activeTab === 'builder' && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleAddStep(false)}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-primary/40 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
            >
              <Plus size={16} /> ADIM EKLE
            </button>
            <button
              onClick={() => handleAddStep(true)}
              disabled={!activeWorkflow?.steps?.length}
              title="Son adımla aynı sırada — çoklu onaylayıcı/paralel aşama"
              className="px-6 py-3 bg-white border border-slate-200 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-primary/40 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm disabled:opacity-30"
            >
              <Split size={16} /> PARALEL ADIM EKLE
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
              AKIŞI KAYDET
            </button>
            {activeWorkflow?.id && !activeWorkflow.id.startsWith('wf-') && (
              <button
                onClick={handleDeleteWorkflow}
                disabled={deleting}
                title="Bu süreci tamamen sil"
                className="px-4 py-3 bg-white border border-red-100 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-50 transition-all flex items-center gap-2 shadow-sm"
              >
                {deleting ? <div className="w-4 h-4 border-2 border-red-200 border-t-red-500 rounded-full animate-spin" /> : <Trash2 size={16} />}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Süreç seçici — her processKey kendi bağımsız WorkflowStep zincirine sahiptir.
          Sabit taksonomi (PROCESS_KEYS) + tenant'ın "+ Yeni Süreç" ile eklediği
          özel süreçler (customProcesses) aynı listede, aynı şekilde davranır. */}
      <div className="flex flex-wrap items-center gap-2">
        {[...PROCESS_KEYS, ...customProcesses.map((c) => c.key)].map((key) => {
          const isLive = LIVE_PROCESS_KEYS.includes(key as typeof LIVE_PROCESS_KEYS[number]);
          return (
            <button
              key={key}
              onClick={() => setProcessKey(key)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all flex items-center gap-1.5 border",
                processKey === key ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-100 hover:border-slate-300"
              )}
            >
              {labelForProcessKey(key)}
              {!isLive && <span className="text-[8px] opacity-70">(taslak)</span>}
            </button>
          );
        })}
        <button
          onClick={handleCreateCustomProcess}
          title="Sabit listede olmayan, kendi tanımladığınız yeni bir süreç ekleyin"
          className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all flex items-center gap-1.5 border border-dashed border-primary/40 text-primary hover:bg-primary/5"
        >
          <Plus size={12} /> Yeni Süreç
        </button>
      </div>
      {!LIVE_PROCESS_KEYS.includes(processKey as typeof LIVE_PROCESS_KEYS[number]) && (
        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
          <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-xs font-bold text-amber-700 leading-relaxed">
            Bu süreç henüz otomasyona bağlı değil — burada tasarlayıp kaydedebilirsiniz ama ilgili modül şu an bu akışı çağırmıyor
            {customProcesses.some((c) => c.key === processKey) ? ' (kendi tanımladığınız bu özel süreci gerçek bir kayıtla tetiklemek için hangi ekrandan/hangi kayıt üzerinden başlatılmasını istediğinizi belirtin, oraya bağlayalım).' : ' (yol haritası).'}
          </p>
        </div>
      )}

      <div className="flex items-center gap-4 border-b border-slate-100 pb-2">
        <button
          onClick={() => setActiveTab('simulation')}
          className={cn(
            "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
            activeTab === 'simulation' ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white text-slate-500 border border-slate-100 hover:bg-slate-50"
          )}
        >
          <Activity size={14} /> Önizleme (canlı akışı yansıtır)
        </button>
        <button
          onClick={() => setActiveTab('builder')}
          className={cn(
            "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === 'builder' ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-100 hover:bg-slate-50"
          )}
        >
          Tasarımcı
        </button>
      </div>

      {activeTab === 'builder' ? (
        <div className="grid grid-cols-1 gap-8">
          <div>
            {activeWorkflow && activeWorkflow.steps.length > 0 ? (
              <div className="relative min-h-[400px] flex flex-wrap gap-8 items-start justify-center lg:justify-start pt-4 pb-12 overflow-x-auto custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {activeWorkflow.steps?.map((step, index) => {
                    const isDisabled = step.enabled === false;
                    const { nextActive, fallbackUsed, removedUnitName } = getNextInfo(step);
                    const simDone = simCompleted.has(step.id);
                    const groupSiblings = activeWorkflow.steps.filter(s => s.order === step.order);
                    const isParallelGroup = groupSiblings.length > 1;
                    return (
                    <motion.div key={step.id} layout initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative group">
                      <div className={cn(
                        "w-72 glass-panel p-6 rounded-[32px] bg-white border shadow-sm transition-all duration-300 relative z-10",
                        isDisabled ? "border-slate-200 opacity-60 grayscale" : "border-slate-100 hover:shadow-xl hover:border-primary/30"
                      )}>
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs", isDisabled ? "bg-slate-100 text-slate-400" : "bg-primary/10 text-primary")}>{step.order + 1}</div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isDisabled ? 'Çıkarıldı' : 'Aşama'}</span>
                            {isParallelGroup && (
                              <span title="Bu sırada birden fazla onaylayıcı/birim var (çoklu onaylayıcı)" className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-tighter flex items-center gap-1">
                                <Users size={10} /> {groupSiblings.length}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleToggleEnabled(step.id)}
                              title={isDisabled ? 'Akışa geri al' : 'Akıştan çıkar (görevler sıradaki birime yönlenir)'}
                              className={cn("p-2 rounded-xl transition-all", isDisabled ? "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" : "text-slate-300 hover:text-red-500 hover:bg-red-50")}
                            ><Power size={16} /></button>
                            <button
                              onClick={() => handleRemoveStep(step.id)}
                              title="Adımı sil"
                              className="p-2 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                            ><X size={16} /></button>
                          </div>
                        </div>
                        {isDisabled && (
                          <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-2">
                            <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                            <p className="text-[10px] font-bold text-amber-700 leading-tight">Birim akıştan çıkarıldı — görevler otomatik olarak sıradaki aktif birime yönlendirilir.</p>
                          </div>
                        )}
                        <div className="space-y-5">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between px-1"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sorumlu Birim</label><Info size={12} className="text-slate-300" /></div>
                            <select value={step.unitId} onChange={(e) => handleUpdateStep(step.id, { unitId: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-black text-slate-900 outline-none focus:bg-white focus:border-primary/20 transition-all appearance-none cursor-pointer">
                              {units?.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">İşlem Detayı</label>
                            <input type="text" value={step.description} placeholder="Örn: Teknik Analiz Raporu" onChange={(e) => handleUpdateStep(step.id, { description: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-primary/20 transition-all" />
                          </div>
                          <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-colors", step.type === 'AUTO' ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600")}>{step.type === 'AUTO' ? <Zap size={14} /> : <CheckCircle2 size={14} />}</div>
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{step.type === 'AUTO' ? 'OTOMATİK DEVİR' : 'MANUEL ONAY'}</span>
                            </div>
                            <button onClick={() => handleUpdateStep(step.id, { type: step.type === 'AUTO' ? 'MANUAL' : 'AUTO' })} className="p-2 hover:bg-slate-50 rounded-lg text-primary transition-all"><Settings2 size={16} /></button>
                          </div>

                          {/* Onaylayacak rol: boş = birimdeki herkes/yöneticisi. Onay zincirinin
                              hangi role gideceğini burada tanımlarsınız — sabit değil, tenant'a özgü. */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Onaylayacak Rol (opsiyonel)</label>
                            <select
                              value={step.role || ''}
                              onChange={(e) => handleUpdateStep(step.id, { role: e.target.value || null })}
                              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-primary/20 transition-all appearance-none cursor-pointer"
                            >
                              <option value="">Birimdeki herkes</option>
                              {Object.entries(ROLE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                            </select>
                          </div>

                          {/* Değişmez kural #2 — birim boşsa (aktif kimse yoksa/hiç açılmadıysa)
                              modülün çalışabilmesi için bir VEKİL atanması zorunludur; sessiz
                              atlama yok. Koltuk doluyken de vekil önceden atanabilir. */}
                          {(() => {
                            const seatEmpty = !users.some(u => u.unitId === step.unitId && u.status === 'ACTIVE' && (!step.role || u.role === step.role));
                            return (
                              <div className="space-y-2">
                                <label className={cn("text-[10px] font-black uppercase tracking-widest px-1 flex items-center gap-1.5", seatEmpty ? "text-amber-600" : "text-slate-500")}>
                                  {seatEmpty && <AlertCircle size={11} />} Vekil {seatEmpty ? '(bu koltuk şu an boş — zorunlu)' : '(opsiyonel)'}
                                </label>
                                <select
                                  value={step.delegateUserId || ''}
                                  onChange={(e) => handleUpdateStep(step.id, { delegateUserId: e.target.value || null })}
                                  className={cn(
                                    "w-full border rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:bg-white transition-all appearance-none cursor-pointer",
                                    seatEmpty ? "bg-amber-50 border-amber-200 focus:border-amber-300" : "bg-slate-50 border-slate-100 focus:border-primary/20"
                                  )}
                                >
                                  <option value="">Vekil atanmadı{seatEmpty ? ' — bu birim boşken kimse onaylayamaz' : ''}</option>
                                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({ROLE_LABELS[u.role] || u.role})</option>)}
                                </select>
                              </div>
                            );
                          })()}

                          {isParallelGroup && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Çoklu Onaylayıcı Modu</label>
                              <div className="flex bg-slate-50 border border-slate-100 rounded-2xl p-1">
                                {(['ANY', 'ALL'] as const).map(m => (
                                  <button
                                    key={m}
                                    onClick={() => handleSetGroupMode(step.order, m)}
                                    className={cn(
                                      "flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all",
                                      (step.approvalMode || 'ANY') === m ? "bg-indigo-500 text-white shadow" : "text-slate-500 hover:bg-slate-100"
                                    )}
                                  >
                                    {m === 'ANY' ? 'Herhangi Biri' : 'Hepsi Onaylamalı'}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {step.type === 'AUTO' && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Otomatik Eylem (opsiyonel)</label>
                              <select
                                value={step.actionKey || ''}
                                onChange={(e) => handleUpdateStep(step.id, { actionKey: e.target.value || null })}
                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-primary/20 transition-all appearance-none cursor-pointer"
                              >
                                <option value="">Yok — yalnız devir</option>
                                {STAGE_ACTION_KEYS.map(k => (
                                  <option key={k} value={k} disabled={!LIVE_STAGE_ACTION_KEYS.includes(k)}>{STAGE_ACTION_LABEL[k]}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* "Veri aktarımı" jenerik eylemi — kod yazmadan, kaynak varlığın
                              hangi alanlarının hedef birime kopyalanacağını burada seçersiniz.
                              Alan listesi, süreç oluşturulurken seçilen hedef kaydı türüne göre değişir. */}
                          {step.type === 'AUTO' && step.actionKey === 'COPY_FIELDS_TO_TASK' && (
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Aktarılacak Alanlar</label>
                              {activeWorkflow?.entityType && ENTITY_FIELD_SPECS[activeWorkflow.entityType as EntityType] ? (
                                <div className="space-y-1.5 bg-slate-50 border border-slate-100 rounded-2xl p-3">
                                  {ENTITY_FIELD_SPECS[activeWorkflow.entityType as EntityType].map((f) => {
                                    const cfg = parseActionConfig(step.actionConfig);
                                    const checked = cfg.fields.includes(f.key);
                                    return (
                                      <label key={f.key} className="flex items-center gap-2 text-[11px] font-bold text-slate-700 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={(e) => {
                                            const next = e.target.checked ? [...cfg.fields, f.key] : cfg.fields.filter((k) => k !== f.key);
                                            handleUpdateStep(step.id, { actionConfig: JSON.stringify({ fields: next }) });
                                          }}
                                        />
                                        {f.label}
                                      </label>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-[10px] text-amber-600 font-bold px-1 leading-relaxed">
                                  Bu sürecin hedef kaydı türü tanımlı değil — alan seçebilmek için "+ Yeni Süreç" ile oluştururken bir hedef tür seçmelisiniz.
                                </p>
                              )}
                            </div>
                          )}

                          {/* Devir gerekliliği: hazırlayan birim, devretmeden önce tamamlamalı mı? */}
                          <div className="space-y-2">
                            <button
                              onClick={() => handleUpdateStep(step.id, { requiresCompletion: !step.requiresCompletion })}
                              className={cn("w-full flex items-center justify-between px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-tighter transition-all", step.requiresCompletion ? "bg-indigo-50 text-indigo-600 border border-indigo-100" : "bg-slate-50 text-slate-400 border border-slate-100")}
                            >
                              <span className="flex items-center gap-1.5"><ShieldAlert size={12} /> Devir öncesi tamamlanmalı</span>
                              <span className={cn("w-7 h-4 rounded-full flex items-center transition-all px-0.5", step.requiresCompletion ? "bg-indigo-500 justify-end" : "bg-slate-300 justify-start")}>
                                <span className="w-3 h-3 bg-white rounded-full" />
                              </span>
                            </button>
                            {step.requiresCompletion && (
                              <>
                                <input type="text" value={step.completionNote ?? ''} placeholder="Gereklilik notu (örn. BoM tamamlanmalı)" onChange={(e) => handleUpdateStep(step.id, { completionNote: e.target.value })} className="w-full bg-white border border-indigo-100 rounded-xl px-3 py-2 text-[11px] font-medium text-slate-700 outline-none focus:border-indigo-300 transition-all" />
                                <button
                                  onClick={() => toggleSimCompleted(step.id)}
                                  className={cn("w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all", simDone ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200")}
                                >
                                  <CheckCircle2 size={12} /> {simDone ? 'Gereklilikler tamamlandı' : 'Tamamlandı işaretle (sim.)'}
                                </button>
                              </>
                            )}
                          </div>

                          {/* Sıradaki birim uyarısı (skip-logic önizleme) */}
                          <div className="pt-3 border-t border-slate-50 space-y-2">
                            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter text-slate-400">
                              <ArrowRight size={12} className="text-primary" />
                              {nextActive
                                ? <span className="text-slate-600">Sıradaki: <span className="text-primary">{unitName(nextActive.unitId)}</span></span>
                                : <span className="text-slate-400">Akış sonu (devir yok)</span>}
                            </div>
                            {fallbackUsed && (
                              <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2">
                                <AlertCircle size={12} className="text-amber-500 mt-0.5 shrink-0" />
                                <p className="text-[10px] font-bold text-amber-700 leading-tight">
                                  Tanımlı sonraki birim ({removedUnitName}) akıştan çıkarılmış — görev {nextActive ? unitName(nextActive.unitId) : 'akış sonuna'} yönlendirilecek.
                                </p>
                              </div>
                            )}
                            {!isDisabled && (
                              <button
                                onClick={() => handleForward(step)}
                                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-primary transition-all"
                              >
                                <ArrowRight size={12} /> Sonraki birime aktar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );})}
                </AnimatePresence>
              </div>
            ) : (
              <div className="h-[400px] flex flex-col items-center justify-center text-center p-12 glass-panel rounded-[40px] border-dashed bg-slate-50/50">
                <div className="w-20 h-20 bg-white text-slate-300 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
                  <GitBranch size={40} />
                </div>
                <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">İş Akışı Tanımlanmamış</h4>
                <p className="text-sm text-slate-400 font-bold max-w-xs mt-2 italic">Bu şirket için henüz bir operasyonel iş akışı yapılandırılmadı. Tasarıma başlamak için sağ üstteki butonu kullanın.</p>
              </div>
            )}
          </div>
        </div>
      ) : simSteps.length === 0 || !activeSimStep ? (
        <div className="h-[400px] flex flex-col items-center justify-center text-center p-12 glass-panel rounded-[40px] border-dashed bg-slate-50/50 animate-in fade-in duration-500">
          <div className="w-20 h-20 bg-white text-slate-300 rounded-3xl flex items-center justify-center mb-6 shadow-sm"><GitBranch size={40} /></div>
          <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Simüle Edilecek Akış Yok</h4>
          <p className="text-sm text-slate-400 font-bold max-w-xs mt-2 italic">Önce Tasarım sekmesinden bu şirketin iş akışını (adımları) tanımlayın; simülasyon gerçek akışı adım adım gösterir.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-700">
          <div className="lg:col-span-4 space-y-4">
            <div className="glass-panel p-6 rounded-[32px] bg-slate-900 text-white relative overflow-hidden">
               <div className="relative z-10">
                 <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2 italic">Akış Durumu (gerçek)</p>
                 <h4 className="text-lg font-black uppercase italic tracking-tighter leading-tight mb-4">Dijital Süreç İzleyici</h4>
                 <div className="space-y-3">
                   {simSteps.map((s, i) => (
                     <div key={s.id} className={cn("flex items-center gap-3 p-3 rounded-2xl transition-all", i === currentSimStep ? "bg-white/20 border border-white/20 shadow-lg" : "opacity-40")}>
                        <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black", i === currentSimStep ? "bg-primary text-white" : "bg-white/10 text-white")}>{i+1}</div>
                        <span className="text-[10px] font-bold uppercase tracking-widest truncate">{s.unit}</span>
                     </div>
                   ))}
                 </div>
               </div>
               <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setIsAutoPlaying(!isAutoPlaying)} className={cn("flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all", isAutoPlaying ? "bg-orange-500 text-white" : "bg-primary text-white")}>
                {isAutoPlaying ? <><Pause size={14} /> Duraklat</> : <><Play size={14} /> Otomatik Oynat</>}
              </button>
              <button onClick={() => setCurrentSimStep(0)} className="p-4 bg-white border border-slate-100 text-slate-400 rounded-2xl hover:text-primary transition-all">
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-6">
            <AnimatePresence mode="wait">
              <motion.div key={currentSimStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="glass-panel p-8 rounded-[40px] border-slate-100 bg-white relative overflow-hidden">
                   <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center"><Activity size={24} /></div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aşama {currentSimStep + 1} / {simSteps.length}</p>
                          <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">{activeSimStep.unit}</h4>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={cn("text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest", activeSimStep.type === 'AUTO' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                          {activeSimStep.type === 'AUTO' ? 'Otomatik Adım' : 'Manuel Adım'}
                        </span>
                        {!activeSimStep.enabled && <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Atlanıyor (devre dışı)</span>}
                      </div>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><ListTodo size={12} /> İşlem Detayı</p>
                        <p className="text-sm text-slate-700 font-medium leading-relaxed italic">{activeSimStep.description ? `"${activeSimStep.description}"` : 'Bu adım için açıklama girilmemiş.'}</p>
                      </div>
                      <div className="space-y-4">
                        <div className="p-5 bg-indigo-50 border border-indigo-100 rounded-3xl flex items-center gap-3">
                          <Zap size={16} className="text-indigo-500 shrink-0" />
                          <p className="text-[11px] text-indigo-700 font-bold">
                            {activeSimStep.requiresCompletion ? 'Tamamlanması ZORUNLU — bir sonraki birime geçmeden önce bu adım kapatılmalı.' : 'Tamamlanması opsiyonel — akış beklemeden ilerleyebilir.'}
                          </p>
                        </div>
                        <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-3xl flex items-center gap-3">
                          <ArrowRight size={16} className="text-emerald-500 shrink-0" />
                          <p className="text-[11px] text-emerald-700 font-bold">
                            {currentSimStep < simSteps.length - 1 ? `Sonraki birim: ${simSteps[currentSimStep + 1].unit}` : 'Son adım — akış burada tamamlanır.'}
                          </p>
                        </div>
                      </div>
                   </div>
                </div>

                <div className="flex justify-between items-center pt-4">
                  <button onClick={() => setCurrentSimStep(prev => Math.max(0, prev - 1))} disabled={currentSimStep === 0} className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-primary transition-all disabled:opacity-30 flex items-center gap-2"><ChevronRight size={14} className="rotate-180" /> Önceki Adım</button>
                  <div className="flex gap-2">
                    {simSteps.map((_, i) => (
                      <div key={i} className={cn("w-1.5 h-1.5 rounded-full transition-all", i === currentSimStep ? "bg-primary w-4" : "bg-slate-200")} />
                    ))}
                  </div>
                  <button onClick={() => setCurrentSimStep(prev => Math.min(simSteps.length - 1, prev + 1))} disabled={currentSimStep === simSteps.length - 1} className="px-6 py-3 text-[10px] font-black text-primary uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-30 flex items-center gap-2">Sonraki Adım <ChevronRight size={14} /></button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Devir uyarı modalı — sıradaki birim + hazırlayan birim gereklilik kontrolü */}
      <AnimatePresence>
        {handoffModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
            onClick={() => setHandoffModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md glass-panel bg-white rounded-[32px] p-8 shadow-2xl border border-slate-100"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", handoffModal.blocked ? "bg-amber-50 text-amber-500" : "bg-primary/10 text-primary")}>
                    {handoffModal.blocked ? <ShieldAlert size={24} /> : <ArrowRight size={24} />}
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter leading-none">Görev Devri</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{unitName(handoffModal.step.unitId)}</p>
                  </div>
                </div>
                <button onClick={() => setHandoffModal(null)} className="p-2 text-slate-300 hover:text-slate-600 rounded-xl transition-all"><X size={18} /></button>
              </div>

              {handoffModal.blocked && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-3">
                  <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-black text-amber-700 uppercase tracking-tighter mb-1">Hazırlayan birim gereklilikleri tamamlamadı</p>
                    <p className="text-[11px] font-medium text-amber-700 leading-relaxed">
                      {unitName(handoffModal.step.unitId)} birimi henüz akış gerekliliklerini tamamlamadı{handoffModal.step.completionNote ? ` (${handoffModal.step.completionNote})` : ''}. Yine de sonraki birime aktarmak istiyor musunuz?
                    </p>
                  </div>
                </div>
              )}

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Görev şu birime aktarılacak</p>
                {handoffModal.nextUnitName ? (
                  <div className="flex items-center gap-2">
                    <ArrowRight size={16} className="text-primary" />
                    <span className="text-sm font-black text-slate-900">{handoffModal.nextUnitName}</span>
                  </div>
                ) : (
                  <p className="text-sm font-bold text-slate-500 italic">Akışın son adımı — devredilecek başka birim yok.</p>
                )}
                {handoffModal.nextDescription && <p className="text-[11px] text-slate-500 font-medium mt-1.5">{handoffModal.nextDescription}</p>}
              </div>

              {handoffModal.fallbackUsed && (
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-2 mb-2">
                  <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[10px] font-bold text-amber-700 leading-tight">
                    Tanımlı sonraki birim ({handoffModal.removedUnitName}) akıştan çıkarılmış — görev otomatik olarak yukarıdaki aktif birime yönlendiriliyor.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-3 mt-6">
                <button onClick={() => setHandoffModal(null)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Vazgeç</button>
                <button
                  onClick={() => setHandoffModal(null)}
                  className={cn("flex-1 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all", handoffModal.blocked ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-primary text-white hover:bg-primary/90")}
                >
                  {handoffModal.blocked ? 'Yine de Aktar' : 'Aktar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* "+ Yeni Süreç" modalı — sabit taksonomi dışında, tenant'ın kendi
          tanımladığı özel süreç. Ad + hedef kaydı türü (jenerik tetikleme
          ucunun hangi varlığa uygulanacağını bilmesi için zorunlu) sorulur. */}
      <AnimatePresence>
        {newProcessModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
            onClick={() => setNewProcessModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md glass-panel bg-white rounded-[32px] p-8 shadow-2xl border border-slate-100"
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h4 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter leading-none">Yeni Süreç</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sabit listede olmayan, kendi tanımınız</p>
                </div>
                <button onClick={() => setNewProcessModal(false)} className="p-2 text-slate-300 hover:text-slate-600 rounded-xl transition-all"><X size={18} /></button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Süreç Adı</label>
                  <input
                    type="text"
                    value={newProcessName}
                    onChange={(e) => setNewProcessName(e.target.value)}
                    placeholder='Örn: "Proje Kapanış Onayı"'
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-primary/20 transition-all"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Hedef Kaydı Türü</label>
                  <select
                    value={newProcessEntityType}
                    onChange={(e) => setNewProcessEntityType(e.target.value as EntityType | '')}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-primary/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Seçin…</option>
                    {ENTITY_TYPES.map((t) => <option key={t} value={t}>{ENTITY_TYPE_LABEL[t]}</option>)}
                  </select>
                  <p className="text-[10px] text-slate-400 font-medium px-1 leading-relaxed">
                    Bu süreç hangi kayıt üzerinde çalışacak (örn. Proje). İlgili kaydın ekranında bu süreci elle başlatabileceğiniz bir buton çıkar.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6">
                <button onClick={() => setNewProcessModal(false)} className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all">Vazgeç</button>
                <button
                  onClick={handleConfirmCreateCustomProcess}
                  disabled={!newProcessName.trim() || !newProcessEntityType}
                  className="flex-1 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all bg-primary text-white hover:bg-primary/90 disabled:opacity-40"
                >
                  Oluştur
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorkflowBuilder;

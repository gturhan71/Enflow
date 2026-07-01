import React, { useState, useEffect, useMemo } from 'react';
import { logger } from '../utils/logger';
import { motion, AnimatePresence } from 'motion/react';
import {
  GitBranch, ArrowRight, Plus, Settings2, Activity, CheckCircle2,
  AlertCircle, Save, Zap, Info, ChevronRight, Play, Pause, RefreshCw, ListTodo,
  Building, Mail, Power, ShieldAlert, X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Unit, Workflow, WorkflowStep, ApprovalStage } from '../types';
import { apiService } from '../services/apiService';
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext';

const WorkflowBuilder = ({ units = [] }: { units?: Unit[] }) => {
  const { setHasUnsavedChanges } = useUnsavedChanges();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
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
    fetchWorkflows();
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isAutoPlaying && simSteps.length > 0) {
      interval = setInterval(() => {
        setCurrentSimStep(prev => (prev >= simSteps.length - 1 ? 0 : prev + 1));
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isAutoPlaying, simSteps.length]);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const data = await apiService.getWorkflows();
      const safeData = Array.isArray(data) ? data : [];
      if (safeData.length > 0) {
        setWorkflows(safeData);
        // Tüm birimleri kapsayan varsayılan şablon varsa onu öne çıkar (seçici UI yok);
        // yoksa ilk workflow'u göster.
        const preferred = safeData.find(w => w.isDefault) ?? safeData[0];
        setActiveWorkflow(preferred);
      } else {
        // Tüm birimleri kapsayan varsayılan şablonu getir (yoksa backend oluşturur)
        const def = await apiService.getDefaultWorkflow();
        if (def && def.id) {
          setWorkflows([def]);
          setActiveWorkflow(def);
        } else {
          setWorkflows([]);
          setActiveWorkflow(null);
        }
      }
    } catch (error) {
      logger.error('Workflows could not be loaded', error);
      setWorkflows([]);
      setActiveWorkflow(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAddApprovalStage = () => {
    if (!activeWorkflow) return;
    const newStage: ApprovalStage = { id: `stage-${Date.now()}`, role: 'Manager', status: 'PENDING' };
    const updatedWorkflow = { 
      ...activeWorkflow, 
      stages: [...(activeWorkflow.stages || []), newStage] 
    };
    setActiveWorkflow(updatedWorkflow);
  };

  const renderApprovalBuilder = () => (
    <div className="glass-panel p-6 rounded-2xl bg-white/50 space-y-4">
      <h5 className="font-bold">Onay Zinciri</h5>
      {activeWorkflow?.stages?.map((stage, i) => (
        <div key={stage.id} className="flex items-center gap-2">
          <span className="text-sm font-bold bg-slate-200 px-3 py-1 rounded-full">{i + 1}</span>
          <input className="p-2 border rounded-lg text-sm" value={stage.role || ''} onChange={(e) => {
            if (!activeWorkflow) return;
            const updated = { ...activeWorkflow, stages: (activeWorkflow.stages || []).map((s) => s.id === stage.id ? { ...s, role: e.target.value } : s) };
            setActiveWorkflow(updated as Workflow);
          }} />
        </div>
      ))}
      <button onClick={handleAddApprovalStage} className="text-xs bg-primary text-white px-4 py-2 rounded-lg">+ Aşama Ekle</button>
    </div>
  );

  const handleAddStep = () => {
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      unitId: units && units.length > 0 ? units[0].id : 'default-unit',
      type: 'AUTO',
      description: 'Yeni işlem adımı',
      order: activeWorkflow ? (activeWorkflow.steps?.length || 0) : 0,
      nextStepId: null,
      enabled: true,
      requiresCompletion: false,
      completionNote: null
    };

    if (!activeWorkflow) {
      const newWorkflow: Workflow = {
        id: `wf-${Date.now()}`,
        name: 'Yeni İş Akışı',
        description: 'Birimler arası süreç tanımı',
        steps: [newStep],
        stages: []
      };
      setActiveWorkflow(newWorkflow);
    } else {
      const updatedWorkflow = { 
        ...activeWorkflow, 
        steps: [...(activeWorkflow.steps || []), newStep] 
      };
      setActiveWorkflow(updatedWorkflow);
    }
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

  const unitName = (id: string) => units.find(u => u.id === id)?.name ?? 'Bilinmeyen Birim';

  // Skip-resolution (backend resolveNextStep ile aynı mantık — anlık UI için lokal hesap):
  // bir adımdan sonra görevin aktarılacağı ilk AKTİF (enabled) adımı bulur.
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
        await apiService.updateWorkflow(activeWorkflow.id, activeWorkflow);
      } else {
        const saved = await apiService.createWorkflow(activeWorkflow);
        setWorkflows(prev => [...prev, saved]);
        setActiveWorkflow(saved);
      }
      alert('İş akışı başarıyla kaydedildi.');
    } catch (error) {
      alert((error instanceof Error ? error.message : '') || 'Kayıt sırasında hata oluştu.');
    } finally {
      setSaving(false);
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
                Akış Yönetimi & Simülasyon
              </h4>
              {activeWorkflow?.isDefault && (
                <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[9px] font-black uppercase tracking-tighter">Varsayılan Şablon</span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-bold">Fırsattan teslimata uçtan uca tüm operasyonel süreci izleyin ve simüle edin.</p>
          </div>
        </div>
        
        {activeTab === 'builder' && (
          <div className="flex items-center gap-3">
            <button 
              onClick={handleAddStep}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:border-primary/40 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"
            >
              <Plus size={16} /> ADIM EKLE
            </button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="px-8 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2"
            >
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
              AKIŞI KAYDET
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 border-b border-slate-100 pb-2">
        <button
          onClick={() => setActiveTab('simulation')}
          className={cn(
            "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
            activeTab === 'simulation' ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white text-slate-500 border border-slate-100 hover:bg-slate-50"
          )}
        >
          <Activity size={14} /> Akış Simülasyonu (CRM → Kapanış)
        </button>
        <button
          onClick={() => setActiveTab('builder')}
          className={cn(
            "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === 'builder' ? "bg-slate-900 text-white" : "bg-white text-slate-500 border border-slate-100 hover:bg-slate-50"
          )}
        >
          İş Akışı Tasarımcısı
        </button>
      </div>

      {activeTab === 'builder' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            {activeWorkflow ? (
              <div className="relative min-h-[400px] flex flex-wrap gap-8 items-start justify-center lg:justify-start pt-4 pb-12 overflow-x-auto custom-scrollbar">
                <AnimatePresence mode="popLayout">
                  {activeWorkflow.steps?.map((step, index) => {
                    const isDisabled = step.enabled === false;
                    const { nextActive, fallbackUsed, removedUnitName } = getNextInfo(step);
                    const simDone = simCompleted.has(step.id);
                    return (
                    <motion.div key={step.id} layout initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative group">
                      <div className={cn(
                        "w-72 glass-panel p-6 rounded-[32px] bg-white border shadow-sm transition-all duration-300 relative z-10",
                        isDisabled ? "border-slate-200 opacity-60 grayscale" : "border-slate-100 hover:shadow-xl hover:border-primary/30"
                      )}>
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs", isDisabled ? "bg-slate-100 text-slate-400" : "bg-primary/10 text-primary")}>{index + 1}</div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{isDisabled ? 'Çıkarıldı' : 'Aşama'}</span>
                          </div>
                          <button
                            onClick={() => handleToggleEnabled(step.id)}
                            title={isDisabled ? 'Akışa geri al' : 'Akıştan çıkar (görevler sıradaki birime yönlenir)'}
                            className={cn("p-2 rounded-xl transition-all", isDisabled ? "text-slate-400 hover:text-emerald-600 hover:bg-emerald-50" : "text-slate-300 hover:text-red-500 hover:bg-red-50")}
                          ><Power size={16} /></button>
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
          <div className="lg:col-span-1">
            {activeWorkflow && renderApprovalBuilder()}
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
    </div>
  );
};

export default WorkflowBuilder;

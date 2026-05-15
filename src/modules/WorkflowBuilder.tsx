import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GitBranch, 
  ArrowRight, 
  Plus, 
  Trash2, 
  Settings2, 
  Activity,
  CheckCircle2,
  AlertCircle,
  Save,
  Zap,
  Info,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Unit, Workflow, WorkflowStep } from '../types';
import { apiService } from '../services/apiService';

const WorkflowBuilder = ({ units }: { units: Unit[] }) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const data = await apiService.getWorkflows();
      setWorkflows(data);
      if (data.length > 0) setActiveWorkflow(data[0]);
    } catch (error) {
      console.error('Workflows could not be loaded');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStep = () => {
    if (!activeWorkflow) {
      const newWorkflow: Partial<Workflow> = {
        name: 'Yeni İş Akışı',
        description: 'Birimler arası süreç tanımı',
        steps: []
      };
      setActiveWorkflow(newWorkflow as Workflow);
      return;
    }

    const newStep: Partial<WorkflowStep> = {
      id: `temp-${Date.now()}`,
      unitId: units[0]?.id || '',
      type: 'AUTO',
      description: 'Yeni işlem adımı',
      order: activeWorkflow.steps.length,
      nextStepId: null
    };

    const updatedSteps = [...activeWorkflow.steps, newStep as WorkflowStep];
    setActiveWorkflow({ ...activeWorkflow, steps: updatedSteps });
  };

  const handleRemoveStep = (id: string) => {
    if (!activeWorkflow) return;
    const updatedSteps = activeWorkflow.steps.filter(s => s.id !== id);
    setActiveWorkflow({ ...activeWorkflow, steps: updatedSteps });
  };

  const handleUpdateStep = (id: string, data: Partial<WorkflowStep>) => {
    if (!activeWorkflow) return;
    const updatedSteps = activeWorkflow.steps.map(s => s.id === id ? { ...s, ...data } : s);
    setActiveWorkflow({ ...activeWorkflow, steps: updatedSteps });
  };

  const handleSave = async () => {
    if (!activeWorkflow) return;
    setSaving(true);
    try {
      if (activeWorkflow.id) {
        await apiService.updateWorkflow(activeWorkflow.id, activeWorkflow);
      } else {
        const saved = await apiService.createWorkflow(activeWorkflow);
        setWorkflows([...workflows, saved]);
        setActiveWorkflow(saved);
      }
      alert('İş akışı başarıyla kaydedildi.');
    } catch (error: any) {
      alert(error.message || 'Kayıt sırasında hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const simulationPath = useMemo(() => {
    if (!activeWorkflow) return [];
    return activeWorkflow.steps;
  }, [activeWorkflow]);

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Akışlar Yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 glass-panel p-8 rounded-[32px] bg-white/40 border-white/60">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-inner">
            <GitBranch size={28} />
          </div>
          <div>
            <h4 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic leading-none mb-1">
              {activeWorkflow?.name || 'İş Akışı Tasarımcısı'}
            </h4>
            <p className="text-xs text-slate-500 font-bold">Birimler arası operasyonel devir kurallarını yapılandırın.</p>
          </div>
        </div>
        
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
      </div>

      {/* Builder Canvas */}
      <div className="relative min-h-[400px] flex flex-wrap gap-8 items-start justify-center lg:justify-start pt-4 pb-12 overflow-x-auto custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {activeWorkflow?.steps.map((step, index) => {
            return (
              <motion.div 
                key={step.id}
                layout
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative group"
              >
                {/* Node Card */}
                <div className="w-72 glass-panel p-6 rounded-[32px] bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 relative z-10">
                  {/* Step Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-black text-xs">
                        {index + 1}
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aşama</span>
                    </div>
                    <button 
                      onClick={() => handleRemoveStep(step.id)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Step Body */}
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sorumlu Birim</label>
                        <Info size={12} className="text-slate-300" />
                      </div>
                      <select 
                        value={step.unitId}
                        onChange={(e) => handleUpdateStep(step.id, { unitId: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-black text-slate-900 outline-none focus:bg-white focus:border-primary/20 transition-all appearance-none cursor-pointer"
                      >
                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">İşlem Detayı</label>
                      <input 
                        type="text" 
                        value={step.description}
                        placeholder="Örn: Teknik Analiz Raporu"
                        onChange={(e) => handleUpdateStep(step.id, { description: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-primary/20 transition-all"
                      />
                    </div>

                    <div className="pt-4 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                          step.type === 'AUTO' ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"
                        )}>
                          {step.type === 'AUTO' ? <Zap size={14} /> : <CheckCircle2 size={14} />}
                        </div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                          {step.type === 'AUTO' ? 'OTOMATİK DEVİR' : 'MANUEL ONAY'}
                        </span>
                      </div>
                      
                      <button 
                        onClick={() => handleUpdateStep(step.id, { type: step.type === 'AUTO' ? 'MANUAL' : 'AUTO' })}
                        className="p-2 hover:bg-slate-50 rounded-lg text-primary transition-all"
                      >
                        <Settings2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Connection Arrow */}
                {index < activeWorkflow!.steps.length - 1 && (
                  <div className="absolute top-1/2 -right-8 -translate-y-1/2 w-8 h-px bg-slate-200 z-0 hidden lg:block">
                    <div className="absolute -right-1 -top-1.5 text-slate-300">
                      <ChevronRight size={14} strokeWidth={3} />
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {(!activeWorkflow || activeWorkflow.steps.length === 0) && (
          <div className="w-full py-24 text-center glass-panel rounded-[40px] border-2 border-dashed border-slate-200 flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center">
              <GitBranch size={32} />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 uppercase tracking-tight">Akış Yapısı Boş</p>
              <p className="text-xs text-slate-400 font-medium mt-1">Süreci başlatmak için ilk adımı ekleyin.</p>
            </div>
            <button 
              onClick={handleAddStep}
              className="mt-4 px-8 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20"
            >
              İLK ADIMI EKLE
            </button>
          </div>
        )}
      </div>

      {/* Simulation & Logic Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-panel p-8 rounded-[40px] bg-slate-900 text-white shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 blur-[100px] rounded-full group-hover:bg-primary/30 transition-colors duration-700" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center text-primary">
                  <Activity size={20} />
                </div>
                <div>
                  <h5 className="text-lg font-black tracking-tighter uppercase italic">Akış Simülasyonu</h5>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gerçek Zamanlı Süreç Analizi</p>
                </div>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest">
                <CheckCircle2 size={12} /> SİSTEM AKTİF
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              {simulationPath.map((s, i) => (
                <React.Fragment key={s.id}>
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex flex-col gap-1 px-5 py-3 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md hover:bg-white/10 transition-colors"
                  >
                    <span className="text-[9px] text-primary font-black uppercase tracking-widest">
                      {units.find(u => u.id === s.unitId)?.name || 'Bilinmeyen'}
                    </span>
                    <span className="text-xs font-bold text-white">{s.description}</span>
                  </motion.div>
                  {i < simulationPath.length - 1 && <ArrowRight size={16} className="text-white/20" />}
                </React.Fragment>
              ))}
            </div>

            <div className="mt-10 pt-10 border-t border-white/5 flex items-start gap-4">
              <div className="p-3 bg-primary/20 text-primary rounded-2xl">
                <Info size={24} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black uppercase tracking-tight text-white">Otomatik Bildirim Sistemi</p>
                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                  Her aşama geçişinde, ilgili birim yöneticisine **WhatsApp Business** ve **Sistem Bildirimi** üzerinden otomatik iş ataması yapılacaktır. 
                  Gecikme durumunda üst birime otomatik "Eskalasyon" bildirimi tetiklenir.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-8 rounded-[40px] bg-white border-white/60 flex flex-col justify-between">
          <div>
            <h5 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
              <AlertCircle size={16} className="text-primary" />
              AKILLI KURALLAR
            </h5>
            <div className="space-y-4">
              {[
                { label: 'SLA Takibi', desc: 'Adım başına max 48 saat.', color: 'bg-blue-50 text-blue-600' },
                { label: 'Rol Bazlı Onay', desc: 'Sadece birim müdürleri.', color: 'bg-purple-50 text-purple-600' },
                { label: 'Log Kaydı', desc: 'Her değişim kriptografik imzalı.', color: 'bg-emerald-50 text-emerald-600' },
              ].map(rule => (
                <div key={rule.label} className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", rule.color)}>{rule.label}</p>
                  <p className="text-xs text-slate-500 font-medium">{rule.desc}</p>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-8 p-4 bg-primary/5 rounded-2xl border border-primary/10">
            <p className="text-[10px] text-primary font-black uppercase text-center tracking-widest">Sistem v1.2.0 Hardened</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowBuilder;

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GitBranch, ArrowRight, Plus, Trash2, Settings2, Activity, CheckCircle2, 
  AlertCircle, Save, Zap, Info, ChevronRight, Play, Pause, RefreshCw, ListTodo
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Unit, Workflow, WorkflowStep, ApprovalStage } from '../types';
import { apiService } from '../services/apiService';

const SIMULATION_STEPS = [
  {
    id: 'step-1',
    title: 'CRM & Fırsat Oluşturma',
    unit: 'Satış & Pazarlama',
    role: 'Satış Temsilcisi',
    assignee: 'Ali Veli',
    description: 'Müşteri ile ilk görüşme yapılır. Müşteri veri tabanına "Global Bank A.Ş." eklenir ve $250,000 değerinde "Veri Merkezi Genişletme" fırsatı (CRM Fırsatı) açılır.',
    entityCreated: {
      model: 'Opportunity (Prisma)',
      data: { id: 'opp-250k', title: 'Veri Merkezi Genişletme', customerId: 'c1', value: 250000, status: 'QUALIFIED' }
    },
    whatsapp: 'Sistem: [Enflow CRM] "Veri Merkezi Genişletme" isimli yeni bir fırsat başarıyla CRM sistemine tanımlandı.',
    email: {
      to: 'sales-mgr@t-ecosystem.com',
      subject: 'Yeni Fırsat Tanımlandı',
      body: `Merhaba,

Global Bank A.Ş. için yeni bir fırsat tanımlanmıştır.`
    },
    taskCreated: 'Presales birimi için teknik analiz hazırlama işi otomatik oluşturuldu.'
  },
  {
    id: 'step-2',
    title: 'Presales & Yapay Zeka Analizi',
    unit: 'Teknik Çözümler (Presales)',
    role: 'Presales Mühendisi',
    assignee: 'Göktuğ Turhan',
    description: 'Müşteri şartnamesi sisteme yüklenir. AI analizi sonrası BoM listesi çıkarılır.',
    entityCreated: {
      model: 'BoMItem[] (Prisma)',
      data: [{ id: 'bom-1', partNumber: 'DELL-R750-01', description: 'PowerEdge R750 Server', quantity: 4, purchaseCost: 4500, status: 'MATCHED' }]
    },
    whatsapp: 'Sistem: [Enflow Presales] Şartname analizi tamamlandı.',
    email: {
      to: 'goktugturhan74@gmail.com',
      subject: 'AI Şartname Analizi Tamamlandı',
      body: `Merhaba,

Şartname analizi tamamlanmıştır.`
    },
    taskCreated: 'BoM onay bekliyor durumuna getirildi.'
  },
  {
    id: 'step-3',
    title: 'Maliyet Analizi & Kâr Marjı',
    unit: 'Satış Destek & Maliyet',
    role: 'Satış Destek Yöneticisi',
    assignee: 'Ali Veli',
    description: 'Ürünlerin alış maliyetleri üzerinden hedef kâr marjları belirlenir.',
    entityCreated: {
      model: 'CostRequirement & Proposal',
      data: { proposalValue: 250000, margin: 15, status: 'AWAITING_APPROVAL' }
    },
    whatsapp: 'Sistem: [Enflow Onay] Fiyatlandırma onayınıza sunulmuştur.',
    email: {
      to: 'gokhan@t-ecosystem.com',
      subject: 'ACİL ONAY: Satış Teklifi',
      body: `Sayın Gökhan Turhan,

Teklif onay süreci başlamıştır.`
    },
    taskCreated: 'Genel Müdür için onay görevi oluşturuldu.'
  },
  {
    id: 'step-4',
    title: 'Müşteri Teklifi & Kazanım (Won)',
    unit: 'Satış & Pazarlama',
    role: 'Satış Temsilcisi',
    assignee: 'Ali Veli',
    description: 'Teklif PDF üretilir ve müşteri kabulü ile fırsat WON statüsüne geçer.',
    entityCreated: {
      model: 'Opportunity (Updated)',
      data: { id: 'opp-250k', status: 'WON' }
    },
    whatsapp: 'Sistem: [Tebrikler 🎉] Proje kazanıldı!',
    email: {
      to: 'sales-all@t-ecosystem.com',
      subject: 'TEBRİKLER: Proje Kazanıldı!',
      body: `Merhaba Enflow Ailesi,

Proje resmi olarak kazanılmıştır.`
    },
    taskCreated: 'Sözleşme taslağı oluşturuldu.'
  },
  {
    id: 'step-5',
    title: 'Sözleşme & Evrak Doğrulama',
    unit: 'Satış Destek Birimi',
    role: 'Satış Destek Sorumlusu',
    assignee: 'Ali Veli',
    description: 'Gerekli tüm idari evraklar toplanır ve doğrulanır.',
    entityCreated: {
      model: 'Contract Documents',
      data: { status: 'ALL_APPROVED' }
    },
    whatsapp: 'Sistem: [Enflow Sözleşme] Evraklar doğrulandı.',
    email: {
      to: 'legal@t-ecosystem.com',
      subject: 'Sözleşme Evrakları Doğrulandı',
      body: `Merhaba,

İdari evrak doğrulama süreci tamamlanmıştır.`
    },
    taskCreated: 'Sözleşme "İmzalandı" durumuna hazır.'
  },
  {
    id: 'step-6',
    title: 'Sözleşme İmzalama & Paralel Devir',
    unit: 'Genel Müdürlük & Operasyon',
    role: 'Genel Müdür',
    assignee: 'Gökhan Turhan',
    description: 'Sözleşme imzalanır, PM ve Satınalma süreçleri başlar.',
    entityCreated: {
      model: 'Project & Parallel Tasks',
      data: { projectId: 'proj-101', status: 'IN_PROGRESS' }
    },
    whatsapp: 'Sistem: [Paralel İş Akışı ⚡] Sözleşme imzalandı!',
    email: {
      to: 'pm@t-ecosystem.com',
      subject: 'PROJE BAŞLATILDI',
      body: `Sayın Yöneticiler,

Sözleşme imzalanmıştır.`
    },
    taskCreated: 'İş emirleri oluşturuldu.'
  },
  {
    id: 'step-7',
    title: 'Satın Alma & Proje Uygulama',
    unit: 'Satın Alma & Operasyon',
    role: 'Operasyon Sorumlusu',
    assignee: 'Göktuğ Turhan',
    description: 'Tedarik ve kabul testleri (UAT) tamamlanır.',
    entityCreated: {
      model: 'Procurement & KanbanTasks',
      data: { deliveryStatus: 'DELIVERED', uatTest: 'SUCCESSFUL' }
    },
    whatsapp: 'Sistem: [Enflow Saha] Teslimat ve UAT tamamlandı.',
    email: {
      to: 'proc@t-ecosystem.com',
      subject: 'Tedarik ve Kabul Testleri Tamamlandı',
      body: `Merhaba,

UAT kabul testleri başarıyla verilmiştir.`
    },
    taskCreated: 'Proje görevleri tamamlandı.'
  },
  {
    id: 'step-8',
    title: 'Proje Kapanış & Arşivleme',
    unit: 'Operasyon & Fiziksel Arşiv',
    role: 'Arşiv Sorumlusu',
    assignee: 'Gökhan Turhan',
    description: 'Müşteri kabul tutanağı yüklenir ve arşivlenir.',
    entityCreated: {
      model: 'Project & PhysicalArchive',
      data: { projectStatus: 'COMPLETED', archiveLocation: 'Oda A, Raf 3, Kutu 12' }
    },
    whatsapp: 'Sistem: [Başarı! 🎓] Proje kapandı ve arşivlendi.',
    email: {
      to: 'gokhan@t-ecosystem.com',
      subject: 'PROJE TAMAMLANDI',
      body: `Sayın Gökhan Turhan,

Proje başarıyla tamamlanmıştır.`
    },
    taskCreated: 'Proje sonlandırıldı.'
  }
];

export const WorkflowBuilder = ({ units }: { units: Unit[] }) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'builder' | 'simulation'>('simulation');

  const [currentSimStep, setCurrentSimStep] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  useEffect(() => {
    let interval: any;
    if (isAutoPlaying) {
      interval = setInterval(() => {
        setCurrentSimStep(prev => (prev === SIMULATION_STEPS.length - 1 ? 0 : prev + 1));
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

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

  const handleAddApprovalStage = () => {
    if (!activeWorkflow) return;
    const newStage: ApprovalStage = { id: `stage-\${Date.now()}`, role: 'Manager', status: 'PENDING' };
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
          <input className="p-2 border rounded-lg text-sm" value={stage.role} onChange={(e) => {
            const updated = { ...activeWorkflow, stages: activeWorkflow.stages.map((s) => s.id === stage.id ? { ...s, role: e.target.value } : s) };
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
      unitId: units[0]?.id || '',
      type: 'AUTO',
      description: 'Yeni işlem adımı',
      order: activeWorkflow ? activeWorkflow.steps.length : 0,
      nextStepId: null
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
        steps: [...activeWorkflow.steps, newStep] 
      };
      setActiveWorkflow(updatedWorkflow);
    }
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

  const activeSimStep = SIMULATION_STEPS[currentSimStep];

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Akışlar Yükleniyor...</p>
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
            <h4 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic leading-none mb-1">
              Akış Yönetimi & Simülasyon
            </h4>
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
            <div className="relative min-h-[400px] flex flex-wrap gap-8 items-start justify-center lg:justify-start pt-4 pb-12 overflow-x-auto custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {activeWorkflow?.steps.map((step, index) => (
                  <motion.div key={step.id} layout initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative group">
                    <div className="w-72 glass-panel p-6 rounded-[32px] bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all duration-300 relative z-10">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-black text-xs">{index + 1}</div>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aşama</span>
                        </div>
                        <button onClick={() => handleRemoveStep(step.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                      </div>
                      <div className="space-y-5">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between px-1"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sorumlu Birim</label><Info size={12} className="text-slate-300" /></div>
                          <select value={step.unitId} onChange={(e) => handleUpdateStep(step.id, { unitId: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-black text-slate-900 outline-none focus:bg-white focus:border-primary/20 transition-all appearance-none cursor-pointer">
                            {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
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
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
          <div className="lg:col-span-1">
            {renderApprovalBuilder()}
          </div>
        </div>
      ) : (
        <div className="space-y-8 animate-in fade-in duration-500">
           {/* (Simülasyon kısmı aynı kalıyor) */}
           <div className="text-center p-10">Simülasyon Aktif</div>
        </div>
      )}
    </div>
  );
};

export default WorkflowBuilder;

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
  ChevronRight,
  MessageSquare,
  Mail,
  Smartphone,
  Play,
  Pause,
  RefreshCw,
  FileText,
  Database,
  ListTodo,
  Briefcase,
  ArrowLeft
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Unit, Workflow, WorkflowStep } from '../types';
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
      data: {
        id: 'opp-250k',
        title: 'Veri Merkezi Genişletme',
        customerId: 'c1',
        value: 250000,
        status: 'QUALIFIED',
        assignedToId: 'cmp9uzx6e0007erw3ki7ym0cv'
      }
    },
    whatsapp: 'Sistem: [Enflow CRM] "Veri Merkezi Genişletme" isimli yeni bir fırsat başarıyla CRM sistemine tanımlandı. Satış Temsilcisi: Ali Veli.',
    email: {
      to: 'sales-mgr@t-ecosystem.com',
      subject: 'Yeni Fırsat Tanımlandı: Veri Merkezi Genişletme',
      body: "Merhaba,\n\nGlobal Bank A.Ş. için $250,000 değerinde yeni bir fırsat tanımlanmıştır. Teknik dizayn aşamasına geçiş için Presales birimi bilgilendirilmiştir.\n\nSaygılarımızla,\nEnflow İş Akışı Motoru"
    },
    taskCreated: 'Presales birimi için teknik analiz hazırlama işi otomatik oluşturuldu.'
  },
  {
    id: 'step-2',
    title: 'Presales & Yapay Zeka Analizi',
    unit: 'Teknik Çözümler (Presales)',
    role: 'Presales Mühendisi',
    assignee: 'Göktuğ Turhan',
    description: 'Müşteri şartnamesi sisteme yüklenir. Gemini AI şartnameyi saniyeler içinde analiz ederek teknik isterleri çıkarır ve BoM (Ürün Kalemleri) listesini otomatik oluşturur.',
    entityCreated: {
      model: 'BoMItem[] (Prisma)',
      data: [
        { id: 'bom-1', partNumber: 'DELL-R750-01', description: 'PowerEdge R750 Server', quantity: 4, purchaseCost: 4500, vendor: 'Arena', status: 'MATCHED' },
        { id: 'bom-2', partNumber: 'CISCO-C9200L', description: 'Catalyst 9200L Switch', quantity: 2, purchaseCost: 2800, vendor: 'Index', status: 'MATCHED' }
      ]
    },
    whatsapp: 'Sistem: [Enflow Presales] Global Bank projesi için teknik şartname analizi tamamlandı. 2 kalemden oluşan BoM listesi sisteme işlendi.',
    email: {
      to: 'goktugturhan74@gmail.com',
      subject: 'AI Şartname Analizi Tamamlandı',
      body: "Merhaba Göktuğ,\n\nGlobal Bank A.Ş. şartnamesine ait yapay zeka analiz raporu ve BoM taslağı hazırlanmıştır. Lütfen presales modülünden kontrol edip onaylayınız.\n\nSaygılarımızla,\nEnflow AI Agent"
    },
    taskCreated: 'BoM onay bekliyor durumuna getirildi ve Satış Destek maliyetlendirme aşamasına aktarıldı.'
  },
  {
    id: 'step-3',
    title: 'Maliyet Analizi & Kâr Marjı',
    unit: 'Satış Destek & Maliyet',
    role: 'Satış Destek Yöneticisi',
    assignee: 'Ali Veli',
    description: 'Ürünlerin alış maliyetleri üzerinden hedef kâr marjları (%15) belirlenir. İşçilik ve nakliye maliyetleri eklenir. Satış teklif bedeli netleşir ve GM onayına sunulur.',
    entityCreated: {
      model: 'CostRequirement & Proposal (Prisma)',
      data: {
        proposalValue: 250000,
        margin: 15,
        laborCost: 1500,
        logisticsCost: 1200,
        status: 'AWAITING_APPROVAL'
      }
    },
    whatsapp: 'Sistem: [Enflow Onay] Gökhan Turhan, Global Bank projesinin %15 marjlı teklif bedeli ($250,000) onayınıza sunulmuştur. Detaylar: /cost-analysis',
    email: {
      to: 'gokhan@t-ecosystem.com',
      subject: 'ACİL ONAY: Global Bank Maliyet & Satış Teklifi',
      body: "Sayın Gökhan Turhan,\n\nPresales ve Satış Destek ekiplerinin hazırladığı Global Bank A.Ş. Veri Merkezi projesinin teklif onay süreci başlamıştır. Teklif Bedeli: $250,000, Hedef Marj: %15. Lütfen onaylayınız.\n\nSaygılarımızla,\nEnflow Süreç Yönetimi"
    },
    taskCreated: 'Genel Müdür için "Teklif ve Fiyatlandırma Onayı" görevi oluşturuldu.'
  },
  {
    id: 'step-4',
    title: 'Müşteri Teklifi & Kazanım (Won)',
    unit: 'Satış & Pazarlama',
    role: 'Satış Temsilcisi',
    assignee: 'Ali Veli',
    description: 'GM onayının ardından sistem otomatik olarak PDF teklif dökümanını üretir. Müşteri teklifi kabul eder, fırsat statüsü "WON" (Kazanıldı) olarak güncellenir.',
    entityCreated: {
      model: 'Opportunity (Prisma - Updated)',
      data: {
        id: 'opp-250k',
        title: 'Veri Merkezi Genişletme',
        status: 'WON',
        value: 250000
      }
    },
    whatsapp: 'Sistem: [Tebrikler 🎉] Global Bank projesi kazanıldı! Fırsat statüsü "WON" olarak güncellendi. Sözleşme Yönetimi modülü otomatik aktive edildi.',
    email: {
      to: 'sales-all@t-ecosystem.com',
      subject: 'TEBRİKLER: Global Bank Projesi Kazanıldı!',
      body: "Merhaba Enflow Ailesi,\n\nUzun süredir takip ettiğimiz Global Bank A.Ş. Veri Merkezi Genişletme fırsatı resmi olarak kazanılmıştır. Emeği geçen tüm ekibi tebrik ederiz!\n\nSaygılarımızla,\nGenel Müdürlük"
    },
    taskCreated: 'Sözleşme Modülünde otomatik bir taslak sözleşme kartı oluşturuldu.'
  },
  {
    id: 'step-5',
    title: 'Sözleşme & Evrak Doğrulama',
    unit: 'Satış Destek Birimi',
    role: 'Satış Destek Sorumlusu',
    assignee: 'Ali Veli',
    description: 'Sözleşmenin resmiyet kazanması için gerekli tüm idari evraklar (Sözleşme Taslağı, SGK Borcu Yoktur, İmza Sirküleri, Ticaret Sicil Gazetesi vb.) toplanır ve doğrulanır. Tüm evraklar onaylanmadan devir kilitlidir.',
    entityCreated: {
      model: 'Contract Documents checklist',
      data: {
        contractId: 'con-101',
        docsRequired: 5,
        docsApproved: 5,
        status: 'ALL_APPROVED_READY_TO_SIGN'
      }
    },
    whatsapp: 'Sistem: [Enflow Sözleşme] Global Bank projesinin gerekli 5 adet idari evrakı Satış Destek tarafından başarıyla doğrulanıp onaylandı.',
    email: {
      to: 'legal@t-ecosystem.com',
      subject: 'Sözleşme Evrakları Doğrulandı - İmza Aşaması',
      body: "Merhaba,\n\nGlobal Bank projesine ait idari evrak doğrulama süreci Satış Destek birimi tarafından eksiksiz tamamlanmıştır. Sözleşme imzalanıp devredilebilir durumdadır.\n\nSaygılarımızla,\nEnflow İş Akışı"
    },
    taskCreated: 'Sözleşme "İmzalandı" durumuna getirilmeye hazır hale getirildi.'
  },
  {
    id: 'step-6',
    title: 'Sözleşme İmzalama & Paralel Devir',
    unit: 'Genel Müdürlük & Operasyon',
    role: 'Genel Müdür',
    assignee: 'Gökhan Turhan',
    description: 'Sözleşme imzalanır ve ıslak imzalı nüsha Fiziksel Arşiv\'e kaydedilir. Sözleşmenin imzalanmasıyla birlikte Proje Yönetimi ve Satın Alma modüllerinde paralel işler başlatılır.',
    entityCreated: {
      model: 'Project & Parallel Tasks (Prisma)',
      data: {
        projectId: 'proj-101',
        name: 'Veri Merkezi Genişletme Projesi',
        pmAssigned: 'Göktuğ Turhan',
        tasksCreated: [
          { id: 'task-pm-1', unitId: 'u4', title: 'Proje Başlatma Planı (PM)', priority: 'HIGH' },
          { id: 'task-proc-1', unitId: 'u3', title: 'BoM Satınalma Başlatma', priority: 'HIGH' }
        ]
      }
    },
    whatsapp: 'Sistem: [Paralel İş Akışı ⚡] Sözleşme imzalandı! Proje Yönetimi ve Satınalma birimlerinde paralel iş emirleri oluşturularak süreçler aktive edildi.',
    email: {
      to: 'pm-mgr@t-ecosystem.com, proc-mgr@t-ecosystem.com',
      subject: 'PARALEL İŞ EMRİ: Global Bank Projesi Başlatıldı',
      body: "Sayın Yöneticiler,\n\nGlobal Bank A.Ş. sözleşmesi imzalanmıştır. Proje Yönetimi için 'Proje Planı Hazırlama' ve Satınalma için 'BoM Cihaz Tedariği' paralel iş akışları başlatılmıştır.\n\nSaygılarımızla,\nEnflow İş Akışı Motoru"
    },
    taskCreated: 'Eş zamanlı iki adet yüksek öncelikli görev ilgili birimlere atandı ve Dashboard canlı akışına yansıdı.'
  },
  {
    id: 'step-7',
    title: 'Satın Alma & Proje Uygulama',
    unit: 'Satın Alma & Operasyon',
    role: 'Operasyon Sorumlusu',
    assignee: 'Göktuğ Turhan / Tedarik',
    description: 'Satın alma ekibi BoM listesindeki Dell sunucuları ve Cisco switchleri Arena ve Index distribütörlerinden sipariş eder. Cihazlar sahaya ulaştığında Kanban tahtasında montaj ve kabul testleri (UAT) adımları tamamlanır.',
    entityCreated: {
      model: 'ProcurementItem & KanbanTasks (Prisma)',
      data: {
        hardwareOrdered: 6,
        deliveryStatus: 'DELIVERED_TO_SITE',
        installation: 'DONE',
        uatTest: 'SUCCESSFUL'
      }
    },
    whatsapp: 'Sistem: [Enflow Saha] Global Bank projesinin tüm donanım tedariği sahaya ulaştı. Montaj ve UAT (Kabul Testleri) başarıyla tamamlandı.',
    email: {
      to: 'proc-mgr@t-ecosystem.com',
      subject: 'Tedarik ve Kabul Testleri Tamamlandı',
      body: "Merhaba,\n\nGlobal Bank projesine ait tüm donanım montajları yapılmış, UAT kabul testleri teknik ekibimiz tarafından başarıyla verilmiştir.\n\nSaygılarımızla,\nSaha Operasyon Ekibi"
    },
    taskCreated: 'Proje görevleri tamamlandı olarak güncellendi ve kapanış akışı tetiklendi.'
  },
  {
    id: 'step-8',
    title: 'Proje Kapanış & Arşivleme',
    unit: 'Operasyon & Fiziksel Arşiv',
    role: 'Arşiv Sorumlusu',
    assignee: 'Gökhan Turhan',
    description: 'Müşteri kabul tutanağı sisteme yüklenir. Islak imzalı sözleşme Fiziksel Arşiv modülünde belirli bir Oda, Raf ve Kutu koduna (Oda A, Raf 3, Kutu 12) kalıcı olarak arşivlenir. Proje "COMPLETED" statüsüne alınır.',
    entityCreated: {
      model: 'Project & PhysicalArchive (Prisma)',
      data: {
        projectId: 'proj-101',
        projectStatus: 'COMPLETED',
        archiveLocation: 'Oda A, Raf 3, Kutu 12',
        closureDate: '17.05.2026'
      }
    },
    whatsapp: 'Sistem: [Başarı! 🎓] Global Bank Projesi başarıyla tamamlandı ve kapatıldı! Islak imzalı tüm dökümanlar Fiziksel Arşiv Oda A, Raf 3, Kutu 12 konumuna kaldırıldı.',
    email: {
      to: 'gokhan@t-ecosystem.com',
      subject: 'PROJE TAMAMLANDI VE KAPATILDI: Global Bank',
      body: "Sayın Gökhan Turhan,\n\nFırsat aşamasından başlayan Global Bank A.Ş. projesi, tüm tedarik, montaj, kabul ve evrak arşivleme adımlarıyla birlikte başarıyla tamamlanmıştır. Destekleriniz için teşekkür ederiz.\n\nSaygılarımızla,\nEnflow ERP Süreç Yönetimi"
    },
    taskCreated: 'Proje başarıyla sonlandırıldı, arşiv logu oluşturuldu ve gelişmeler Dashboard üzerinde yayınlandı.'
  }
];

const WorkflowBuilder = ({ units }: { units: Unit[] }) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'builder' | 'simulation'>('simulation');

  // Simulation State
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
      {/* Header Area */}
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

      {/* Tabs Menu */}
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
        <>
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
                <p className="text-[10px] text-primary font-black uppercase text-center tracking-widest">Sistem v1.2.5 Hardened</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* End-to-End Simulation Dashboard */
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* Timeline Steps Stepper */}
          <div className="glass-panel p-6 rounded-[32px] bg-white border border-slate-100 overflow-x-auto no-scrollbar">
            <div className="flex items-center justify-between min-w-[900px] px-4">
              {SIMULATION_STEPS.map((step, index) => {
                const isActive = index === currentSimStep;
                const isCompleted = index < currentSimStep;
                return (
                  <React.Fragment key={step.id}>
                    <button
                      onClick={() => setCurrentSimStep(index)}
                      className="flex flex-col items-center gap-2 group cursor-pointer focus:outline-none"
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-black text-xs transition-all",
                        isActive ? "bg-primary text-white scale-110 shadow-lg shadow-primary/30" : 
                        isCompleted ? "bg-emerald-500 text-white" : "bg-slate-50 text-slate-400 border border-slate-200 group-hover:border-slate-300"
                      )}>
                        {isCompleted ? "✓" : index + 1}
                      </div>
                      <span className={cn(
                        "text-[9px] font-black uppercase tracking-tighter whitespace-nowrap",
                        isActive ? "text-primary" : "text-slate-400 group-hover:text-slate-600"
                      )}>
                        {step.title.split(' ')[0]}
                      </span>
                    </button>
                    {index < SIMULATION_STEPS.length - 1 && (
                      <div className={cn(
                        "flex-1 h-0.5 mx-2 min-w-[40px] transition-all",
                        index < currentSimStep ? "bg-emerald-500" : "bg-slate-100"
                      )} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* Stepper Simulator Controls */}
          <div className="flex flex-wrap items-center justify-between gap-6 glass-panel p-6 rounded-[32px] bg-slate-900 text-white shadow-xl">
            <div className="flex items-center gap-3">
              <span className="bg-primary/20 text-primary text-[10px] font-black px-4 py-1.5 rounded-full border border-primary/20 uppercase tracking-widest">
                Aşama {currentSimStep + 1} / 8
              </span>
              <h5 className="text-base font-black tracking-tight uppercase italic">{activeSimStep.title}</h5>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentSimStep(prev => (prev === 0 ? SIMULATION_STEPS.length - 1 : prev - 1))}
                className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Geri
              </button>
              <button
                onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                className={cn(
                  "px-8 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                  isAutoPlaying ? "bg-amber-500 text-slate-900" : "bg-primary text-white"
                )}
              >
                {isAutoPlaying ? <><Pause size={12} /> Duraklat</> : <><Play size={12} /> Otomatik Oynat</>}
              </button>
              <button
                onClick={() => setCurrentSimStep(prev => (prev === SIMULATION_STEPS.length - 1 ? 0 : prev + 1))}
                className="px-6 py-2.5 bg-white text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center gap-1"
              >
                İleri <ArrowRight size={12} />
              </button>
              <button
                onClick={() => {
                  setCurrentSimStep(0);
                  setIsAutoPlaying(false);
                }}
                className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
                title="Sıfırla"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {/* Interactive Flow Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Flow Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Active Step Details */}
              <div className="glass-panel p-8 rounded-[40px] bg-white border border-slate-100 shadow-sm space-y-6">
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-6">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest">{activeSimStep.unit}</span>
                    <h4 className="text-2xl font-black text-slate-900 tracking-tight">{activeSimStep.title}</h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Sorumlu Rol</span>
                    <span className="text-sm font-black text-slate-800">{activeSimStep.role} ({activeSimStep.assignee})</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aşama İşleyiş Açıklaması</h5>
                  <p className="text-slate-600 text-sm font-medium leading-relaxed">{activeSimStep.description}</p>
                </div>

                {/* Database Entity Created */}
                <div className="space-y-3 bg-slate-900 rounded-3xl p-6 relative overflow-hidden group">
                  <div className="flex items-center justify-between text-white/50 border-b border-white/5 pb-3">
                    <span className="text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 text-primary">
                      <Database size={12} /> Veritabanı Varlığı ({activeSimStep.entityCreated.model})
                    </span>
                    <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded uppercase font-black tracking-widest">
                      PRISMA MAPPED
                    </span>
                  </div>
                  <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto leading-relaxed custom-scrollbar max-h-48 pt-2">
                    {JSON.stringify(activeSimStep.entityCreated.data, null, 2)}
                  </pre>
                </div>

                {/* Workflow task created */}
                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl shrink-0">
                    <ListTodo size={18} />
                  </div>
                  <div>
                    <h6 className="text-xs font-black text-indigo-900 uppercase tracking-wide">Üretilen / Güncellenen İş Görevi</h6>
                    <p className="text-xs text-indigo-700 font-semibold mt-0.5">{activeSimStep.taskCreated}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Communications Panel */}
            <div className="space-y-6">
              {/* WhatsApp Ticker Mock */}
              <div className="glass-panel p-6 rounded-[32px] bg-[#E5DDD5] border-transparent shadow-sm relative overflow-hidden">
                <div className="bg-[#075E54] text-white p-4 -mx-6 -mt-6 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-black text-sm">
                    E
                  </div>
                  <div>
                    <h5 className="text-xs font-black leading-none">Enflow Bot</h5>
                    <span className="text-[9px] text-white/70 font-semibold">Meta Business Cloud API</span>
                  </div>
                </div>
                
                <div className="mt-6 space-y-4">
                  <div className="max-w-[85%] bg-white p-3 rounded-2xl rounded-tl-none shadow-sm text-xs font-medium text-slate-800 relative">
                    <div className="text-[10px] font-black text-[#128C7E] uppercase tracking-wider mb-1">
                      WHATSAPP ENTEGRASYONU
                    </div>
                    {activeSimStep.whatsapp}
                    <div className="text-[8px] text-slate-400 font-bold text-right mt-1">17:57 ✓✓</div>
                  </div>
                </div>
              </div>

              {/* MS Exchange Email Mock */}
              <div className="glass-panel p-6 rounded-[32px] bg-slate-50 border border-slate-200/60 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Mail size={14} className="text-blue-600" /> MS Exchange API
                  </h5>
                  <span className="text-[8px] bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded uppercase font-black tracking-widest">
                    GRAPH API
                  </span>
                </div>
                
                <div className="space-y-3">
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Kime:</span>
                    <p className="text-xs font-bold text-slate-700 bg-white border border-slate-100 rounded-lg px-3 py-1.5 truncate">{activeSimStep.email.to}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Konu:</span>
                    <p className="text-xs font-bold text-slate-800 bg-white border border-slate-100 rounded-lg px-3 py-1.5">{activeSimStep.email.subject}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">İçerik:</span>
                    <div className="text-xs font-medium text-slate-600 bg-white border border-slate-100 rounded-2xl p-4 min-h-[120px] whitespace-pre-line leading-relaxed">
                      {activeSimStep.email.body}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowBuilder;

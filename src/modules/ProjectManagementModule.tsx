import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileSearch, 
  FileText, 
  ShoppingCart, 
  Archive, 
  Settings,
  Bell,
  Search,
  Plus,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ChevronRight,
  Menu,
  X,
  LogOut,
  TrendingUp,
  DollarSign,
  Briefcase,
  Truck,
  Package,
  History,
  FileDown,
  Calendar,
  ShieldCheck,
  MapPin,
  UserCheck,
  ExternalLink,
  Download,
  Filter,
  MoreVertical,
  BarChart3,
  PieChart,
  ArrowDownRight,
  Target,
  Percent,
  FileSignature,
  Gavel,
  Kanban,
  Wand2,
  Puzzle,
  Cpu,
  Mail,
  MessageSquare,
  ListTodo,
  UserPlus,
  FileCheck2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import { 
  NAV_ITEMS, 
  MOCK_CUSTOMERS,
  MOCK_PROJECTS, 
  MOCK_DOCUMENTS, 
  MOCK_WORK_EXPERIENCE, 
  MOCK_CERTIFICATES,
  MOCK_UNITS,
  MOCK_PERMISSIONS,
  MOCK_SYSTEM_USERS,
  MOCK_BOM_ITEMS,
  MOCK_COST_REQUIREMENTS,
  MOCK_CONTRACTS,
  MOCK_CONTRACT_DOCS,
  MOCK_PROJECT_TASKS,
  MOCK_TODO_TASKS,
  MOCK_OPPORTUNITIES
} from '../constants';
import { 
  CorporateDocument, 
  Unit, 
  User, 
  Permission, 
  BoMItem, 
  CostRequirement,
  Contract,
  ContractDocumentRequirement,
  ProjectTask,
  TodoTask,
  Opportunity,
  Project,
  NextcloudConfig,
  ExchangeConfig,
  WhatsAppConfig
} from '../types';
import { nextcloudService } from '../services/nextcloudService';
import { exchangeService } from '../services/exchangeService';
import { whatsappService } from '../services/whatsappService';


import { TaskProgressTracker } from '../components/TaskProgressTracker';

const ProjectManagementModule = ({ projects, setProjects, tasks, setTasks, setActiveTab: setGlobalActiveTab }: { 
  projects: Project[], 
  setProjects?: React.Dispatch<React.SetStateAction<Project[]>>, 
  tasks?: TodoTask[], 
  setTasks?: React.Dispatch<React.SetStateAction<TodoTask[]>>,
  setActiveTab?: (tab: string) => void
}) => {
  // Assuming current user is cmp5lhehc000259w33zxhyy0p for demo purposes
  const currentUser = 'cmp5lhehc000259w33zxhyy0p';
  const myProjects = projects.filter(p => p.managerId === currentUser);
  const [selectedProjectId, setSelectedProjectId] = useState(myProjects[0]?.id || projects[0]?.id);
  const [activeTab, setActiveTab] = useState<'KANBAN' | 'PROCUREMENT' | 'REPORTING' | 'TASKS'>('KANBAN');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [newTask, setNewTask] = useState<Partial<ProjectTask>>({
    status: 'TODO'
  });
  const [showNewProcurementReqModal, setShowNewProcurementReqModal] = useState(false);
  const [newProcurementReq, setNewProcurementReq] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM'
  });
  const [showNewReportModal, setShowNewReportModal] = useState(false);
  const [newReport, setNewReport] = useState({
    notes: ''
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];
  const projectTasks = MOCK_PROJECT_TASKS.filter(t => t.projectId === selectedProject?.id);
  const relatedTasks = tasks?.filter(t => t.relatedModule === 'PROJECT' && t.relatedItemId === selectedProject?.id) || [];

  const handleAddTask = () => {
    console.log('Adding project task:', newTask);
    setShowNewTaskModal(false);
    setNewTask({ status: 'TODO' });
  };

  const handleCompleteProject = () => {
    if (!selectedProject || !setProjects) return;
    if (!window.confirm('Bu projenin saha kurulumlarını ve geçici kabulünü tamamlayıp kapatmak istediğinize emin misiniz?')) return;
    
    const updated = projects.map(p => {
      if (p.id === selectedProject.id) {
        return {
          ...p,
          progress: 100,
          status: 'COMPLETED' as const
        };
      }
      return p;
    });
    setProjects(updated);
    alert('Tebrikler! Proje başarıyla tamamlandı. Islak imzalı evrakları Fiziksel Arşiv modülünden arşive teslim edebilirsiniz.');
  };

  const handleCreateProcurementReq = () => {
    console.log('Creating procurement req:', newProcurementReq);
    setShowNewProcurementReqModal(false);
    setNewProcurementReq({ title: '', description: '', priority: 'MEDIUM' });
  };

  const handleSendReport = () => {
    console.log('Sending report:', newReport);
    setShowNewReportModal(false);
    setNewReport({ notes: '' });
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Proje Yönetimi</h3>
          <p className="text-slate-500">Operasyonel süreçler, saha kurulumları ve görev takibi.</p>
        </div>
        <div className="flex gap-3">
          <select 
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            <optgroup label="Bana Atanan Projeler">
              {myProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </optgroup>
            <optgroup label="Tüm Projeler">
              {projects.filter(p => p.managerId !== currentUser).map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </optgroup>
          </select>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('KANBAN')}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", activeTab === 'KANBAN' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              Görevler
            </button>
            <button 
              onClick={() => setActiveTab('PROCUREMENT')}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", activeTab === 'PROCUREMENT' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              Satın Alma
            </button>
            <button 
              onClick={() => setActiveTab('REPORTING')}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", activeTab === 'REPORTING' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              Raporlama
            </button>
            <button 
              onClick={() => setActiveTab('TASKS')}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", activeTab === 'TASKS' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              İş Emirleri & İlerlemeler
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'KANBAN' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {['TODO', 'IN_PROGRESS', 'DONE'].map((status) => (
                <div key={status} className="bg-slate-50 p-6 rounded-3xl border border-slate-200 min-h-[500px] flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="font-bold text-slate-900 flex items-center gap-2">
                      {status === 'TODO' && <Clock size={18} className="text-slate-400" />}
                      {status === 'IN_PROGRESS' && <TrendingUp size={18} className="text-blue-500" />}
                      {status === 'DONE' && <CheckCircle2 size={18} className="text-emerald-500" />}
                      {status === 'TODO' ? 'Yapılacaklar' : status === 'IN_PROGRESS' ? 'Devam Edenler' : 'Tamamlananlar'}
                    </h4>
                    <span className="bg-white px-2 py-0.5 rounded-lg text-[10px] font-bold text-slate-400 border border-slate-100">
                      {projectTasks.filter(t => t.status === status).length}
                    </span>
                  </div>
                  
                  <div className="space-y-4 flex-1">
                    {projectTasks.filter(t => t.status === status).map((task) => (
                      <motion.div 
                        key={task.id}
                        layoutId={task.id}
                        className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                      >
                        <h5 className="font-bold text-slate-900 text-sm mb-1 group-hover:text-indigo-600 transition-colors">{task.title}</h5>
                        <p className="text-xs text-slate-500 mb-4 line-clamp-2">{task.description}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex -space-x-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[8px] font-bold text-indigo-600">
                              {MOCK_SYSTEM_USERS.find(u => u.id === task.assignedTo)?.name.split(' ').map(n => n[0]).join('')}
                            </div>
                          </div>
                          {task.dueDate && (
                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                              <Calendar size={12} />
                              {task.dueDate}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    <button 
                      onClick={() => setShowNewTaskModal(true)}
                      className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-bold hover:border-indigo-300 hover:text-indigo-500 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus size={16} /> Görev Ekle
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'TASKS' && (
            <div className="glass-panel rounded-3xl p-8">
              <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Target size={20} className="text-indigo-600" />
                İş Emirleri ve İlerlemeler
              </h4>
              <div className="space-y-4">
                <TaskProgressTracker 
                  tasks={tasks || []} 
                  setTasks={setTasks!} 
                  relatedModule="PROJECT" 
                  relatedItemId={selectedProject?.id || ''} 
                />
              </div>
            </div>
          )}

          {activeTab === 'PROCUREMENT' && (
            <div className="glass-panel rounded-3xl p-8">
              <div className="flex items-center justify-between mb-8">
                <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingCart size={20} className="text-indigo-600" />
                  Satın Alma Koordinasyonu
                </h4>
                <button 
                  onClick={() => setShowNewProcurementReqModal(true)}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all"
                >
                  Yeni Talep Oluştur
                </button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h5 className="font-bold text-slate-900 mb-4">Sipariş Durumları</h5>
                  <div className="p-4 border border-slate-100 rounded-2xl flex items-center justify-between bg-slate-50">
                    <div>
                      <h5 className="font-bold text-slate-900">Sunucu Donanımları (BoM)</h5>
                      <p className="text-xs text-slate-500 mt-1">Tedarikçi: Arena Bilgisayar</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold text-amber-600 bg-amber-100 px-3 py-1 rounded-lg">Sipariş Bekleniyor</span>
                      <button className="text-indigo-600 text-sm font-bold hover:underline">Detay</button>
                    </div>
                  </div>
                  <div className="p-4 border border-slate-100 rounded-2xl flex items-center justify-between bg-slate-50">
                    <div>
                      <h5 className="font-bold text-slate-900">Ağ Cihazları (BoM)</h5>
                      <p className="text-xs text-slate-500 mt-1">Tedarikçi: Index Bilgisayar</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-lg">Teslim Edildi</span>
                      <button className="text-indigo-600 text-sm font-bold hover:underline">Detay</button>
                    </div>
                  </div>
                </div>

                <div>
                  <h5 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <MessageSquare size={18} className="text-indigo-600" />
                    Satın Alma Biriminden Notlar
                  </h5>
                  <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 min-h-[200px]">
                    {selectedProject?.procurementNotes && selectedProject.procurementNotes.length > 0 ? (
                      <div className="space-y-4">
                        {selectedProject.procurementNotes.map(note => (
                          <div key={note.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <p className="text-sm text-slate-700">{note.note}</p>
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-50">
                              <span className="text-[10px] font-bold text-slate-400">{note.author}</span>
                              <span className="text-[10px] font-bold text-slate-400">{note.date}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <MessageSquare size={32} className="mb-2 opacity-20" />
                        <p className="text-sm italic">Henüz bir bilgi notu bulunmuyor.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'REPORTING' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-3xl border border-slate-200 p-8 space-y-6">
                <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <PieChart size={20} className="text-indigo-600" />
                  Proje İlerleme Durumu
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-700">Genel İlerleme</span>
                    <span className="font-bold text-indigo-600">%{selectedProject?.progress || 0}</span>
                  </div>
                  <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${selectedProject?.progress || 0}%` }}
                      className="h-full bg-indigo-600 rounded-full"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Bitiş Tarihi</p>
                    <p className="text-sm font-bold text-slate-900">{selectedProject?.deadline}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Durum</p>
                    <p className="text-sm font-bold text-slate-900">{selectedProject?.status}</p>
                  </div>
                </div>

                {selectedProject && selectedProject.progress < 100 && (
                  <button 
                    onClick={handleCompleteProject}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 mt-4"
                  >
                    <CheckCircle2 size={16} />
                    Geçici Kabulü Onayla & Tamamla (%100)
                  </button>
                )}

                {selectedProject && selectedProject.progress === 100 && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col gap-3 mt-4">
                    <p className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                      Proje Kurulumu ve Geçici Kabul Tamamlandı!
                    </p>
                    <p className="text-[10px] text-emerald-600 font-medium leading-relaxed">
                      Sözleşme ve kabul evraklarını klasörleyip fiziksel arşive teslim edebilirsiniz.
                    </p>
                    {setGlobalActiveTab && (
                      <button 
                        onClick={() => setGlobalActiveTab('archive')}
                        className="py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-2 uppercase tracking-wider"
                      >
                        <Archive size={14} />
                        Evrakları Fiziksel Arşive Teslim Et
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-8">
                <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <FileText size={20} className="text-amber-600" />
                  Yönetim Raporu Oluştur
                </h4>
                <div className="space-y-4">
                  <textarea 
                    rows={4}
                    placeholder="Üst yönetime sunulacak haftalık ilerleme notlarını buraya girin..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500 resize-none"
                    value={newReport.notes}
                    onChange={(e) => setNewReport({...newReport, notes: e.target.value})}
                  />
                  <button 
                    onClick={() => setShowNewReportModal(true)}
                    className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                  >
                    <ArrowUpRight size={18} /> Raporu Gönder
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* New Project Task Modal */}
      <AnimatePresence>
        {showNewTaskModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-xl font-bold text-slate-900">Yeni Proje Görevi</h4>
                <button onClick={() => setShowNewTaskModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Görev Başlığı</label>
                  <input 
                    type="text" 
                    placeholder="Örn: Saha Keşfi"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                    onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Atanan Kişi</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                      onChange={(e) => setNewTask({...newTask, assignedTo: e.target.value})}
                    >
                      <option value="">Seçiniz</option>
                      {MOCK_SYSTEM_USERS.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Termin Tarihi</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                      onChange={(e) => setNewTask({...newTask, dueDate: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Görev Detayı</label>
                  <textarea 
                    rows={3}
                    placeholder="Görev açıklaması..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500 resize-none"
                    onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                  />
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => setShowNewTaskModal(false)}
                  className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                >
                  İptal
                </button>
                <button 
                  onClick={handleAddTask}
                  className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Görevi Kaydet
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Procurement Request Modal */}
      <AnimatePresence>
        {showNewProcurementReqModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-xl font-bold text-slate-900">Yeni Satın Alma Talebi</h4>
                <button onClick={() => setShowNewProcurementReqModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Talep Başlığı</label>
                  <input 
                    type="text" 
                    placeholder="Örn: Ek Sunucu İhtiyacı"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                    onChange={(e) => setNewProcurementReq({...newProcurementReq, title: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Öncelik</label>
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                    onChange={(e) => setNewProcurementReq({...newProcurementReq, priority: e.target.value})}
                    value={newProcurementReq.priority}
                  >
                    <option value="LOW">Düşük</option>
                    <option value="MEDIUM">Orta</option>
                    <option value="HIGH">Yüksek</option>
                    <option value="URGENT">Acil</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Talep Detayı</label>
                  <textarea 
                    rows={4}
                    placeholder="Talebin detayları, teknik özellikler vb..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500 resize-none"
                    onChange={(e) => setNewProcurementReq({...newProcurementReq, description: e.target.value})}
                  />
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => setShowNewProcurementReqModal(false)}
                  className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                >
                  İptal
                </button>
                <button 
                  onClick={handleCreateProcurementReq}
                  className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Talebi Gönder
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Send Report Confirmation Modal */}
      <AnimatePresence>
        {showNewReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-xl font-bold text-slate-900">Raporu Gönder</h4>
                <button onClick={() => setShowNewReportModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <p className="text-sm text-slate-600">
                  Bu rapor üst yönetime iletilecektir. Onaylıyor musunuz?
                </p>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => setShowNewReportModal(false)}
                  className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                >
                  İptal
                </button>
                <button 
                  onClick={handleSendReport}
                  className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Evet, Gönder
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProjectManagementModule;

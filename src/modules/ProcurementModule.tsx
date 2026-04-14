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

const ProcurementModule = ({ projects, setProjects, tasks, setTasks }: { projects: Project[], setProjects: React.Dispatch<React.SetStateAction<Project[]>>, tasks?: TodoTask[], setTasks?: React.Dispatch<React.SetStateAction<TodoTask[]>> }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [newNote, setNewNote] = useState('');
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [newOrder, setNewOrder] = useState({
    vendor: '',
    expectedDate: '',
    notes: ''
  });

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const projectBomItems = MOCK_BOM_ITEMS.filter(item => item.opportunityId === selectedProject?.opportunityId);

  const handleAddNote = () => {
    if (!selectedProject || !newNote.trim()) return;

    const note = {
      id: `note-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      note: newNote,
      author: 'Satın Alma Uzmanı'
    };

    const updatedProjects = projects.map(p => {
      if (p.id === selectedProject.id) {
        return {
          ...p,
          procurementNotes: [...(p.procurementNotes || []), note]
        };
      }
      return p;
    });

    setProjects(updatedProjects);
    setNewNote('');
  };

  const handleCreateOrder = () => {
    console.log('Creating order:', newOrder);
    setShowNewOrderModal(false);
    setNewOrder({ vendor: '', expectedDate: '', notes: '' });
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Satın Alma & Tedarik Zinciri</h3>
          <p className="text-slate-500">Sipariş takibi, ETA yönetimi ve depo girişleri.</p>
        </div>
        <div className="flex gap-3">
          <select 
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            <option value="">Proje Seçiniz</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button 
            onClick={() => setShowNewOrderModal(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
          >
            <ShoppingCart size={18} />
            Yeni Sipariş
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-bold text-slate-900">Proje İhtiyaçları (BoM)</h4>
              <span className="text-xs font-bold text-slate-500">{projectBomItems.length} Kalem</span>
            </div>
            <div className="divide-y divide-slate-100">
              {projectBomItems.length > 0 ? projectBomItems.map((item) => (
                <div key={item.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h5 className="font-bold text-slate-900">{item.partNumber}</h5>
                      <p className="text-xs text-slate-500">{item.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">{item.quantity} Adet</p>
                      <p className="text-xs text-slate-400">Tedarikçi: {item.vendor || 'Belirtilmedi'}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase bg-amber-100 text-amber-700">
                      Sipariş Bekleniyor
                    </span>
                    <button className="text-xs font-bold text-indigo-600 hover:underline">Sipariş Oluştur</button>
                  </div>
                </div>
              )) : (
                <div className="p-8 text-center text-slate-400 italic">
                  Bu proje için onaylı BoM listesi bulunamadı.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6">
            <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <MessageSquare size={20} className="text-indigo-600" />
              Proje Yöneticisine Bilgi Notu
            </h4>
            <div className="space-y-4">
              <textarea 
                rows={3}
                placeholder="Tedarik durumu, gecikmeler veya ETA hakkında bilgi notu girin..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500 resize-none"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
              <button 
                onClick={handleAddNote}
                disabled={!newNote.trim() || !selectedProject}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ArrowUpRight size={18} /> Notu İlet
              </button>
            </div>
            
            {selectedProject?.procurementNotes && selectedProject.procurementNotes.length > 0 && (
              <div className="mt-6 space-y-3">
                <h5 className="text-xs font-bold text-slate-400 uppercase">Geçmiş Notlar</h5>
                {selectedProject.procurementNotes.map(note => (
                  <div key={note.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-700">{note.note}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[10px] text-slate-400">{note.author}</span>
                      <span className="text-[10px] text-slate-400">{note.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-900 rounded-3xl p-6 text-white">
            <h4 className="font-bold mb-4 flex items-center gap-2">
              <History size={20} className="text-indigo-400" />
              Son Hareketler
            </h4>
            <div className="space-y-4">
              {[
                { text: 'Dell R750 (SN: 12345) depoya girdi.', time: '2 saat önce' },
                { text: 'Arena Bilgisayar siparişi yola çıktı.', time: '5 saat önce' },
                { text: 'Cisco Switch (SN: 98765) sahaya sevk edildi.', time: 'Dün' },
              ].map((log, i) => (
                <div key={i} className="border-l-2 border-indigo-500/30 pl-4 py-1">
                  <p className="text-xs text-slate-300 leading-tight">{log.text}</p>
                  <p className="text-[10px] text-slate-500 mt-1">{log.time}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-6">
            <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Target size={20} className="text-indigo-600" />
              İş Emirleri ve İlerlemeler
            </h4>
            <div className="space-y-3">
              <TaskProgressTracker 
                tasks={tasks || []} 
                setTasks={setTasks!} 
                relatedModule="PROCUREMENT" 
                relatedItemId={selectedProject?.id || ''} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* New Order Modal */}
      <AnimatePresence>
        {showNewOrderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-xl font-bold text-slate-900">Yeni Sipariş Oluştur</h4>
                <button onClick={() => setShowNewOrderModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Tedarikçi Firma</label>
                  <input 
                    type="text" 
                    placeholder="Örn: Arena Bilgisayar"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                    onChange={(e) => setNewOrder({...newOrder, vendor: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Beklenen Teslim Tarihi (ETA)</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                    onChange={(e) => setNewOrder({...newOrder, expectedDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Sipariş Notları</label>
                  <textarea 
                    rows={3}
                    placeholder="Siparişe özel notlar..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500 resize-none"
                    onChange={(e) => setNewOrder({...newOrder, notes: e.target.value})}
                  />
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => setShowNewOrderModal(false)}
                  className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                >
                  İptal
                </button>
                <button 
                  onClick={handleCreateOrder}
                  className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Siparişi Kaydet
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProcurementModule;

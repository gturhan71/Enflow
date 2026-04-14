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

const ContractModule = ({ opportunities, contracts, setContracts, projects, setProjects, tasks, setTasks }: { 
  opportunities: Opportunity[], 
  contracts: Contract[], 
  setContracts: React.Dispatch<React.SetStateAction<Contract[]>>,
  projects: Project[],
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>,
  tasks?: TodoTask[],
  setTasks?: React.Dispatch<React.SetStateAction<TodoTask[]>>
}) => {
  const generatedContracts = opportunities.filter(o => o.status === 'WON' && !contracts.some(c => c.opportunityId === o.id)).map(o => ({
    id: `contract-${o.id}`,
    opportunityId: o.id,
    projectId: undefined,
    status: 'DRAFT' as const,
    signedDate: undefined,
    guaranteeAmount: o.value * 0.1, // Example 10% guarantee
    guaranteeExpiry: '2026-12-31',
    endDate: '2027-12-31'
  }));

  const allContracts = [...contracts, ...generatedContracts];
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [showArchiveAccess, setShowArchiveAccess] = useState(false);
  const [pmToAssign, setPmToAssign] = useState('');
  const [showNewDocReqModal, setShowNewDocReqModal] = useState(false);
  const [newDocReq, setNewDocReq] = useState({
    name: '',
    description: '',
    dueDate: ''
  });
  
  const selectedContract = allContracts.find(c => c.id === selectedContractId);
  const project = MOCK_PROJECTS.find(p => p.id === selectedContract?.projectId);
  const opportunity = opportunities.find(o => o.id === selectedContract?.opportunityId);
  
  const contractDocs = selectedContract?.opportunityId ? [
    { id: `doc-1-${selectedContract.id}`, contractId: selectedContract.id, name: 'Sözleşme Taslağı', status: 'PENDING' as const },
    { id: `doc-2-${selectedContract.id}`, contractId: selectedContract.id, name: 'Maliyet Analizi (Onaylı)', status: 'APPROVED' as const, description: 'Sistemden otomatik aktarıldı.' }
  ] : MOCK_CONTRACT_DOCS.filter(doc => doc.contractId === selectedContract?.id);

  const targetName = project?.name || opportunity?.title || 'Bilinmeyen';

  const handleSignAndTransfer = () => {
    if (!selectedContract || !pmToAssign) return;
    
    // Update contract status
    const updatedContract = { ...selectedContract, status: 'SIGNED' as const, signedDate: new Date().toISOString().split('T')[0] };
    
    if (selectedContract.opportunityId && !contracts.find(c => c.id === selectedContract.id)) {
      setContracts([...contracts, updatedContract]);
    } else {
      setContracts(contracts.map(c => c.id === selectedContract.id ? updatedContract : c));
    }

    // Create a new project
    const newProject: Project = {
      id: `proj-${Date.now()}`,
      name: targetName,
      customerId: opportunity?.customerId || project?.customerId || 'c1',
      status: 'NOT_STARTED',
      totalValue: opportunity?.value || 0,
      avgMargin: 15,
      deadline: updatedContract.endDate || '2027-12-31',
      ownerId: 'user1',
      managerId: pmToAssign,
      progress: 0,
      opportunityId: opportunity?.id
    };
    setProjects([...projects, newProject]);
    setSelectedContractId(null); // Go back to list
  };

  const handleCreateDocReq = () => {
    console.log('Creating doc req:', newDocReq);
    setShowNewDocReqModal(false);
    setNewDocReq({ name: '', description: '', dueDate: '' });
  };

  if (!selectedContractId) {
    return (
      <div className="p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-slate-900">Sözleşmelerim</h3>
            <p className="text-slate-500">Aktif sözleşmeler ve geçerlilik süreleri.</p>
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">Sözleşme / Proje Adı</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">Durum</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">İmza Tarihi</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px]">Geçerlilik Süresi (Bitiş)</th>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase text-[10px] text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allContracts.map(c => {
                const p = MOCK_PROJECTS.find(proj => proj.id === c.projectId);
                const o = opportunities.find(opp => opp.id === c.opportunityId);
                const name = p?.name || o?.title || c.id;
                return (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{name}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider",
                        c.status === 'SIGNED' ? "bg-emerald-100 text-emerald-700" : 
                        c.status === 'DRAFT' ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700"
                      )}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{c.signedDate || '-'}</td>
                    <td className="px-6 py-4 font-bold text-slate-700">{c.endDate || c.guaranteeExpiry || 'Belirtilmedi'}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedContractId(c.id)}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-bold"
                      >
                        Detay & İşlem
                      </button>
                    </td>
                  </tr>
                );
              })}
              {allContracts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400 italic">
                    Henüz aktif bir sözleşme bulunmuyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Sözleşme Detayı</h3>
          <p className="text-slate-500">Kazanılan projelerin sözleşme süreçleri, teminat takibi ve evrak yönetimi.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setSelectedContractId(null)}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-all"
          >
            Listeye Dön
          </button>
          <button 
            onClick={() => setShowArchiveAccess(!showArchiveAccess)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border",
              showArchiveAccess ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            )}
          >
            <Archive size={18} />
            {showArchiveAccess ? 'Sözleşme Detayına Dön' : 'Evrak Havuzu & Arşiv'}
          </button>
          <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border border-emerald-100">
            <CheckCircle2 size={18} />
            Kazanıldı: {targetName}
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {showArchiveAccess ? (
          <motion.div
            key="archive-access"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-3xl border border-slate-200 p-8">
                <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <FileText size={20} className="text-indigo-600" />
                  Şirket Evrak Havuzu
                </h4>
                <div className="space-y-4">
                  {MOCK_DOCUMENTS.map((doc) => (
                    <div key={doc.id} className="p-4 border border-slate-100 rounded-2xl flex items-center justify-between hover:bg-slate-50 transition-colors group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">
                          <FileText size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{doc.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{doc.category}</p>
                        </div>
                      </div>
                      <button className="text-xs font-bold text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        Sözleşmeye Ekle
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-200 p-8">
                <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <Archive size={20} className="text-amber-600" />
                  Fiziksel Arşiv Durumu
                </h4>
                <div className="space-y-4">
                  {[
                    { name: 'İmza Sirküleri (Asıl)', location: 'Dolap A / Klasör 1', status: 'ARCHIVED' },
                    { name: 'Ticaret Sicil Gazetesi', location: 'Dolap A / Klasör 2', status: 'ARCHIVED' },
                    { name: 'Vergi Levhası (Orijinal)', location: 'Dolap C / Klasör 1', status: 'OUT' },
                  ].map((item, i) => (
                    <div key={i} className="p-4 border border-slate-100 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                          <MapPin size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{item.location}</p>
                        </div>
                      </div>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-md",
                        item.status === 'ARCHIVED' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {item.status === 'ARCHIVED' ? 'Arşivde' : 'Dışarıda'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="contract-detail"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <FileSignature size={20} className="text-indigo-600" />
                    Sözleşme Evrakları Listesi
                  </h4>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400">Satış Destek Takibi</span>
                    <button 
                      onClick={() => setShowNewDocReqModal(true)}
                      className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all flex items-center gap-1"
                    >
                      <Plus size={14} /> Yeni Talep
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-slate-100">
                  {contractDocs.map((doc) => (
                    <div key={doc.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          doc.status === 'APPROVED' ? "bg-emerald-50 text-emerald-600" : 
                          doc.status === 'UPLOADED' ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400"
                        )}>
                          <FileText size={20} />
                        </div>
                        <div>
                          <h5 className="font-bold text-slate-900 text-sm">{doc.name}</h5>
                          <p className="text-xs text-slate-500">{doc.description || 'Gerekli evrak havuzundan çekilecek.'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {doc.status === 'PENDING' && (
                          <button 
                            onClick={() => setShowArchiveAccess(true)}
                            className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1 mr-4"
                          >
                            <Search size={12} /> Arşivden Bul
                          </button>
                        )}
                        {doc.dueDate && (
                          <div className="text-right mr-4">
                            <p className="text-[10px] text-slate-400 font-bold uppercase">Son Tarih</p>
                            <p className="text-xs font-bold text-slate-700">{doc.dueDate}</p>
                          </div>
                        )}
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider",
                          doc.status === 'APPROVED' ? "bg-emerald-100 text-emerald-700" : 
                          doc.status === 'UPLOADED' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {doc.status === 'APPROVED' ? 'Onaylandı' : doc.status === 'UPLOADED' ? 'Yüklendi' : 'Bekliyor'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Gavel size={20} className="text-amber-600" />
                  Teminat Bilgileri
                </h4>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Teminat Tutarı</p>
                    <p className="text-xl font-bold text-slate-900">${selectedContract?.guaranteeAmount?.toLocaleString() || 0}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Geçerlilik Tarihi</p>
                    <p className="text-sm font-bold text-slate-700">{selectedContract?.guaranteeExpiry || 'Belirtilmedi'}</p>
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-400 uppercase mb-2">Proje Yöneticisi Ata</p>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 mb-4"
                      value={pmToAssign}
                      onChange={(e) => setPmToAssign(e.target.value)}
                    >
                      <option value="">Seçiniz</option>
                      {MOCK_SYSTEM_USERS.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                      ))}
                    </select>
                    <button 
                      onClick={handleSignAndTransfer}
                      disabled={!pmToAssign || selectedContract?.status === 'SIGNED'}
                      className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {selectedContract?.status === 'SIGNED' ? 'Sözleşme İmzalandı' : 'Sözleşmeyi İmzala & Devret'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-lg shadow-indigo-200">
                <h4 className="font-bold mb-2">Süreç Notu</h4>
                <p className="text-xs text-indigo-100 leading-relaxed">
                  Tüm evraklar onaylandığında ve sözleşme imzalandığında proje otomatik olarak "Proje Yönetimi" modülüne aktarılacaktır.
                </p>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Target size={20} className="text-indigo-600" />
                  İş Emirleri ve İlerlemeler
                </h4>
                <div className="space-y-3">
                  <TaskProgressTracker 
                    tasks={tasks || []} 
                    setTasks={setTasks!} 
                    relatedModule="CONTRACT" 
                    relatedItemId={selectedContract?.id || ''} 
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Document Request Modal */}
      <AnimatePresence>
        {showNewDocReqModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-xl font-bold text-slate-900">Yeni Belge Talebi</h4>
                <button onClick={() => setShowNewDocReqModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Belge Adı</label>
                  <input 
                    type="text" 
                    placeholder="Örn: SGK Borcu Yoktur Yazısı"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                    onChange={(e) => setNewDocReq({...newDocReq, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Son Teslim Tarihi</label>
                  <input 
                    type="date" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                    onChange={(e) => setNewDocReq({...newDocReq, dueDate: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Açıklama / Not</label>
                  <textarea 
                    rows={3}
                    placeholder="Belge ile ilgili detaylar..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500 resize-none"
                    onChange={(e) => setNewDocReq({...newDocReq, description: e.target.value})}
                  />
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => setShowNewDocReqModal(false)}
                  className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                >
                  İptal
                </button>
                <button 
                  onClick={handleCreateDocReq}
                  className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Talebi Oluştur
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ContractModule;

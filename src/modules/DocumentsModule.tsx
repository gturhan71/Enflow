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


const DocumentsModule = () => {
  const [filter, setFilter] = useState('ALL');
  const [showNewDocModal, setShowNewDocModal] = useState(false);
  const [newDoc, setNewDoc] = useState<Partial<CorporateDocument>>({
    category: 'LEGAL',
    tags: []
  });

  const handleAddDoc = () => {
    // Mock save
    console.log('Saving new doc:', newDoc);
    setShowNewDocModal(false);
    setNewDoc({ category: 'LEGAL', tags: [] });
  };

  const filteredDocs = filter === 'ALL' 
    ? MOCK_DOCUMENTS 
    : MOCK_DOCUMENTS.filter(d => d.category === filter);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Şirket Evrakları & Arşiv</h3>
          <p className="text-slate-500">Yasal belgeler, ISO sertifikaları ve fiziksel arşiv takibi.</p>
        </div>
        <button 
          onClick={() => setShowNewDocModal(true)}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2"
        >
          <Plus size={20} />
          Yeni Belge Yükle
        </button>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {['ALL', 'LEGAL', 'ISO', 'CERTIFICATE', 'WORK_EXPERIENCE'].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap",
              filter === cat 
                ? "bg-indigo-600 text-white shadow-md" 
                : "bg-white text-slate-500 border border-slate-200 hover:border-indigo-300"
            )}
          >
            {cat === 'ALL' ? 'Tüm Belgeler' : 
             cat === 'LEGAL' ? 'Yasal' : 
             cat === 'ISO' ? 'ISO' : 
             cat === 'CERTIFICATE' ? 'Sertifika' : 'İş Bitirme'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredDocs.map((doc) => (
          <motion.div 
            layout
            key={doc.id} 
            className="glass-card p-6 rounded-3xl"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn(
                "p-3 rounded-2xl",
                doc.category === 'LEGAL' ? "bg-blue-50 text-blue-600" :
                doc.category === 'ISO' ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
              )}>
                <FileText size={24} />
              </div>
              <button className="text-slate-400 hover:text-slate-600">
                <MoreVertical size={20} />
              </button>
            </div>
            <h4 className="font-bold text-slate-900 mb-1 group-hover:text-indigo-600 transition-colors">{doc.name}</h4>
            <p className="text-xs text-slate-500 mb-4 flex items-center gap-1">
              <Clock size={12} /> Son Geçerlilik: {doc.expiryDate}
            </p>
            <div className="flex flex-wrap gap-1 mb-6">
              {doc.tags.map(tag => (
                <span key={tag} className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                  {tag}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button className="flex-1 bg-slate-50 text-slate-600 py-2 rounded-xl text-xs font-bold hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center gap-1">
                <Download size={14} /> İndir
              </button>
              <button className="p-2 bg-slate-50 text-slate-600 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                <ExternalLink size={16} />
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="glass-panel rounded-3xl p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h4 className="text-xl font-bold text-slate-900">Fiziksel Arşiv Takibi</h4>
            <p className="text-slate-500 text-sm">Belgelerin fiziksel konumları ve zimmet durumu.</p>
          </div>
          <button className="text-indigo-600 font-bold text-sm flex items-center gap-1 hover:underline">
            Tüm Arşivi Gör <ChevronRight size={16} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                <th className="pb-4 px-4">Belge Adı</th>
                <th className="pb-4 px-4">Konum</th>
                <th className="pb-4 px-4">Noter Onayı</th>
                <th className="pb-4 px-4">Durum</th>
                <th className="pb-4 px-4">Zimmet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[
                { name: 'İmza Sirküleri (Asıl)', location: 'Dolap A / Klasör 1', notary: 'Beşiktaş 4. Noter', status: 'ARCHIVED', holder: '-' },
                { name: 'ISO 27001 (Orijinal)', location: 'Dolap B / Klasör 3', notary: '-', status: 'OUT', holder: 'Gökhan T.' },
                { name: 'Referans Mektubu #12', location: 'Dolap A / Klasör 5', notary: '-', status: 'ARCHIVED', holder: '-' },
              ].map((item, i) => (
                <tr key={i} className="text-sm hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-4 font-bold text-slate-900">{item.name}</td>
                  <td className="py-4 px-4 text-slate-600 flex items-center gap-2">
                    <MapPin size={14} className="text-slate-400" /> {item.location}
                  </td>
                  <td className="py-4 px-4 text-slate-500">{item.notary}</td>
                  <td className="py-4 px-4">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-md",
                      item.status === 'ARCHIVED' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {item.status === 'ARCHIVED' ? 'Arşivde' : 'Dışarıda'}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-slate-600 font-medium">{item.holder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Document Modal */}
      <AnimatePresence>
        {showNewDocModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-xl font-bold text-slate-900">Yeni Belge Yükle</h4>
                <button onClick={() => setShowNewDocModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Belge Adı</label>
                  <input 
                    type="text" 
                    placeholder="Örn: İmza Sirküleri 2026"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                    onChange={(e) => setNewDoc({...newDoc, name: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Kategori</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                      onChange={(e) => setNewDoc({...newDoc, category: e.target.value as any})}
                    >
                      <option value="LEGAL">Yasal</option>
                      <option value="ISO">ISO</option>
                      <option value="CERTIFICATE">Sertifika</option>
                      <option value="WORK_EXPERIENCE">İş Bitirme</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Geçerlilik Tarihi</label>
                    <input 
                      type="date" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                      onChange={(e) => setNewDoc({...newDoc, expiryDate: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Dosya Seç</label>
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors cursor-pointer bg-slate-50">
                    <FileDown size={32} className="mb-2" />
                    <p className="text-sm font-bold">PDF, DOCX veya JPG yükleyin</p>
                    <p className="text-xs mt-1">Sürükleyip bırakın veya tıklayın</p>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => setShowNewDocModal(false)}
                  className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                >
                  İptal
                </button>
                <button 
                  onClick={handleAddDoc}
                  className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Yükle ve Kaydet
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DocumentsModule;

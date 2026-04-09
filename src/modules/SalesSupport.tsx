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


const SalesSupport = () => {
  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Satış Destek & İhale Yönetimi</h3>
          <p className="text-slate-500">İhale dosyaları, deadline takibi ve idari uygunluk denetimi.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2">
            <Calendar size={18} />
            Takvim
          </button>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2">
            <Plus size={18} />
            Yeni İhale Dosyası
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Active Bids */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h4 className="font-bold text-slate-900">Aktif İhaleler & Teklifler</h4>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400">Sırala:</span>
                <select className="text-xs font-bold text-slate-600 bg-slate-50 border-none rounded-lg focus:ring-0">
                  <option>Deadline (En Yakın)</option>
                  <option>Bütçe (En Yüksek)</option>
                </select>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {[
                { id: 'b1', name: 'E-Devlet Altyapı Genişletme', deadline: '2026-04-12 14:00', status: 'URGENT', progress: 85, value: 12500000 },
                { id: 'b2', name: 'Üniversite Kampüs Network', deadline: '2026-04-25 10:30', status: 'ON_TRACK', progress: 40, value: 4200000 },
                { id: 'b3', name: 'Banka Güvenlik Duvarı Güncelleme', deadline: '2026-05-05 16:00', status: 'ON_TRACK', progress: 10, value: 850000 },
              ].map((bid) => (
                <div key={bid.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        bid.status === 'URGENT' ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                      )}>
                        <Clock size={20} />
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900">{bid.name}</h5>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <Calendar size={12} /> Deadline: {bid.deadline}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-slate-900">${bid.value.toLocaleString()}</p>
                      <span className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-md uppercase",
                        bid.status === 'URGENT' ? "bg-red-100 text-red-700 animate-pulse" : "bg-blue-100 text-blue-700"
                      )}>
                        {bid.status === 'URGENT' ? 'Kritik Süre' : 'Normal'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-500">Dosya Hazırlık İlerlemesi</span>
                      <span className="text-indigo-600">{bid.progress}%</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${bid.progress}%` }}
                        className={cn(
                          "h-full rounded-full",
                          bid.status === 'URGENT' ? "bg-red-500" : "bg-indigo-600"
                        )}
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <button className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-600 hover:text-white transition-all">
                      Dosyayı İncele
                    </button>
                    <button className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-all">
                      Evrak Listesi
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Compliance & Certs */}
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6">
            <h4 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <ShieldCheck size={20} className="text-emerald-600" />
              Sertifika & Yetkinlik
            </h4>
            <div className="space-y-4">
              {MOCK_CERTIFICATES.map((cert) => (
                <div key={cert.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{cert.person}</span>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-md",
                      cert.status === 'VALID' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    )}>
                      {cert.status === 'VALID' ? 'Geçerli' : 'Yenileme Gerek'}
                    </span>
                  </div>
                  <h5 className="text-sm font-bold text-slate-900">{cert.name}</h5>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                    <Clock size={12} /> {cert.expiryDate}
                  </p>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-3 border-2 border-dashed border-slate-200 rounded-2xl text-sm font-bold text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-all">
              Tüm Sertifikaları Yönet
            </button>
          </div>

          <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200">
            <h4 className="font-bold mb-2 flex items-center gap-2">
              <FileCheck size={20} />
              İş Bitirme Talebi
            </h4>
            <p className="text-indigo-100 text-xs mb-6 leading-relaxed">
              Tamamlanan projeler için otomatik iş bitirme dilekçesi oluşturun ve takibini yapın.
            </p>
            <button className="w-full py-3 bg-white text-indigo-600 rounded-2xl text-sm font-bold hover:bg-indigo-50 transition-all">
              Dilekçe Oluştur
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesSupport;

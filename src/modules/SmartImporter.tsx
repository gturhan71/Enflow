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


const SmartImporter = () => {
  const [step, setStep] = useState(1);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="p-8 h-[calc(100vh-80px)] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Smart Importer</h3>
          <p className="text-slate-500">Excel listelerini şartname maddeleriyle eşleştirin.</p>
        </div>
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div 
              key={s} 
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                step === s ? "bg-indigo-600 text-white" : step > s ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"
              )}
            >
              {step > s ? <CheckCircle2 size={16} /> : s}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-hidden">
        {/* Left: Requirements */}
        <div className="bg-white rounded-3xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <FileSearch size={20} className="text-indigo-600" />
              Şartname Maddeleri
            </h4>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {[
              { id: 'r1', no: '4.2.1', text: 'En az 128 GB RAM ve 2x Gold CPU Sunucu', status: 'pending' },
              { id: 'r2', no: '4.2.2', text: 'Yedekli Güç Kaynağı (800W+)', status: 'matched' },
              { id: 'r3', no: '4.3.1', text: '10Gbps SFP+ Network Modülü', status: 'pending' },
              { id: 'r4', no: '4.3.2', text: '24 Port Yönetilebilir Switch', status: 'pending' },
            ].map((req) => (
              <div 
                key={req.id}
                className={cn(
                  "p-4 rounded-2xl border transition-all cursor-move group",
                  req.status === 'matched' 
                    ? "bg-emerald-50 border-emerald-100" 
                    : "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-md uppercase",
                    req.status === 'matched' ? "bg-emerald-200 text-emerald-700" : "bg-slate-100 text-slate-500"
                  )}>
                    Madde {req.no}
                  </span>
                  {req.status === 'matched' && <CheckCircle2 size={16} className="text-emerald-500" />}
                </div>
                <p className="text-sm font-medium text-slate-700 leading-relaxed">{req.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Excel Import / BoM */}
        <div className={cn(
          "bg-white rounded-3xl border-2 border-dashed flex flex-col overflow-hidden transition-all",
          isDragging ? "border-indigo-500 bg-indigo-50/30" : "border-slate-200"
        )}>
          {step === 1 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex items-center gap-3 mb-8">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <History size={20} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-indigo-900">Nextcloud DMS Aktif</p>
                  <p className="text-[10px] text-indigo-700">Dosyalar otomatik olarak tarih tabanlı klasör yapısına taşınacaktır.</p>
                </div>
              </div>
              <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center text-indigo-600 mb-6">
                <FileText size={40} />
              </div>
              <h4 className="text-xl font-bold text-slate-900 mb-2">Excel Dosyasını Yükleyin</h4>
              <p className="text-slate-500 mb-8 max-w-xs">Distribütörden gelen BoM listesini buraya sürükleyin veya seçin.</p>
              <button 
                onClick={() => setStep(2)}
                className="bg-indigo-600 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all"
              >
                Dosya Seç
              </button>
            </div>
          ) : (
            <>
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h4 className="font-bold text-slate-900">İçeri Aktarılan Ürünler</h4>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Toplam Maliyet</p>
                    <p className="text-sm font-mono font-bold text-slate-900">$12,450.00</p>
                  </div>
                  <button className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-emerald-100">
                    Kaydet
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {[
                  { pn: 'DELL-R750-01', desc: 'PowerEdge R750 Server 2x Gold 6330', qty: 2, cost: 4500, margin: 15 },
                  { pn: 'CISCO-C9200L-24T', desc: 'Catalyst 9200L 24-port Data Only', qty: 1, cost: 2800, margin: 12 },
                  { pn: 'APC-SRT3000XLI', desc: 'APC Smart-UPS SRT 3000VA', qty: 1, cost: 1200, margin: 18 },
                ].map((item, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">{item.pn}</span>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-bold">MARJ</p>
                          <input 
                            type="number" 
                            defaultValue={item.margin} 
                            className="w-12 bg-transparent text-right font-bold text-slate-900 outline-none focus:text-indigo-600"
                          />
                          <span className="text-xs font-bold text-slate-400">%</span>
                        </div>
                        <div className="h-8 w-px bg-slate-200" />
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-bold">SATIŞ</p>
                          <p className="text-sm font-mono font-bold text-slate-900">
                            ${(item.cost / (1 - (item.margin / 100))).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">{item.desc}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Adet:</span>
                        <span className="text-sm font-bold text-slate-900">{item.qty}</span>
                      </div>
                      <button className="text-xs font-bold text-indigo-600 bg-white border border-indigo-100 px-3 py-1.5 rounded-lg hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-1">
                        <Plus size={12} /> Madde Eşleştir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SmartImporter;

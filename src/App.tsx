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
  ListTodo
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
  MOCK_TODO_TASKS
} from './constants';
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
  NextcloudConfig,
  ExchangeConfig,
  WhatsAppConfig
} from './types';
import { nextcloudService } from './services/nextcloudService';
import { exchangeService } from './services/exchangeService';
import { whatsappService } from './services/whatsappService';

// --- Components ---

const Sidebar = ({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (id: string) => void }) => {
  return (
    <div className="w-64 bg-white border-r border-slate-200 h-screen flex flex-col sticky top-0">
      <div className="p-6 flex items-center gap-3 border-bottom border-slate-100">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
          <Briefcase size={24} />
        </div>
        <div>
          <h1 className="font-bold text-slate-900 leading-tight uppercase tracking-tighter text-xl">ENFLOW</h1>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Sistem Entegratörü</p>
        </div>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group",
              activeTab === item.id 
                ? "bg-indigo-50 text-indigo-700 shadow-sm" 
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <item.icon size={20} className={cn(
              "transition-colors",
              activeTab === item.id ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
            )} />
            {item.label}
            {activeTab === item.id && (
              <motion.div 
                layoutId="active-pill"
                className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600"
              />
            )}
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold">
            GT
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">Gökhan Turhan</p>
            <p className="text-xs text-slate-500 truncate">Genel Müdür</p>
          </div>
          <button className="text-slate-400 hover:text-slate-600">
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

const Header = ({ title }: { title: string }) => {
  return (
    <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <div className="h-6 w-px bg-slate-200 mx-2" />
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Clock size={16} />
          <span>8 Nisan 2026, 13:56</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Proje, müşteri veya evrak ara..." 
            className="pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-500 rounded-full text-sm w-64 transition-all outline-none"
          />
        </div>
        <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full relative">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
        </button>
        <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-full text-sm font-semibold transition-colors shadow-lg shadow-indigo-200">
          <Plus size={18} />
          <span>Yeni Proje</span>
        </button>
      </div>
    </header>
  );
};

// --- Modules ---

const Dashboard = () => {
  return (
    <div className="p-8 space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Aktif Projeler', value: '12', icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Toplam Pipeline', value: '$2.4M', icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Ortalama Marj', value: '%16.4', icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Bekleyen Onaylar', value: '5', icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={i} 
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-2xl", stat.bg)}>
                <stat.icon size={24} className={stat.color} />
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-1">
                <ArrowUpRight size={12} /> +4.2%
              </span>
            </div>
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Son Projeler</h3>
              <button className="text-indigo-600 text-sm font-semibold hover:underline">Tümünü Gör</button>
            </div>
            <div className="divide-y divide-slate-100">
              {MOCK_PROJECTS.map((project) => (
                <div key={project.id} className="p-6 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-indigo-600 transition-colors">
                      <Briefcase size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{project.name}</h4>
                      <p className="text-xs text-slate-500">Müşteri ID: {project.customerId}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-bold text-slate-900">${project.totalValue.toLocaleString()}</p>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider",
                      project.status === 'ANALYSIS' ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {project.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-6">Kritik Uyarılar</h3>
            <div className="space-y-4">
              {[
                { title: 'ISO 27001 Yenileme', desc: 'Süre dolmasına 12 gün kaldı.', type: 'warning' },
                { title: 'Düşük Marjlı Teklif', desc: 'P2 projesi %9.2 marj ile onay bekliyor.', type: 'danger' },
                { title: 'ETA Gecikmesi', desc: 'Dell Server siparişi 3 gün gecikti.', type: 'info' },
              ].map((alert, i) => (
                <div key={i} className={cn(
                  "p-4 rounded-2xl border flex gap-3",
                  alert.type === 'warning' ? "bg-amber-50 border-amber-100" : 
                  alert.type === 'danger' ? "bg-red-50 border-red-100" : "bg-blue-50 border-blue-100"
                )}>
                  <AlertCircle size={20} className={cn(
                    alert.type === 'warning' ? "text-amber-600" : 
                    alert.type === 'danger' ? "text-red-600" : "text-blue-600"
                  )} />
                  <div>
                    <h5 className="text-sm font-bold text-slate-900 leading-none mb-1">{alert.title}</h5>
                    <p className="text-xs text-slate-600">{alert.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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

const DocumentsModule = () => {
  const [filter, setFilter] = useState('ALL');

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
        <button className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2">
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
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
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

      <div className="bg-white rounded-3xl border border-slate-200 p-8">
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
    </div>
  );
};

const ProcurementModule = () => {
  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Satın Alma & Tedarik Zinciri</h3>
          <p className="text-slate-500">Sipariş takibi, ETA yönetimi ve depo girişleri.</p>
        </div>
        <div className="flex gap-3">
          <button className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2">
            <Filter size={18} />
            Filtrele
          </button>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2">
            <ShoppingCart size={18} />
            Yeni Sipariş
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
              <h4 className="font-bold text-slate-900">Aktif Siparişler & ETA Takibi</h4>
            </div>
            <div className="divide-y divide-slate-100">
              {[
                { id: 'po1', vendor: 'Arena Bilgisayar', project: 'Veri Merkezi Mod.', status: 'SHIPPED', eta: '2026-04-10', items: 12, progress: 70 },
                { id: 'po2', vendor: 'Index A.Ş.', project: 'Network Altyapı', status: 'ORDERED', eta: '2026-04-15', items: 5, progress: 20 },
                { id: 'po3', vendor: 'Dell Global', project: 'Server Upgrade', status: 'IN_WAREHOUSE', eta: '2026-04-05', items: 2, progress: 100 },
              ].map((po) => (
                <div key={po.id} className="p-6 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center",
                        po.status === 'IN_WAREHOUSE' ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
                      )}>
                        {po.status === 'IN_WAREHOUSE' ? <Package size={20} /> : <Truck size={20} />}
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900">{po.vendor}</h5>
                        <p className="text-xs text-slate-500">{po.project}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-400 uppercase">ETA</p>
                      <p className="text-sm font-bold text-slate-900">{po.eta}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={cn(
                        "h-full rounded-full transition-all duration-500",
                        po.status === 'IN_WAREHOUSE' ? "bg-emerald-500 w-full" : "bg-blue-500",
                        po.status === 'SHIPPED' ? "w-2/3" : "w-1/4"
                      )} />
                    </div>
                    <span className="text-xs font-bold text-slate-500">{po.items} Kalem</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-md uppercase",
                      po.status === 'IN_WAREHOUSE' ? "bg-emerald-100 text-emerald-700" : 
                      po.status === 'SHIPPED' ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
                    )}>
                      {po.status === 'IN_WAREHOUSE' ? 'Depoda' : po.status === 'SHIPPED' ? 'Yolda' : 'Sipariş Geçildi'}
                    </span>
                    <button className="text-xs font-bold text-indigo-600 hover:underline">Detaylar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6">
            <h4 className="font-bold text-slate-900 mb-6">Depo Özeti</h4>
            <div className="space-y-4">
              {[
                { label: 'Toplam Stok Kalemi', value: '142', icon: Package, color: 'text-blue-600' },
                { label: 'Bekleyen Sevkıyat', value: '3', icon: Truck, color: 'text-amber-600' },
                { label: 'Kritik Stok', value: '12', icon: AlertCircle, color: 'text-red-600' },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                  <div className="flex items-center gap-3">
                    <item.icon size={20} className={item.color} />
                    <span className="text-sm font-medium text-slate-600">{item.label}</span>
                  </div>
                  <span className="text-lg font-bold text-slate-900">{item.value}</span>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-3 bg-indigo-50 text-indigo-600 rounded-2xl text-sm font-bold hover:bg-indigo-100 transition-all">
              Depo Yönetimine Git
            </button>
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
        </div>
      </div>
    </div>
  );
};

const TodoModule = () => {
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [todos, setTodos] = useState<TodoTask[]>(MOCK_TODO_TASKS);

  const filteredTodos = filterUnit === 'all' 
    ? todos 
    : todos.filter(t => t.unitId === filterUnit);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-700 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'MEDIUM': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle2 size={16} className="text-emerald-500" />;
      case 'IN_PROGRESS': return <Clock size={16} className="text-amber-500" />;
      case 'CANCELLED': return <X size={16} className="text-slate-400" />;
      default: return <AlertCircle size={16} className="text-indigo-500" />;
    }
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Görevler & Takip</h3>
          <p className="text-slate-500">Birim bazlı yönetimsel görev atamaları ve süreç takibi.</p>
        </div>
        <button className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2">
          <Plus size={20} />
          Yeni Görev Ata
        </button>
      </div>

      <div className="flex items-center gap-4 overflow-x-auto pb-2">
        <button 
          onClick={() => setFilterUnit('all')}
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-bold border transition-all whitespace-nowrap",
            filterUnit === 'all' ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          )}
        >
          Tüm Birimler
        </button>
        {MOCK_UNITS.map(unit => (
          <button 
            key={unit.id}
            onClick={() => setFilterUnit(unit.id)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold border transition-all whitespace-nowrap",
              filterUnit === unit.id ? "bg-indigo-600 text-white border-indigo-600 shadow-md" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            {unit.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredTodos.map((todo) => (
          <div key={todo.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-3">
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider", getPriorityColor(todo.priority))}>
                  {todo.priority}
                </span>
                <h4 className="font-bold text-slate-900">{todo.title}</h4>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed">{todo.description}</p>
              <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <Briefcase size={14} />
                  {MOCK_UNITS.find(u => u.id === todo.unitId)?.name}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <Calendar size={14} />
                  Termin: {todo.dueDate}
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 pt-4 md:pt-0">
              <div className="flex items-center gap-2">
                {getStatusIcon(todo.status)}
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  {todo.status.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors">
                  <Settings size={18} />
                </button>
                <button className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-emerald-600 transition-colors">
                  <CheckCircle2 size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SettingsModule = () => {
  const [activeSubTab, setActiveSubTab] = useState('units');
  const [ncConfig, setNcConfig] = useState<NextcloudConfig>(nextcloudService.getConfig());
  const [exConfig, setExConfig] = useState<ExchangeConfig>(exchangeService.getConfig());
  const [waConfig, setWaConfig] = useState<WhatsAppConfig>(whatsappService.getConfig());

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Şirket Ayarları</h3>
          <p className="text-slate-500">Birim tanımlamaları, kullanıcı yönetimi ve yetkilendirme.</p>
        </div>
        <button className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2">
          <Plus size={20} />
          {activeSubTab === 'units' ? 'Yeni Birim' : activeSubTab === 'users' ? 'Yeni Kullanıcı' : activeSubTab === 'integrations' ? 'Entegrasyon Ekle' : 'Yeni Yetki'}
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-slate-200">
        {[
          { id: 'units', label: 'Birimler', icon: LayoutDashboard },
          { id: 'users', label: 'Kullanıcılar', icon: Users },
          { id: 'permissions', label: 'Yetkiler', icon: ShieldCheck },
          { id: 'integrations', label: 'Entegrasyonlar', icon: Puzzle },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={cn(
              "px-6 py-4 text-sm font-bold transition-all border-b-2 flex items-center gap-2",
              activeSubTab === tab.id 
                ? "border-indigo-600 text-indigo-600" 
                : "border-transparent text-slate-500 hover:text-slate-700"
            )}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeSubTab === 'units' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {MOCK_UNITS.map((unit) => (
                <div key={unit.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                      <Briefcase size={24} />
                    </div>
                    <button className="text-slate-400 hover:text-slate-600">
                      <MoreVertical size={20} />
                    </button>
                  </div>
                  <h4 className="font-bold text-slate-900 mb-2">{unit.name}</h4>
                  <p className="text-sm text-slate-500 mb-6 leading-relaxed">{unit.description}</p>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <span className="text-xs font-bold text-slate-400">8 Kullanıcı</span>
                    <button className="text-xs font-bold text-indigo-600 hover:underline">Düzenle</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSubTab === 'users' && (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                    <th className="py-6 px-6">Ad Soyad / Email</th>
                    <th className="py-6 px-6">Birim</th>
                    <th className="py-6 px-6">Rol</th>
                    <th className="py-6 px-6">Durum</th>
                    <th className="py-6 px-6 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {MOCK_SYSTEM_USERS.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-6 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                            {user.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{user.name}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-6 px-6">
                        <span className="text-sm text-slate-600">
                          {MOCK_UNITS.find(u => u.id === user.unitId)?.name || '-'}
                        </span>
                      </td>
                      <td className="py-6 px-6">
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">
                          {user.role}
                        </span>
                      </td>
                      <td className="py-6 px-6">
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-md",
                          user.status === 'ACTIVE' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                        )}>
                          {user.status === 'ACTIVE' ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="py-6 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => nextcloudService.syncUser(user)}
                            className="text-slate-400 hover:text-blue-600 transition-colors p-2"
                            title="Nextcloud'a Senkronize Et"
                          >
                            <History size={18} />
                          </button>
                          <button className="text-slate-400 hover:text-indigo-600 transition-colors p-2">
                            <Settings size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeSubTab === 'permissions' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {MOCK_PERMISSIONS.map((perm) => (
                <div key={perm.id} className="bg-white p-6 rounded-3xl border border-slate-200 flex items-start gap-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <ShieldCheck size={24} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-slate-900">{perm.name}</h4>
                      <code className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {perm.code}
                      </code>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed mb-4">{perm.description}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-400">Atanan Rol Sayısı: 3</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSubTab === 'integrations' && (
            <IntegrationWizard 
              ncConfig={ncConfig} 
              setNcConfig={setNcConfig} 
              exConfig={exConfig}
              setExConfig={setExConfig}
              waConfig={waConfig}
              setWaConfig={setWaConfig}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const IntegrationWizard = ({ 
  ncConfig, 
  setNcConfig,
  exConfig,
  setExConfig,
  waConfig,
  setWaConfig
}: { 
  ncConfig: NextcloudConfig, 
  setNcConfig: (c: NextcloudConfig) => void,
  exConfig: ExchangeConfig,
  setExConfig: (c: ExchangeConfig) => void,
  waConfig: WhatsAppConfig,
  setWaConfig: (c: WhatsAppConfig) => void
}) => {
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null);
  const [wizardStep, setWizardStep] = useState(1);

  const INTEGRATIONS = [
    { id: 'nextcloud', name: 'Nextcloud DMS', description: 'Dosya yönetimi ve paylaşım sistemi.', icon: History, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'sap', name: 'SAP ERP', description: 'Kurumsal kaynak planlama entegrasyonu.', icon: Cpu, color: 'text-slate-600', bg: 'bg-slate-50' },
    { id: 'exchange', name: 'MS Exchange', description: 'E-posta ve takvim senkronizasyonu.', icon: Mail, color: 'text-red-600', bg: 'bg-red-50' },
    { id: 'whatsapp', name: 'WhatsApp Business', description: 'Müşteri bildirimleri ve sohbet.', icon: MessageSquare, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  if (!selectedIntegration) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {INTEGRATIONS.map((int) => (
          <div 
            key={int.id} 
            onClick={() => setSelectedIntegration(int.id)}
            className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer group"
          >
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform", int.bg, int.color)}>
              <int.icon size={24} />
            </div>
            <h4 className="font-bold text-slate-900 mb-1">{int.name}</h4>
            <p className="text-xs text-slate-500 leading-relaxed">{int.description}</p>
            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Kurulum Bekliyor</span>
              <Plus size={16} className="text-indigo-600" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedIntegration(null)} className="p-2 hover:bg-white rounded-xl transition-colors">
              <ChevronRight size={20} className="rotate-180" />
            </button>
            <div>
              <h4 className="font-bold text-slate-900">{INTEGRATIONS.find(i => i.id === selectedIntegration)?.name} Kurulum Sihirbazı</h4>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Adım {wizardStep} / 3</p>
            </div>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3].map(s => (
              <div key={s} className={cn("h-1.5 w-8 rounded-full", wizardStep >= s ? "bg-indigo-600" : "bg-slate-200")} />
            ))}
          </div>
        </div>

        <div className="p-8">
          <AnimatePresence mode="wait">
            {selectedIntegration === 'nextcloud' && (
              <motion.div
                key={wizardStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {wizardStep === 1 && (
                  <div className="space-y-6">
                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-start gap-4">
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><History size={24} /></div>
                      <div>
                        <h5 className="font-bold text-blue-900">Sunucu Bağlantısı</h5>
                        <p className="text-sm text-blue-700">Nextcloud sunucunuzun WebDAV ve OCS API adreslerini tanımlayın.</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Sunucu URL</label>
                        <input 
                          type="text" 
                          value={ncConfig.url}
                          onChange={(e) => setNcConfig({...ncConfig, url: e.target.value})}
                          placeholder="https://cloud.sirketiniz.com"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Kök Klasör (DMS)</label>
                        <input 
                          type="text" 
                          value={ncConfig.basePath}
                          onChange={(e) => setNcConfig({...ncConfig, basePath: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {wizardStep === 2 && (
                  <div className="space-y-6">
                    <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 flex items-start gap-4">
                      <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><ShieldCheck size={24} /></div>
                      <div>
                        <h5 className="font-bold text-amber-900">Kimlik Doğrulama</h5>
                        <p className="text-sm text-amber-700">Yönetici yetkisine sahip bir kullanıcı hesabı girin.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Admin Kullanıcı</label>
                        <input 
                          type="text" 
                          value={ncConfig.adminUser}
                          onChange={(e) => setNcConfig({...ncConfig, adminUser: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Admin Şifre</label>
                        <input 
                          type="password" 
                          value={ncConfig.adminPass}
                          onChange={(e) => setNcConfig({...ncConfig, adminPass: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {wizardStep === 3 && (
                  <div className="space-y-6">
                    <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex items-start gap-4">
                      <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><Wand2 size={24} /></div>
                      <div>
                        <h5 className="font-bold text-emerald-900">Tamamlanıyor</h5>
                        <p className="text-sm text-emerald-700">Senkronizasyon ayarlarını onaylayın ve testi başlatın.</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <span className="text-sm font-medium text-slate-600">Otomatik Kullanıcı Oluşturma</span>
                        <div className="w-10 h-5 bg-emerald-500 rounded-full relative"><div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" /></div>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <span className="text-sm font-medium text-slate-600">Tarih Bazlı Klasörleme</span>
                        <div className="w-10 h-5 bg-emerald-500 rounded-full relative"><div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full" /></div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {selectedIntegration === 'exchange' && (
              <motion.div
                key={wizardStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {wizardStep === 1 && (
                  <div className="space-y-6">
                    <div className="bg-red-50 p-6 rounded-2xl border border-red-100 flex items-start gap-4">
                      <div className="p-2 bg-red-100 text-red-600 rounded-xl"><Mail size={24} /></div>
                      <div>
                        <h5 className="font-bold text-red-900">Exchange Sunucu Bilgileri</h5>
                        <p className="text-sm text-red-700">MS Exchange sunucu adresinizi ve domain bilgilerinizi girin.</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Sunucu Adresi (OWA/EWS)</label>
                        <input 
                          type="text" 
                          value={exConfig.serverUrl}
                          onChange={(e) => setExConfig({...exConfig, serverUrl: e.target.value})}
                          placeholder="outlook.office365.com"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Domain</label>
                        <input 
                          type="text" 
                          value={exConfig.domain}
                          onChange={(e) => setExConfig({...exConfig, domain: e.target.value})}
                          placeholder="sirketadi.local"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {wizardStep === 2 && (
                  <div className="space-y-6">
                    <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 flex items-start gap-4">
                      <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><ShieldCheck size={24} /></div>
                      <div>
                        <h5 className="font-bold text-amber-900">Yönetici Hesabı</h5>
                        <p className="text-sm text-amber-700">Senkronizasyon için yetkili bir e-posta hesabı tanımlayın.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Admin E-posta</label>
                        <input 
                          type="email" 
                          value={exConfig.adminEmail}
                          onChange={(e) => setExConfig({...exConfig, adminEmail: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Şifre / Uygulama Şifresi</label>
                        <input 
                          type="password" 
                          value={exConfig.adminPass}
                          onChange={(e) => setExConfig({...exConfig, adminPass: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {wizardStep === 3 && (
                  <div className="space-y-6">
                    <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex items-start gap-4">
                      <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><Wand2 size={24} /></div>
                      <div>
                        <h5 className="font-bold text-emerald-900">Senkronizasyon Tercihleri</h5>
                        <p className="text-sm text-emerald-700">Hangi verilerin senkronize edileceğini seçin.</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <span className="text-sm font-medium text-slate-600">E-posta Senkronizasyonu</span>
                        <div 
                          onClick={() => setExConfig({...exConfig, syncEmails: !exConfig.syncEmails})}
                          className={cn("w-10 h-5 rounded-full relative cursor-pointer transition-colors", exConfig.syncEmails ? "bg-emerald-500" : "bg-slate-300")}
                        >
                          <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", exConfig.syncEmails ? "right-1" : "left-1")} />
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <span className="text-sm font-medium text-slate-600">Takvim Senkronizasyonu</span>
                        <div 
                          onClick={() => setExConfig({...exConfig, syncCalendar: !exConfig.syncCalendar})}
                          className={cn("w-10 h-5 rounded-full relative cursor-pointer transition-colors", exConfig.syncCalendar ? "bg-emerald-500" : "bg-slate-300")}
                        >
                          <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", exConfig.syncCalendar ? "right-1" : "left-1")} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {selectedIntegration === 'whatsapp' && (
              <motion.div
                key={wizardStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {wizardStep === 1 && (
                  <div className="space-y-6">
                    <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 flex items-start gap-4">
                      <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl"><MessageSquare size={24} /></div>
                      <div>
                        <h5 className="font-bold text-emerald-900">WhatsApp API Bilgileri</h5>
                        <p className="text-sm text-emerald-700">Meta for Developers panelinden aldığınız API bilgilerini girin.</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Phone Number ID</label>
                        <input 
                          type="text" 
                          value={waConfig.phoneNumberId}
                          onChange={(e) => setWaConfig({...waConfig, phoneNumberId: e.target.value})}
                          placeholder="1092837465..."
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">WhatsApp Business Account ID</label>
                        <input 
                          type="text" 
                          value={waConfig.businessAccountId}
                          onChange={(e) => setWaConfig({...waConfig, businessAccountId: e.target.value})}
                          placeholder="987654321..."
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {wizardStep === 2 && (
                  <div className="space-y-6">
                    <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 flex items-start gap-4">
                      <div className="p-2 bg-amber-100 text-amber-600 rounded-xl"><ShieldCheck size={24} /></div>
                      <div>
                        <h5 className="font-bold text-amber-900">Erişim Anahtarı</h5>
                        <p className="text-sm text-amber-700">Süresiz (Permanent) Access Token bilginizi girin.</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">System User Access Token</label>
                        <textarea 
                          value={waConfig.accessToken}
                          onChange={(e) => setWaConfig({...waConfig, accessToken: e.target.value})}
                          rows={3}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500 resize-none"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {wizardStep === 3 && (
                  <div className="space-y-6">
                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-start gap-4">
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><Cpu size={24} /></div>
                      <div>
                        <h5 className="font-bold text-blue-900">Webhook Yapılandırması</h5>
                        <p className="text-sm text-blue-700">Gelen mesajları dinlemek için Webhook ayarlarını tamamlayın.</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Webhook Verify Token</label>
                        <input 
                          type="text" 
                          value={waConfig.webhookVerifyToken}
                          onChange={(e) => setWaConfig({...waConfig, webhookVerifyToken: e.target.value})}
                          placeholder="Kendi belirlediğiniz bir anahtar"
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Callback URL</p>
                        <code className="text-xs text-indigo-600 break-all">https://api.enflow.com/webhooks/whatsapp</code>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {selectedIntegration !== 'nextcloud' && selectedIntegration !== 'exchange' && selectedIntegration !== 'whatsapp' && (
              <div className="py-12 text-center space-y-4">
                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300 mx-auto">
                  <Cpu size={40} />
                </div>
                <h5 className="font-bold text-slate-900">Bu Entegrasyon Yakında Gelecek</h5>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">Seçtiğiniz servis için sihirbaz hazırlık aşamasındadır.</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between">
          <button 
            onClick={() => setWizardStep(Math.max(1, wizardStep - 1))}
            disabled={wizardStep === 1}
            className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 disabled:opacity-30"
          >
            Geri
          </button>
          <div className="flex gap-3">
            <button 
              onClick={() => setSelectedIntegration(null)}
              className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
            >
              İptal
            </button>
            <button 
              onClick={() => {
                if (wizardStep < 3) setWizardStep(wizardStep + 1);
                else {
                  if (selectedIntegration === 'nextcloud') nextcloudService.updateConfig(ncConfig);
                  if (selectedIntegration === 'exchange') exchangeService.updateConfig(exConfig);
                  if (selectedIntegration === 'whatsapp') whatsappService.updateConfig(waConfig);
                  setSelectedIntegration(null);
                  setWizardStep(1);
                }
              }}
              className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
            >
              {wizardStep === 3 ? 'Kurulumu Tamamla' : 'Devam Et'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ContractModule = () => {
  const [selectedContract, setSelectedContract] = useState(MOCK_CONTRACTS[0]);
  const [showArchiveAccess, setShowArchiveAccess] = useState(false);
  const project = MOCK_PROJECTS.find(p => p.id === selectedContract.projectId);
  const contractDocs = MOCK_CONTRACT_DOCS.filter(doc => doc.contractId === selectedContract.id);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Sözleşme Yönetimi</h3>
          <p className="text-slate-500">Kazanılan projelerin sözleşme süreçleri, teminat takibi ve evrak yönetimi.</p>
        </div>
        <div className="flex gap-3">
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
            Proje Kazanıldı: {project?.name}
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
                  <span className="text-xs font-bold text-slate-400">Satış Destek Takibi</span>
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
                    <p className="text-xl font-bold text-slate-900">${selectedContract.guaranteeAmount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Geçerlilik Tarihi</p>
                    <p className="text-sm font-bold text-slate-700">{selectedContract.guaranteeExpiry}</p>
                  </div>
                  <button className="w-full py-3 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all">
                    Sözleşmeyi İmzala & Devret
                  </button>
                </div>
              </div>

              <div className="bg-indigo-600 p-6 rounded-3xl text-white shadow-lg shadow-indigo-200">
                <h4 className="font-bold mb-2">Süreç Notu</h4>
                <p className="text-xs text-indigo-100 leading-relaxed">
                  Tüm evraklar onaylandığında ve sözleşme imzalandığında proje otomatik olarak "Proje Yönetimi" modülüne aktarılacaktır.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProjectManagementModule = () => {
  const [selectedProject] = useState(MOCK_PROJECTS[0]);
  const tasks = MOCK_PROJECT_TASKS.filter(t => t.projectId === selectedProject.id);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Proje Yönetimi</h3>
          <p className="text-slate-500">Operasyonel süreçler, saha kurulumları ve görev takibi.</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 border border-indigo-100">
            <Kanban size={18} />
            Aktif Proje: {selectedProject.name}
          </div>
        </div>
      </div>

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
                {tasks.filter(t => t.status === status).length}
              </span>
            </div>
            
            <div className="space-y-4 flex-1">
              {tasks.filter(t => t.status === status).map((task) => (
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
              <button className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-bold hover:border-indigo-300 hover:text-indigo-500 transition-all flex items-center justify-center gap-2">
                <Plus size={16} /> Görev Ekle
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CRMModule = () => {
  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">CRM & Fırsat Takibi</h3>
          <p className="text-slate-500">Müşteri ilişkileri ve satış boru hattı yönetimi.</p>
        </div>
        <button className="bg-indigo-600 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2">
          <Plus size={20} /> Yeni Fırsat
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h4 className="font-bold text-slate-900">Aktif Fırsatlar</h4>
          <div className="flex gap-2">
            <button className="p-2 text-slate-400 hover:text-slate-600"><Filter size={18} /></button>
            <button className="p-2 text-slate-400 hover:text-slate-600"><Search size={18} /></button>
          </div>
        </div>
        <div className="divide-y divide-slate-100">
          {MOCK_PROJECTS.map((project) => (
            <div key={project.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Users size={24} />
                </div>
                <div>
                  <h5 className="font-bold text-slate-900">{project.name}</h5>
                  <p className="text-xs text-slate-500">{MOCK_CUSTOMERS.find(c => c.id === project.customerId)?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Değer</p>
                  <p className="text-sm font-bold text-slate-900">${project.totalValue.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">Durum</p>
                  <select 
                    defaultValue={project.status}
                    className={cn(
                      "text-xs font-bold px-3 py-1.5 rounded-xl border-none outline-none cursor-pointer",
                      project.status === 'WON' ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                    )}
                  >
                    <option value="ANALYSIS">Analiz</option>
                    <option value="AWAITING_APPROVAL">Onay Bekliyor</option>
                    <option value="WON">Kazanıldı</option>
                    <option value="LOST">Kaybedildi</option>
                  </select>
                </div>
                <button className="text-slate-400 hover:text-indigo-600 p-2">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl flex items-start gap-4">
        <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
          <AlertCircle size={24} />
        </div>
        <div>
          <h5 className="font-bold text-amber-900">Otomatik İş Akışı Bilgisi</h5>
          <p className="text-sm text-amber-700 mt-1">
            Fırsat durumu <strong>"Kazanıldı"</strong> olarak güncellendiğinde, sistem otomatik olarak projeyi <strong>Sözleşme Yönetimi</strong> modülüne aktarır ve Satış Destek ekibine bildirim gönderir.
          </p>
        </div>
      </div>
    </div>
  );
};

const CostAnalysisModule = () => {
  const [selectedProject, setSelectedProject] = useState(MOCK_PROJECTS[0]);
  const [view, setView] = useState<'SUMMARY' | 'PRESALES' | 'SALES'>('SUMMARY');

  const projectBoM = MOCK_BOM_ITEMS.filter(item => item.projectId === selectedProject.id);
  const projectCosts = MOCK_COST_REQUIREMENTS.filter(item => item.projectId === selectedProject.id);

  const totalBoMCost = projectBoM.reduce((sum, item) => sum + (item.purchaseCost * item.quantity), 0);
  const totalOtherCost = projectCosts.reduce((sum, item) => sum + (item.estimatedCost || 0), 0);
  const totalProjectCost = totalBoMCost + totalOtherCost;
  const totalSaleValue = projectBoM.reduce((sum, item) => sum + item.totalSalePrice, 0);
  const grossProfit = totalSaleValue - totalProjectCost;
  const margin = totalSaleValue > 0 ? (grossProfit / totalSaleValue) * 100 : 0;

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Proje Maliyet Analizi</h3>
          <p className="text-slate-500">Karlılık oranları, ürün bazlı maliyet dağılımı ve risk analizi.</p>
        </div>
        <div className="flex gap-3">
          <select 
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
            value={selectedProject.id}
            onChange={(e) => setSelectedProject(MOCK_PROJECTS.find(p => p.id === e.target.value) || MOCK_PROJECTS[0])}
          >
            {MOCK_PROJECTS.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setView('SUMMARY')}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", view === 'SUMMARY' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              Özet
            </button>
            <button 
              onClick={() => setView('PRESALES')}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", view === 'PRESALES' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              Presales
            </button>
            <button 
              onClick={() => setView('SALES')}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold transition-all", view === 'SALES' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              Satış
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-8"
        >
          {view === 'SUMMARY' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Toplam Maliyet</p>
                  <h4 className="text-2xl font-bold text-slate-900">${totalProjectCost.toLocaleString()}</h4>
                  <div className="mt-2 flex items-center gap-2 text-[10px]">
                    <span className="text-blue-600 font-bold">BoM: ${totalBoMCost.toLocaleString()}</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-amber-600 font-bold">Diğer: ${totalOtherCost.toLocaleString()}</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Satış Bedeli</p>
                  <h4 className="text-2xl font-bold text-slate-900">${totalSaleValue.toLocaleString()}</h4>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Brüt Kar</p>
                  <h4 className={cn("text-2xl font-bold", grossProfit >= 0 ? "text-emerald-600" : "text-red-600")}>
                    ${grossProfit.toLocaleString()}
                  </h4>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Proje Marjı</p>
                  <h4 className={cn("text-2xl font-bold", margin >= 15 ? "text-emerald-600" : margin >= 10 ? "text-amber-600" : "text-red-600")}>
                    %{margin.toFixed(1)}
                  </h4>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-3xl border border-slate-200 p-8">
                  <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <PieChart size={20} className="text-indigo-600" />
                    Maliyet Dağılımı
                  </h4>
                  <div className="space-y-6">
                    {[
                      { label: 'Donanım & Yazılım (BoM)', value: Math.round((totalBoMCost / totalProjectCost) * 100) || 0, color: 'bg-blue-500' },
                      { label: 'Diğer Masraflar', value: Math.round((totalOtherCost / totalProjectCost) * 100) || 0, color: 'bg-amber-500' },
                    ].map((item, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-slate-600">{item.label}</span>
                          <span className="font-bold text-slate-900">%{item.value}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${item.value}%` }}
                            className={cn("h-full rounded-full", item.color)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 p-8">
                  <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Target size={20} className="text-red-600" />
                    Risk & Duyarlılık Analizi
                  </h4>
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-900">Döviz Kuru Etkisi (+%5)</span>
                        <span className="text-xs font-bold text-red-600 flex items-center gap-1">
                          <ArrowDownRight size={14} /> -%3.2 Marj
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">Dolar kurundaki %5 artışın toplam karlılığa etkisi.</p>
                    </div>
                    <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-emerald-900">Üretici Rebate Potansiyeli</span>
                        <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                          <ArrowUpRight size={14} /> +%2.0 Marj
                        </span>
                      </div>
                      <p className="text-xs text-emerald-700">Beklenen üretici geri ödemesi.</p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {view === 'PRESALES' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* BoM Entry */}
              <div className="bg-white rounded-3xl border border-slate-200 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <ShoppingCart size={20} className="text-indigo-600" />
                    BoM & Fiyatlandırma
                  </h4>
                  <button className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1">
                    <Plus size={14} /> Ürün Ekle
                  </button>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto max-h-[500px]">
                  {projectBoM.map((item) => (
                    <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-xs font-bold text-indigo-600">{item.partNumber}</span>
                        <span className="text-xs font-bold text-slate-400">{item.vendor}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-700 mb-3">{item.description}</p>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Maliyet</p>
                          <p className="text-sm font-bold text-slate-900">${item.purchaseCost}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Marj</p>
                          <p className="text-sm font-bold text-indigo-600">%{item.marginPercentage}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Satış</p>
                          <p className="text-sm font-bold text-slate-900">${item.totalSalePrice.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cost Requirements Identification */}
              <div className="bg-white rounded-3xl border border-slate-200 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <FileSearch size={20} className="text-amber-600" />
                    Ek Masraf Kalemleri Belirleme
                  </h4>
                </div>
                <div className="p-6 space-y-6">
                  <div className="space-y-4">
                    <p className="text-sm text-slate-500">Şartname maddelerine göre satış ekibinin maliyetlendirmesi gereken kalemleri ekleyin.</p>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Örn: 2 hafta kurulum işçiliği" 
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
                      />
                      <button className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md">Ekle</button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {projectCosts.map((cost) => (
                      <div key={cost.id} className="p-4 border border-slate-100 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400">
                            <Archive size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{cost.description}</p>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{cost.category}</span>
                          </div>
                        </div>
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-md",
                          cost.status === 'IDENTIFIED' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                        )}>
                          {cost.status === 'IDENTIFIED' ? 'Maliyet Bekliyor' : 'Maliyetlendi'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'SALES' && (
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <DollarSign size={20} className="text-emerald-600" />
                  Masraf Kalemlerini Maliyetlendirme
                </h4>
                <p className="text-xs text-slate-500">Presales tarafından iletilen listeyi ilgili birimlerle görüşerek fiyatlandırın.</p>
              </div>
              <div className="divide-y divide-slate-100">
                {projectCosts.map((cost) => (
                  <div key={cost.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                        <Briefcase size={24} />
                      </div>
                      <div>
                        <h5 className="font-bold text-slate-900">{cost.description}</h5>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{cost.category}</span>
                          <span className="text-slate-200">•</span>
                          <span className="text-[10px] text-slate-500">Talep Eden: {MOCK_SYSTEM_USERS.find(u => u.id === cost.identifiedBy)?.name}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Tahmini Maliyet ($)</p>
                        <input 
                          type="number" 
                          defaultValue={cost.estimatedCost || 0}
                          className="w-32 px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 text-right"
                        />
                      </div>
                      <button className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                        cost.status === 'COSTED' ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      )}>
                        {cost.status === 'COSTED' ? 'Güncelle' : 'Kaydet'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'crm': return <CRMModule />;
      case 'presales': return <SmartImporter />;
      case 'sales-support': return <SalesSupport />;
      case 'procurement': return <ProcurementModule />;
      case 'documents': return <DocumentsModule />;
      case 'cost-analysis': return <CostAnalysisModule />;
      case 'contracts': return <ContractModule />;
      case 'project-mgmt': return <ProjectManagementModule />;
      case 'todo': return <TodoModule />;
      case 'settings': return <SettingsModule />;
      default: return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400">
          <Settings size={48} className="mb-4 opacity-20" />
          <p className="text-lg font-medium">Bu modül yakında eklenecek.</p>
          <p className="text-sm">Şu an Dashboard, CRM, Presales, Satış Destek, Satın Alma, Evrak, Maliyet Analizi, Sözleşme, Proje Yönetimi ve Ayarlar modülleri aktiftir.</p>
        </div>
      );
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 flex flex-col min-w-0">
        <Header title={NAV_ITEMS.find(i => i.id === activeTab)?.label || 'Dashboard'} />
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

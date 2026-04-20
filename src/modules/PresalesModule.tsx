import React, { useState, useEffect } from 'react';
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
import SpecAnalysis from './SpecAnalysis';

interface PresalesModuleProps {
  opportunities: Opportunity[];
  setOpportunities: React.Dispatch<React.SetStateAction<Opportunity[]>>;
}

const PresalesModule = ({ opportunities, setOpportunities }: PresalesModuleProps) => {
  const [moduleView, setModuleView] = useState<'BOM' | 'ANALYSIS'>('BOM');
  const [step, setStep] = useState(1);
  const [selectedOppId, setSelectedOppId] = useState<string>('');
  const [inputMode, setInputMode] = useState<'MANUAL' | 'IMPORT'>('IMPORT');
  const [isDragging, setIsDragging] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [bomItems, setBomItems] = useState<any[]>([]);

  useEffect(() => {
    if (selectedOppId) {
      const items = MOCK_BOM_ITEMS
        .filter(item => item.opportunityId === selectedOppId)
        .map(item => ({
          pn: item.partNumber,
          desc: item.description,
          qty: item.quantity,
          cost: item.purchaseCost,
          margin: item.marginPercentage
        }));
      setBomItems(items.length > 0 ? items : []);
    } else {
      setBomItems([]);
    }
  }, [selectedOppId]);

  const [newItem, setNewItem] = useState({
    pn: '',
    desc: '',
    qty: 1,
    cost: 0,
    margin: 15
  });

  const handleAddItem = () => {
    if (!newItem.pn || !newItem.desc) return;
    setBomItems([newItem, ...bomItems]);
    setNewItem({ pn: '', desc: '', qty: 1, cost: 0, margin: 15 });
  };

  const handleMatchItem = (item: any) => {
    setSelectedItem(item);
    setShowMatchModal(true);
  };

  const confirmMatch = () => {
    console.log('Matched item:', selectedItem);
    setShowMatchModal(false);
    setSelectedItem(null);
  };

  return (
    <div className="p-8 h-[calc(100vh-80px)] overflow-hidden flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Presales & Dizayn</h3>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-slate-500 whitespace-nowrap">BoM listesini fırsata bağlayın:</p>
            <select 
              value={selectedOppId}
              onChange={(e) => setSelectedOppId(e.target.value)}
              className="bg-white/50 border border-slate-200 rounded-lg px-3 py-1 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">Fırsat Seçin</option>
              {opportunities.filter(o => o.status !== 'WON' && o.status !== 'LOST').map(opp => (
                <option key={opp.id} value={opp.id}>{opp.title}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-200/50 p-1 rounded-2xl">
            <button 
              onClick={() => setModuleView('BOM')}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                moduleView === 'BOM' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <LayoutDashboard size={16} />
              BoM Oluşturma
            </button>
            <button 
              onClick={() => setModuleView('ANALYSIS')}
              className={cn(
                "px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
                moduleView === 'ANALYSIS' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              <FileSearch size={16} />
              Şartname Analizi
            </button>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          {moduleView === 'BOM' && (
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => {
                  setInputMode('IMPORT');
                  setStep(1);
                }}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                  inputMode === 'IMPORT' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Dosya Aktar
              </button>
              <button 
                onClick={() => {
                  setInputMode('MANUAL');
                  setStep(2);
                }}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all",
                  inputMode === 'MANUAL' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                Manuel Giriş
              </button>
            </div>
          )}
          <div className="h-8 w-px bg-slate-200" />
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
    </div>

    {moduleView === 'BOM' ? (
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-hidden">
        {/* Left: Requirements */}
        <div className="glass-panel rounded-3xl flex flex-col overflow-hidden">
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

        {/* Right: Excel Import / BoM Entry */}
        <div className={cn(
          "glass-panel rounded-3xl flex flex-col overflow-hidden transition-all",
          inputMode === 'IMPORT' && step === 1 ? "border-2 border-dashed border-slate-200/50" : ""
        )}>
          {inputMode === 'IMPORT' && step === 1 ? (
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
              {!selectedOppId && (
                <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl mb-4 flex items-center gap-2 text-amber-800 text-xs font-medium animate-pulse">
                  <AlertCircle size={14} />
                  Lütfen önce bir fırsat seçin.
                </div>
              )}
              <p className="text-slate-500 mb-8 max-w-xs text-sm">Distribütörden gelen BoM listesini buraya sürükleyin veya seçin.</p>
              <button 
                onClick={() => {
                  if (!selectedOppId) {
                    alert('Lütfen önce bir fırsat seçin.');
                    return;
                  }
                  setStep(2);
                }}
                className={cn(
                  "px-8 py-3 rounded-full font-bold shadow-lg transition-all",
                  selectedOppId 
                    ? "bg-indigo-600 text-white shadow-indigo-200 hover:bg-indigo-700" 
                    : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                )}
              >
                Dosya Seç
              </button>
            </div>
          ) : (
            <>
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h4 className="font-bold text-slate-900">
                  {inputMode === 'MANUAL' ? 'BoM Veri Girişi' : 'İçeri Aktarılan Ürünler'}
                </h4>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Toplam Maliyet</p>
                    <p className="text-sm font-mono font-bold text-slate-900">
                      ${bomItems.reduce((acc, curr) => acc + (curr.cost * curr.qty), 0).toLocaleString()}
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      if (!selectedOppId) {
                        alert('Lütfen önce bir fırsat seçin.');
                        return;
                      }
                      const opp = opportunities.find(o => o.id === selectedOppId);
                      
                      // Update opportunity status to APPROVED so it's ready for proposal
                      setOpportunities(prev => prev.map(o => 
                        o.id === selectedOppId ? { ...o, bomStatus: 'APPROVED' } : o
                      ));

                      alert(`BoM listesi "${opp?.title}" fırsatı için başarıyla kaydedildi ve teklif için onaylandı.`);
                      setStep(1);
                      if (inputMode === 'IMPORT') setInputMode('IMPORT');
                    }}
                    className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-emerald-100 disabled:opacity-50"
                    disabled={!selectedOppId}
                  >
                    Kaydet
                  </button>
                </div>
              </div>

              {inputMode === 'MANUAL' && (
                <div className="p-6 border-b border-slate-100 bg-slate-50/30 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Parça No</label>
                      <input 
                        type="text" 
                        value={newItem.pn}
                        onChange={(e) => setNewItem({...newItem, pn: e.target.value})}
                        placeholder="DELL-R750-01"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Açıklama</label>
                      <input 
                        type="text" 
                        value={newItem.desc}
                        onChange={(e) => setNewItem({...newItem, desc: e.target.value})}
                        placeholder="Ürün açıklaması..."
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Adet</label>
                      <input 
                        type="number" 
                        value={newItem.qty}
                        onChange={(e) => setNewItem({...newItem, qty: Number(e.target.value)})}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Birim Maliyet ($)</label>
                      <input 
                        type="number" 
                        value={newItem.cost}
                        onChange={(e) => setNewItem({...newItem, cost: Number(e.target.value)})}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Marj (%)</label>
                      <input 
                        type="number" 
                        value={newItem.margin}
                        onChange={(e) => setNewItem({...newItem, margin: Number(e.target.value)})}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="flex items-end">
                      <button 
                        onClick={() => {
                          if (!selectedOppId) {
                            alert('Lütfen önce bir fırsat seçin.');
                            return;
                          }
                          handleAddItem();
                        }}
                        className={cn(
                          "w-full h-10 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2",
                          selectedOppId 
                            ? "bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700" 
                            : "bg-slate-200 text-slate-400 cursor-not-allowed"
                        )}
                      >
                        <Plus size={16} /> Ekle
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {bomItems.map((item, i) => (
                  <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md">{item.pn}</span>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-bold">MALIYET</p>
                          <input 
                            type="number" 
                            defaultValue={item.cost} 
                            className="w-16 bg-transparent text-right font-bold text-slate-900 outline-none focus:text-indigo-600"
                            onChange={(e) => {
                              const newCost = Number(e.target.value);
                              const updatedItems = [...bomItems];
                              updatedItems[i] = { ...item, cost: newCost };
                              setBomItems(updatedItems);
                            }}
                          />
                          <span className="text-xs font-bold text-slate-400">$</span>
                        </div>
                        <div className="h-8 w-px bg-slate-200" />
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-bold">MARJ</p>
                          <input 
                            type="number" 
                            defaultValue={item.margin} 
                            className="w-12 bg-transparent text-right font-bold text-slate-900 outline-none focus:text-indigo-600"
                            onChange={(e) => {
                              const newMargin = Number(e.target.value);
                              const updatedItems = [...bomItems];
                              updatedItems[i] = { ...item, margin: newMargin };
                              setBomItems(updatedItems);
                            }}
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
                      <button 
                        onClick={() => handleMatchItem(item)}
                        className="text-xs font-bold text-indigo-600 bg-white border border-indigo-100 px-3 py-1.5 rounded-lg hover:bg-indigo-600 hover:text-white transition-all flex items-center gap-1"
                      >
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
    ) : (
      <div className="flex-1 overflow-hidden">
        <SpecAnalysis opportunityId={selectedOppId} />
      </div>
    )}

    {/* Match Modal */}
      <AnimatePresence>
        {showMatchModal && selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-xl font-bold text-slate-900">Madde Eşleştir</h4>
                <button onClick={() => setShowMatchModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                  <p className="text-xs font-bold text-indigo-600 mb-1">{selectedItem.pn}</p>
                  <p className="text-sm text-indigo-900">{selectedItem.desc}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Şartname Maddesi Seçin</label>
                  <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500">
                    <option value="">Seçiniz</option>
                    <option value="r1">Madde 4.2.1 - En az 128 GB RAM ve 2x Gold CPU Sunucu</option>
                    <option value="r3">Madde 4.3.1 - 10Gbps SFP+ Network Modülü</option>
                    <option value="r4">Madde 4.3.2 - 24 Port Yönetilebilir Switch</option>
                  </select>
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => setShowMatchModal(false)}
                  className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                >
                  İptal
                </button>
                <button 
                  onClick={confirmMatch}
                  className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Eşleştir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PresalesModule;

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


const CostAnalysisModule = ({ opportunities }: { opportunities: Opportunity[] }) => {
  const approvedOpportunities = opportunities.filter(o => o.bomStatus === 'APPROVED');
  
  // Combine projects and approved opportunities for the dropdown
  const analysisTargets = [
    ...MOCK_PROJECTS.map(p => ({ id: p.id, name: p.name, type: 'PROJECT' as const, original: p })),
    ...approvedOpportunities.map(o => ({ id: o.id, name: `[Fırsat] ${o.title}`, type: 'OPPORTUNITY' as const, original: o }))
  ];

  const [selectedTargetId, setSelectedTargetId] = useState(analysisTargets[0]?.id || '');
  const [view, setView] = useState<'SUMMARY' | 'PRESALES' | 'SALES'>('SUMMARY');
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [newProduct, setNewProduct] = useState({
    partNumber: '',
    description: '',
    quantity: 1,
    purchaseCost: 0,
    marginPercentage: 15
  });
  const [newCostDescription, setNewCostDescription] = useState('');

  const selectedTarget = analysisTargets.find(t => t.id === selectedTargetId) || analysisTargets[0];

  const projectBoM = selectedTarget?.type === 'PROJECT' 
    ? MOCK_BOM_ITEMS.filter(item => item.projectId === selectedTarget.id)
    : MOCK_BOM_ITEMS.filter(item => item.opportunityId === selectedTarget?.id);

  const projectCosts = selectedTarget?.type === 'PROJECT'
    ? MOCK_COST_REQUIREMENTS.filter(item => item.projectId === selectedTarget.id)
    : []; // Assuming opportunities don't have other costs yet, or we could filter by opportunityId if added

  const totalBoMCost = projectBoM.reduce((sum, item) => sum + (item.purchaseCost * item.quantity), 0);
  const totalOtherCost = projectCosts.reduce((sum, item) => sum + (item.estimatedCost || 0), 0);
  const totalProjectCost = totalBoMCost + totalOtherCost;
  const totalSaleValue = projectBoM.reduce((sum, item) => sum + item.totalSalePrice, 0);
  const grossProfit = totalSaleValue - totalProjectCost;
  const margin = totalSaleValue > 0 ? (grossProfit / totalSaleValue) * 100 : 0;

  const handleAddProduct = () => {
    console.log('Adding product:', newProduct);
    setShowNewProductModal(false);
    setNewProduct({ partNumber: '', description: '', quantity: 1, purchaseCost: 0, marginPercentage: 15 });
  };

  const handleAddCost = () => {
    if (!newCostDescription.trim()) return;
    console.log('Adding cost requirement:', newCostDescription);
    setNewCostDescription('');
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Maliyet Analizi</h3>
          <p className="text-slate-500">Projeler ve onaylanmış fırsatlar için karlılık ve maliyet dağılımı.</p>
        </div>
        <div className="flex gap-3">
          <select 
            className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
            value={selectedTargetId}
            onChange={(e) => setSelectedTargetId(e.target.value)}
          >
            <optgroup label="Projeler">
              {analysisTargets.filter(t => t.type === 'PROJECT').map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </optgroup>
            {analysisTargets.filter(t => t.type === 'OPPORTUNITY').length > 0 && (
              <optgroup label="Onaylı Fırsatlar">
                {analysisTargets.filter(t => t.type === 'OPPORTUNITY').map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </optgroup>
            )}
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
                <div className="glass-card p-6 rounded-3xl shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Toplam Maliyet</p>
                  <h4 className="text-2xl font-bold text-slate-900">${totalProjectCost.toLocaleString()}</h4>
                  <div className="mt-2 flex items-center gap-2 text-[10px]">
                    <span className="text-blue-600 font-bold">BoM: ${totalBoMCost.toLocaleString()}</span>
                    <span className="text-slate-300">|</span>
                    <span className="text-amber-600 font-bold">Diğer: ${totalOtherCost.toLocaleString()}</span>
                  </div>
                </div>

                <div className="glass-card p-6 rounded-3xl shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Satış Bedeli</p>
                  <h4 className="text-2xl font-bold text-slate-900">${totalSaleValue.toLocaleString()}</h4>
                </div>

                <div className="glass-card p-6 rounded-3xl shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Brüt Kar</p>
                  <h4 className={cn("text-2xl font-bold", grossProfit >= 0 ? "text-emerald-600" : "text-red-600")}>
                    ${grossProfit.toLocaleString()}
                  </h4>
                </div>

                <div className="glass-card p-6 rounded-3xl shadow-sm">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-1">Proje Marjı</p>
                  <h4 className={cn("text-2xl font-bold", margin >= 15 ? "text-emerald-600" : margin >= 10 ? "text-amber-600" : "text-red-600")}>
                    %{margin.toFixed(1)}
                  </h4>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="glass-panel rounded-3xl p-8">
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

                <div className="glass-panel rounded-3xl p-8">
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
              <div className="glass-panel rounded-3xl flex flex-col overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <ShoppingCart size={20} className="text-indigo-600" />
                    BoM & Fiyatlandırma
                  </h4>
                  <button 
                    onClick={() => setShowNewProductModal(true)}
                    className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1"
                  >
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
              <div className="glass-panel rounded-3xl flex flex-col overflow-hidden">
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
                        value={newCostDescription}
                        onChange={(e) => setNewCostDescription(e.target.value)}
                      />
                      <button 
                        onClick={handleAddCost}
                        disabled={!newCostDescription.trim()}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md disabled:opacity-50"
                      >
                        Ekle
                      </button>
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
            <div className="glass-panel rounded-3xl overflow-hidden">
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

      {/* New Product Modal */}
      <AnimatePresence>
        {showNewProductModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-panel w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h4 className="text-xl font-bold text-slate-900">Yeni Ürün Ekle</h4>
                <button onClick={() => setShowNewProductModal(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Parça No</label>
                    <input 
                      type="text" 
                      placeholder="Örn: R750-1"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                      onChange={(e) => setNewProduct({...newProduct, partNumber: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Adet</label>
                    <input 
                      type="number" 
                      min="1"
                      defaultValue={1}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                      onChange={(e) => setNewProduct({...newProduct, quantity: Number(e.target.value)})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Açıklama</label>
                  <textarea 
                    rows={2}
                    placeholder="Ürün açıklaması..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500 resize-none"
                    onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Birim Maliyet ($)</label>
                    <input 
                      type="number" 
                      min="0"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                      onChange={(e) => setNewProduct({...newProduct, purchaseCost: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase">Hedef Marj (%)</label>
                    <input 
                      type="number" 
                      min="0" max="100"
                      defaultValue={15}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500"
                      onChange={(e) => setNewProduct({...newProduct, marginPercentage: Number(e.target.value)})}
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button 
                  onClick={() => setShowNewProductModal(false)}
                  className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-700"
                >
                  İptal
                </button>
                <button 
                  onClick={handleAddProduct}
                  className="px-8 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
                >
                  Ürünü Ekle
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CostAnalysisModule;

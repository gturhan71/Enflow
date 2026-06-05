import React, { useState, useMemo } from 'react';
import { 
  Calculator,
  Plus,
  Trash2,
  Save,
  Loader2,
  TrendingUp,
  DollarSign,
  Briefcase,
  AlertCircle,
  Package,
  Truck,
  Wrench,
  Plane,
  ChevronRight,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Opportunity, BoMItem, CostItem } from '../types';
import { apiService } from '../services/apiService';

const CostAnalysisModule = ({ 
  opportunities, 
  setOpportunities 
}: { 
  opportunities: Opportunity[],
  setOpportunities: React.Dispatch<React.SetStateAction<Opportunity[]>>
}) => {
  const [selectedOppId, setSelectedOppId] = useState('');
  const [costItems, setCostItems] = useState<Partial<CostItem>[]>([]);
  const [localBomItems, setLocalBomItems] = useState<BoMItem[]>([]);
  const [loading, setLoading] = useState(false);

  const selectedOpp = useMemo(() => 
    opportunities.find(o => o.id === selectedOppId),
  [opportunities, selectedOppId]);

  // Sync cost and bom items when opportunity changes
  React.useEffect(() => {
    if (selectedOpp) {
      setCostItems(selectedOpp.costItems || []);
      setLocalBomItems(selectedOpp.bomItems || []);
    } else {
      setCostItems([]);
      setLocalBomItems([]);
    }
  }, [selectedOpp]);

  const totalBoMCost = useMemo(() => 
    localBomItems.reduce((sum, item) => sum + (item.purchaseCost * item.quantity), 0),
  [localBomItems]);

  const totalOtherCost = useMemo(() => 
    costItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
  [costItems]);

  const grandTotalCost = totalBoMCost + totalOtherCost;
  const saleValue = selectedOpp?.value || 0;
  const grossProfit = saleValue - grandTotalCost;
  const margin = saleValue > 0 ? (grossProfit / saleValue) * 100 : 0;

  const handleAddCostItem = () => {
    setCostItems([...costItems, { description: '', category: 'OTHER', amount: 0 }]);
  };

  const handleRemoveCostItem = (index: number) => {
    setCostItems(costItems.filter((_, i) => i !== index));
  };

  const handleUpdateCostItem = (index: number, field: keyof CostItem, value: any) => {
    const updated = [...costItems];
    updated[index] = { ...updated[index], [field]: value };
    setCostItems(updated);
  };

  const handleUpdateBomItem = (index: number, field: keyof BoMItem, value: any) => {
    const updated = [...localBomItems];
    updated[index] = { ...updated[index], [field]: value };
    setLocalBomItems(updated);
  };

  const handleSaveCosts = async () => {
    if (!selectedOppId) return;
    setLoading(true);
    try {
      // Save both Cost Items and updated BoM Items
      await Promise.all([
        apiService.saveCostItems(selectedOppId, costItems as any),
        apiService.saveBoMItems(selectedOppId, localBomItems.map(item => ({
          pn: item.partNumber,
          desc: item.description,
          qty: item.quantity,
          cost: item.purchaseCost,
          margin: item.marginPercentage,
          vendor: item.vendor
        })))
      ]);

      // Update status to APPROVED to trigger "Ready for Proposal"
      const updatedOpp = await apiService.updateOpportunity(selectedOppId, {
        technicalStatus: 'APPROVED'
      });

      // UPDATE GLOBAL STATE to prevent stale data when switching
      setOpportunities(prev => prev.map(o => 
        o.id === selectedOppId 
          ? { ...o, ...updatedOpp, costItems: costItems as any, bomItems: localBomItems } 
          : o
      ));

      alert('Analiz başarıyla kaydedildi ve teklif aşamasına aktarıldı.');
    } catch (err: any) {
      alert(err.message || 'Kaydedilemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 font-sans bg-slate-50/30 custom-scrollbar">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Maliyet Analizi</h3>
          <p className="text-slate-500 font-medium text-sm mt-2">Fırsat bazlı toplam maliyet, BoM ve operasyonel gider hesaplaması.</p>
        </div>
        <div className="flex items-center gap-4">
          <select 
            value={selectedOppId}
            onChange={(e) => setSelectedOppId(e.target.value)}
            className="bg-white/40 border border-white/40 backdrop-blur-md px-6 py-3.5 rounded-[20px] text-sm font-bold shadow-sm focus:ring-4 focus:ring-primary/5 outline-none min-w-[300px] transition-all"
          >
            <option value="">Analiz Edilecek Fırsatı Seçin</option>
            {opportunities.map(opp => (
              <option key={opp.id} value={opp.id}>{opp.title}</option>
            ))}
          </select>
        </div>
      </div>

      {!selectedOppId ? (
        <div className="glass-panel p-20 rounded-[40px] border-dashed flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mb-6">
            <Calculator size={40} />
          </div>
          <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">İşlem Yapılacak Fırsatı Seçin</h4>
          <p className="text-sm text-slate-400 font-bold max-w-sm mt-2">Maliyet analizini başlatmak için yukarıdaki listeden bir satış fırsatı seçerek devam edin.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-8">
            <div className="glass-panel rounded-[32px] overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/10 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Package size={20} />
                  </div>
                  <h4 className="font-black text-slate-900 uppercase italic tracking-widest text-sm">Ürün & Lisans Maliyetleri (BoM)</h4>
                </div>
                <div className="px-4 py-1.5 bg-indigo-500/10 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/20">
                  {localBomItems.length} Kalem
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50">
                      <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">P/N</th>
                      <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Açıklama</th>
                      <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-center border-b border-slate-100">Adet</th>
                      <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-right border-b border-slate-100">Birim ($)</th>
                      <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-right border-b border-slate-100">Toplam ($)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 bg-white/40">
                    {localBomItems.map((item, i) => (
                      <tr key={i} className="hover:bg-white/60 transition-colors group">
                        <td className="px-6 py-4 font-mono font-bold text-indigo-600">{item.partNumber}</td>
                        <td className="px-6 py-4 font-medium text-slate-600 truncate max-w-[200px]">{item.description}</td>
                        <td className="px-6 py-4 text-center">
                          <input 
                            type="number" 
                            value={item.quantity}
                            onChange={(e) => handleUpdateBomItem(i, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-16 bg-white/60 border border-slate-200 rounded-lg py-1 px-2 text-center font-bold text-slate-900 outline-none focus:border-indigo-500 transition-all"
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <input 
                            type="number" 
                            value={item.purchaseCost}
                            onChange={(e) => handleUpdateBomItem(i, 'purchaseCost', parseFloat(e.target.value) || 0)}
                            className="w-24 bg-white/60 border border-slate-200 rounded-lg py-1 px-2 text-right font-bold text-slate-900 outline-none focus:border-indigo-500 transition-all"
                          />
                        </td>
                        <td className="px-6 py-4 text-right font-black text-slate-900">{(item.purchaseCost * item.quantity).toLocaleString()}</td>
                      </tr>
                    ))}
                    {localBomItems.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-bold italic">Bu fırsata bağlı BoM kalemi bulunamadı.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="glass-panel rounded-[32px] overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center">
                    <Truck size={20} />
                  </div>
                  <h4 className="font-black text-slate-900 uppercase italic tracking-widest text-sm">Operasyonel & Ek Giderler</h4>
                </div>
                <button 
                  onClick={handleAddCostItem}
                  className="bg-amber-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all flex items-center gap-2"
                >
                  <Plus size={14} /> Gider Ekle
                </button>
              </div>
              <div className="p-6 space-y-4">
                <AnimatePresence mode="popLayout">
                  {costItems.map((item, i) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      key={i} 
                      className="flex items-center gap-4 bg-white/40 p-4 rounded-2xl border border-white/60 group"
                    >
                      <select 
                        value={item.category}
                        onChange={(e) => handleUpdateCostItem(i, 'category', e.target.value)}
                        className="bg-white px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-amber-500"
                      >
                        <option value="LABOR">İşçilik</option>
                        <option value="LOGISTICS">Lojistik</option>
                        <option value="TRAVEL">Seyahat</option>
                        <option value="OTHER">Diğer</option>
                      </select>
                      <input 
                        type="text" 
                        value={item.description}
                        onChange={(e) => handleUpdateCostItem(i, 'description', e.target.value)}
                        placeholder="Gider açıklaması..."
                        className="flex-1 bg-white px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-amber-500"
                      />
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input 
                          type="number" 
                          value={item.amount}
                          onChange={(e) => handleUpdateCostItem(i, 'amount', e.target.value)}
                          className="w-32 bg-white pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-sm font-black text-right outline-none focus:border-amber-500"
                        />
                      </div>
                      <button 
                        onClick={() => handleRemoveCostItem(i)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {costItems.length === 0 && (
                  <div className="py-8 text-center text-slate-400 font-bold italic border-2 border-dashed border-slate-100 rounded-2xl">
                    Henüz ek maliyet girilmedi.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-panel p-8 rounded-[40px] sticky top-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                  <TrendingUp size={24} />
                </div>
                <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Finansal Özet</h4>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-center p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">BoM Toplam</span>
                  <span className="text-lg font-black text-slate-900">${totalBoMCost.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Diğer Giderler</span>
                  <span className="text-lg font-black text-slate-900">${totalOtherCost.toLocaleString()}</span>
                </div>
                <div className="h-px bg-slate-200/50 my-2" />
                <div className="flex justify-between items-center p-6 bg-slate-900 rounded-[28px] text-white shadow-xl">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOPLAM MALİYET</span>
                    <p className="text-2xl font-black tracking-tighter italic">${grandTotalCost.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SATIŞ BEDELİ</span>
                    <p className="text-2xl font-black tracking-tighter italic">${saleValue.toLocaleString()}</p>
                  </div>
                </div>

                <div className={cn(
                  "p-8 rounded-[32px] flex flex-col items-center justify-center gap-2 border-2",
                  margin >= 15 ? "bg-emerald-500/5 border-emerald-500/20" : margin >= 10 ? "bg-amber-500/5 border-amber-500/20" : "bg-red-500/5 border-red-500/20"
                )}>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">PROJE MARJI</span>
                  <div className="flex items-baseline gap-1">
                    <span className={cn("text-5xl font-black italic tracking-tighter leading-none", margin >= 15 ? "text-emerald-600" : margin >= 10 ? "text-amber-600" : "text-red-600")}>
                      %{margin.toFixed(1)}
                    </span>
                  </div>
                  <p className={cn("text-xs font-bold mt-2", grossProfit >= 0 ? "text-emerald-600" : "text-red-600")}>
                    {grossProfit >= 0 ? `+ $${grossProfit.toLocaleString()} Net Kar` : `- $${Math.abs(grossProfit).toLocaleString()} Zarar`}
                  </p>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <button 
                  onClick={handleSaveCosts}
                  disabled={loading}
                  className="w-full bg-primary text-white py-4 rounded-2xl text-xs font-black shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] active:scale-95"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                  Analizi Kaydet
                </button>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
                  <AlertCircle size={16} className="text-slate-400 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Bu analiz, teknik ve operasyonel verilerin birleşimidir. Kaydedilen maliyetler teklif onay sürecini etkileyebilir.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostAnalysisModule;

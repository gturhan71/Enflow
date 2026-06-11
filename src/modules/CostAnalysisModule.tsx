import React, { useState, useMemo } from 'react';
import {
  Calculator,
  Plus,
  Trash2,
  Save,
  Loader2,
  TrendingUp,
  DollarSign,
  Package,
  Truck,
  AlertCircle,
  Globe,
  Percent,
  ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '../lib/utils';
import { Opportunity, BoMItem, CostItem, CostConfig } from '../types';
import { apiService } from '../services/apiService';

// ── Currency helpers ─────────────────────────────────────────────────────────

const CURRENCIES = ['USD', 'EUR', 'TRY'] as const;
type Currency = typeof CURRENCIES[number];

const CURRENCY_SYMBOLS: Record<Currency, string> = { USD: '$', EUR: '€', TRY: '₺' };

const DEFAULT_RATES: Record<Currency, Record<string, number>> = {
  USD: { TRY: 0.031, EUR: 1.08 },
  EUR: { TRY: 0.029, USD: 0.93 },
  TRY: { USD: 32.50, EUR: 35.00 },
};

// ── Component ────────────────────────────────────────────────────────────────

const CostAnalysisModule = ({
  opportunities,
  setOpportunities,
  setActiveTab,
  tenantId,
}: {
  opportunities: Opportunity[];
  setOpportunities: React.Dispatch<React.SetStateAction<Opportunity[]>>;
  setActiveTab?: (tab: string) => void;
  tenantId?: string;
}) => {
  const queryClient = useQueryClient();

  // ── Fırsat seçimi ─────────────────────────────────────────────────────────
  const [selectedOppId, setSelectedOppId] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Maliyet verileri ──────────────────────────────────────────────────────
  const [costItems, setCostItems] = useState<Partial<CostItem>[]>([]);
  const [localBomItems, setLocalBomItems] = useState<BoMItem[]>([]);

  // ── Döviz & Kur ───────────────────────────────────────────────────────────
  const [baseCurrency, setBaseCurrency] = useState<Currency>('USD');
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(DEFAULT_RATES.USD);

  // ── Kar marjı ─────────────────────────────────────────────────────────────
  const [marginMode, setMarginMode] = useState<'PER_ITEM' | 'PROJECT_WIDE'>('PER_ITEM');
  const [globalMargin, setGlobalMargin] = useState(15);

  // ── Seçili fırsat ─────────────────────────────────────────────────────────
  const selectedOpp = useMemo(
    () => opportunities.find(o => o.id === selectedOppId),
    [opportunities, selectedOppId],
  );

  // Fırsat değişince verileri senkronize et
  React.useEffect(() => {
    if (selectedOpp) {
      setCostItems(selectedOpp.costItems || []);
      setLocalBomItems(selectedOpp.bomItems || []);
      if (selectedOpp.costConfig) {
        setBaseCurrency((selectedOpp.costConfig.baseCurrency as Currency) || 'USD');
        setExchangeRates(selectedOpp.costConfig.rates || DEFAULT_RATES.USD);
        setMarginMode(selectedOpp.costConfig.marginMode || 'PER_ITEM');
        setGlobalMargin(selectedOpp.costConfig.globalMargin ?? 15);
      }
    } else {
      setCostItems([]);
      setLocalBomItems([]);
    }
  }, [selectedOpp]);

  // ── Döviz bazında tutar dönüştürme ────────────────────────────────────────
  const toBase = (amount: number, currency?: string): number => {
    if (!currency || currency === baseCurrency) return amount;
    return amount * (exchangeRates[currency] ?? 1);
  };

  const sym = CURRENCY_SYMBOLS[baseCurrency] || baseCurrency;
  const fmt = (n: number) => `${sym}${Math.round(n).toLocaleString('tr-TR')}`;

  // ── Hesaplamalar ──────────────────────────────────────────────────────────
  const totalBoMCost = useMemo(() =>
    localBomItems.reduce((s, i) => {
      const rate = i.currency && i.currency !== baseCurrency ? (exchangeRates[i.currency] ?? 1) : 1;
      return s + i.purchaseCost * rate * i.quantity;
    }, 0),
  [localBomItems, baseCurrency, exchangeRates]);

  const totalBoMSale = useMemo(() => {
    if (marginMode !== 'PER_ITEM') return 0;
    return localBomItems.reduce((s, i) => {
      const rate = i.currency && i.currency !== baseCurrency ? (exchangeRates[i.currency] ?? 1) : 1;
      const costInBase = i.purchaseCost * rate;
      return s + costInBase * (1 + (i.marginPercentage || 0) / 100) * i.quantity;
    }, 0);
  }, [localBomItems, marginMode, baseCurrency, exchangeRates]);

  const totalOtherCost = useMemo(() =>
    costItems.reduce((s, i) => {
      const rate = i.currency && i.currency !== baseCurrency ? (exchangeRates[i.currency] ?? 1) : 1;
      return s + (Number(i.amount) || 0) * rate;
    }, 0),
  [costItems, baseCurrency, exchangeRates]);

  const grandCost = totalBoMCost + totalOtherCost;

  const grandSale = useMemo(() => {
    if (marginMode === 'PROJECT_WIDE') return grandCost * (1 + globalMargin / 100);
    return totalBoMSale + totalOtherCost;
  }, [marginMode, globalMargin, grandCost, totalBoMSale, totalOtherCost]);

  const profit = grandSale - grandCost;
  const marginPct = grandSale > 0 ? (profit / grandSale) * 100 : 0;

  // ── Handler: BoM ──────────────────────────────────────────────────────────
  const handleUpdateBomItem = (index: number, field: keyof BoMItem, value: unknown) => {
    const updated = [...localBomItems];
    updated[index] = { ...updated[index], [field]: value };
    setLocalBomItems(updated);
  };

  // ── Handler: Gider ────────────────────────────────────────────────────────
  const handleAddCostItem = () =>
    setCostItems([...costItems, { description: '', category: 'OTHER', amount: 0, currency: baseCurrency }]);

  const handleRemoveCostItem = (i: number) =>
    setCostItems(costItems.filter((_, idx) => idx !== i));

  const handleUpdateCostItem = (index: number, field: keyof CostItem, value: unknown) => {
    const updated = [...costItems];
    updated[index] = { ...updated[index], [field]: value };
    setCostItems(updated);
  };

  // ── Handler: Döviz değişince kur sıfırla ─────────────────────────────────
  const handleBaseCurrencyChange = (currency: Currency) => {
    setBaseCurrency(currency);
    setExchangeRates(DEFAULT_RATES[currency] || {});
  };

  // ── Kaydet ───────────────────────────────────────────────────────────────
  const handleSaveCosts = async () => {
    if (!selectedOppId) return;
    setLoading(true);
    try {
      const costConfig: CostConfig = {
        baseCurrency,
        rates: exchangeRates,
        marginMode,
        globalMargin,
      };

      // BoM kalemlerine hesaplanan fiyatları ekle
      const bomWithPrices: BoMItem[] = localBomItems.map(item => {
        const rate = item.currency && item.currency !== baseCurrency ? (exchangeRates[item.currency] ?? 1) : 1;
        const costInBase = item.purchaseCost * rate;
        const unitSalePrice = marginMode === 'PER_ITEM'
          ? costInBase * (1 + (item.marginPercentage || 0) / 100)
          : costInBase;
        return {
          ...item,
          unitSalePrice: Math.round(unitSalePrice * 100) / 100,
          totalSalePrice: Math.round(unitSalePrice * item.quantity * 100) / 100,
        };
      });

      await Promise.allSettled([
        apiService.saveCostItems(selectedOppId, costItems as CostItem[]),
        apiService.saveBoMItems(selectedOppId, bomWithPrices),
        apiService.updateOpportunity(selectedOppId, { technicalStatus: 'APPROVED' }),
      ]);

      const updatedOpp = (prev: Opportunity): Opportunity => ({
        ...prev,
        technicalStatus: 'APPROVED',
        costItems: costItems as CostItem[],
        bomItems: bomWithPrices,
        costConfig,
      });

      queryClient.setQueryData(
        ['opportunities', tenantId ?? ''],
        (old: Opportunity[] | undefined) =>
          old ? old.map(o => (o.id === selectedOppId ? updatedOpp(o) : o)) : old,
      );
      setOpportunities(prev => prev.map(o => (o.id === selectedOppId ? updatedOpp(o) : o)));

      alert('Analiz başarıyla kaydedildi.');
      if (setActiveTab) setTimeout(() => setActiveTab('crm-proposals'), 600);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 font-sans bg-slate-50/30 custom-scrollbar">

      {/* Başlık + fırsat seçici */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Maliyet Analizi</h3>
          <p className="text-slate-500 font-medium text-sm mt-2">Fırsat bazlı maliyet, döviz kurları ve kar marjı hesaplaması.</p>
        </div>
        <select
          value={selectedOppId}
          onChange={(e) => setSelectedOppId(e.target.value)}
          className="bg-white/40 border border-white/40 backdrop-blur-md px-6 py-3.5 rounded-[20px] text-sm font-bold shadow-sm focus:ring-4 focus:ring-primary/5 outline-none min-w-[300px]"
        >
          <option value="">Analiz Edilecek Fırsatı Seçin</option>
          {opportunities.map(opp => (
            <option key={opp.id} value={opp.id}>{opp.title}</option>
          ))}
        </select>
      </div>

      {!selectedOppId ? (
        <div className="glass-panel p-20 rounded-[40px] border-dashed flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mb-6">
            <Calculator size={40} />
          </div>
          <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">İşlem Yapılacak Fırsatı Seçin</h4>
          <p className="text-sm text-slate-400 font-bold max-w-sm mt-2">Maliyet analizini başlatmak için yukarıdaki listeden bir satış fırsatı seçin.</p>
        </div>
      ) : (
        <>
          {/* ── Döviz & Kur Ayarları ──────────────────────────────────────── */}
          <div className="glass-panel rounded-[32px] overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <div className="w-9 h-9 bg-blue-500/10 text-blue-600 rounded-xl flex items-center justify-center">
                <Globe size={18} />
              </div>
              <h4 className="font-black text-slate-900 uppercase italic tracking-widest text-sm">Döviz & Kur Ayarları</h4>
            </div>
            <div className="p-6 flex flex-wrap items-end gap-8">
              {/* Teklif dövizi */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Teklif Dövizi</label>
                <div className="flex gap-2">
                  {CURRENCIES.map(c => (
                    <button
                      key={c}
                      onClick={() => handleBaseCurrencyChange(c)}
                      className={cn(
                        'px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest border transition-all',
                        baseCurrency === c
                          ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                          : 'bg-white text-slate-500 border-slate-200 hover:border-primary/40',
                      )}
                    >
                      {CURRENCY_SYMBOLS[c]} {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Döviz kurları */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Uygulanan Kurlar (1 {'{'}döviz{'}'} = ? {baseCurrency})
                </label>
                <div className="flex flex-wrap gap-4">
                  {CURRENCIES.filter(c => c !== baseCurrency).map(fc => (
                    <div key={fc} className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-4 py-2.5">
                      <span className="text-xs font-black text-slate-500 whitespace-nowrap">1 {fc} =</span>
                      <input
                        type="number"
                        step="0.0001"
                        value={exchangeRates[fc] ?? ''}
                        onChange={(e) =>
                          setExchangeRates(prev => ({ ...prev, [fc]: parseFloat(e.target.value) || 0 }))
                        }
                        className="w-24 text-sm font-black text-slate-900 outline-none text-right"
                      />
                      <span className="text-xs font-black text-primary">{baseCurrency}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Ana Grid ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">

            {/* Sol: BoM + Giderler */}
            <div className="xl:col-span-2 space-y-8">

              {/* BoM Tablosu */}
              <div className="glass-panel rounded-[32px] overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/10 text-indigo-600 rounded-xl flex items-center justify-center">
                      <Package size={20} />
                    </div>
                    <h4 className="font-black text-slate-900 uppercase italic tracking-widest text-sm">Ürün & Lisans Maliyetleri (BoM)</h4>
                  </div>
                  <span className="px-4 py-1.5 bg-indigo-500/10 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/20">
                    {localBomItems.length} Kalem
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">P/N</th>
                        <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Açıklama</th>
                        <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest text-center border-b border-slate-100 w-16">Adet</th>
                        <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 w-20">Döviz</th>
                        <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest text-right border-b border-slate-100">Birim Maliyet</th>
                        {marginMode === 'PER_ITEM' && (
                          <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest text-center border-b border-slate-100 w-20">Marj %</th>
                        )}
                        {marginMode === 'PER_ITEM' && (
                          <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest text-right border-b border-slate-100 whitespace-nowrap">
                            Birim Satış ({baseCurrency})
                          </th>
                        )}
                        <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest text-right border-b border-slate-100 whitespace-nowrap">
                          Toplam ({baseCurrency})
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-white/40">
                      {localBomItems.map((item, i) => {
                        const rate = item.currency && item.currency !== baseCurrency
                          ? (exchangeRates[item.currency] ?? 1) : 1;
                        const costInBase = item.purchaseCost * rate;
                        const unitSale = costInBase * (1 + (item.marginPercentage || 0) / 100);
                        const rowTotal = marginMode === 'PER_ITEM'
                          ? unitSale * item.quantity
                          : costInBase * item.quantity;
                        return (
                          <tr key={i} className="hover:bg-white/60 transition-colors">
                            <td className="px-4 py-3 font-mono font-bold text-indigo-600 whitespace-nowrap">{item.partNumber}</td>
                            <td className="px-4 py-3 font-medium text-slate-600 max-w-[160px] truncate">{item.description}</td>
                            <td className="px-4 py-3 text-center">
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) => handleUpdateBomItem(i, 'quantity', parseInt(e.target.value) || 0)}
                                className="w-14 bg-white/60 border border-slate-200 rounded-lg py-1 px-2 text-center font-bold text-slate-900 outline-none focus:border-indigo-500"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={item.currency || baseCurrency}
                                onChange={(e) => handleUpdateBomItem(i, 'currency', e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg py-1 px-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
                              >
                                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-col items-end gap-0.5">
                                <input
                                  type="number"
                                  value={item.purchaseCost}
                                  onChange={(e) => handleUpdateBomItem(i, 'purchaseCost', parseFloat(e.target.value) || 0)}
                                  className="w-28 bg-white/60 border border-slate-200 rounded-lg py-1 px-2 text-right font-bold text-slate-900 outline-none focus:border-indigo-500"
                                />
                                {item.currency && item.currency !== baseCurrency && (
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    ≈ {sym}{costInBase.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                                  </span>
                                )}
                              </div>
                            </td>
                            {marginMode === 'PER_ITEM' && (
                              <td className="px-4 py-3 text-center">
                                <div className="relative">
                                  <input
                                    type="number"
                                    value={item.marginPercentage || 0}
                                    onChange={(e) => handleUpdateBomItem(i, 'marginPercentage', parseFloat(e.target.value) || 0)}
                                    className="w-16 bg-white/60 border border-slate-200 rounded-lg py-1 px-2 text-center font-bold text-emerald-700 outline-none focus:border-emerald-500"
                                  />
                                </div>
                              </td>
                            )}
                            {marginMode === 'PER_ITEM' && (
                              <td className="px-4 py-3 text-right font-bold text-slate-700 whitespace-nowrap">
                                {sym}{unitSale.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}
                              </td>
                            )}
                            <td className="px-4 py-3 text-right font-black text-slate-900 whitespace-nowrap">
                              {sym}{rowTotal.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        );
                      })}
                      {localBomItems.length === 0 && (
                        <tr>
                          <td colSpan={marginMode === 'PER_ITEM' ? 8 : 6} className="px-6 py-12 text-center text-slate-400 font-bold italic">
                            Bu fırsata bağlı BoM kalemi bulunamadı.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Operasyonel Giderler */}
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
                    {costItems.map((item, i) => {
                      const rate = item.currency && item.currency !== baseCurrency
                        ? (exchangeRates[item.currency] ?? 1) : 1;
                      const amountInBase = (Number(item.amount) || 0) * rate;
                      return (
                        <motion.div
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          key={i}
                          className="flex items-center gap-3 bg-white/40 p-4 rounded-2xl border border-white/60 flex-wrap"
                        >
                          <select
                            value={item.category}
                            onChange={(e) => handleUpdateCostItem(i, 'category', e.target.value)}
                            className="bg-white px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-amber-500"
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
                            className="flex-1 min-w-[140px] bg-white px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-amber-500"
                          />
                          {/* Döviz seçici */}
                          <select
                            value={item.currency || baseCurrency}
                            onChange={(e) => handleUpdateCostItem(i, 'currency', e.target.value)}
                            className="bg-white px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-amber-500 w-20"
                          >
                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          {/* Tutar */}
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                            <input
                              type="number"
                              value={item.amount}
                              onChange={(e) => handleUpdateCostItem(i, 'amount', e.target.value)}
                              className="w-32 bg-white pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-sm font-black text-right outline-none focus:border-amber-500"
                            />
                          </div>
                          {/* Karşılığı base dövizinde */}
                          {item.currency && item.currency !== baseCurrency && (
                            <span className="text-xs text-slate-400 font-medium whitespace-nowrap">
                              ≈ {fmt(amountInBase)}
                            </span>
                          )}
                          <button
                            onClick={() => handleRemoveCostItem(i)}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  {costItems.length === 0 && (
                    <div className="py-8 text-center text-slate-400 font-bold italic border-2 border-dashed border-slate-100 rounded-2xl">
                      Henüz ek maliyet girilmedi.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sağ: Marj + Özet */}
            <div className="space-y-6">

              {/* Kar Marjı Yöntemi */}
              <div className="glass-panel p-6 rounded-[32px]">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center">
                    <Percent size={18} />
                  </div>
                  <h4 className="font-black text-slate-900 uppercase italic tracking-widest text-sm">Kar Marjı</h4>
                </div>

                {/* Mod seçimi */}
                <div className="flex rounded-2xl overflow-hidden border border-slate-200 mb-5">
                  <button
                    onClick={() => setMarginMode('PER_ITEM')}
                    className={cn(
                      'flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all',
                      marginMode === 'PER_ITEM'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-400 hover:bg-slate-50',
                    )}
                  >
                    Kalem Bazında
                  </button>
                  <button
                    onClick={() => setMarginMode('PROJECT_WIDE')}
                    className={cn(
                      'flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest border-l border-slate-200 transition-all',
                      marginMode === 'PROJECT_WIDE'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white text-slate-400 hover:bg-slate-50',
                    )}
                  >
                    Proje Geneli
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {marginMode === 'PER_ITEM' ? (
                    <motion.p
                      key="per"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-xs text-slate-500 font-medium bg-slate-50 p-4 rounded-2xl border border-slate-100"
                    >
                      Her BoM kalemi için tablodaki <strong>Marj %</strong> sütunundan ayrı ayrı kar marjı girin.
                      Operasyonel giderler marj hesabına dahil edilmez.
                    </motion.p>
                  ) : (
                    <motion.div
                      key="wide"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-3"
                    >
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Genel Proje Marjı (%)
                      </label>
                      <div className="relative">
                        <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
                        <input
                          type="number"
                          value={globalMargin}
                          min={0}
                          max={100}
                          onChange={(e) => setGlobalMargin(parseFloat(e.target.value) || 0)}
                          className="w-full bg-white border-2 border-emerald-200 rounded-2xl py-3 pl-10 pr-4 text-2xl font-black text-emerald-700 outline-none focus:border-emerald-500 transition-all"
                        />
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Toplam maliyet üzerine tek bir marj uygulanır: <br />
                        <span className="font-black text-slate-600">
                          {fmt(grandCost)} × {(1 + globalMargin / 100).toFixed(2)} = {fmt(grandSale)}
                        </span>
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Finansal Özet */}
              <div className="glass-panel p-8 rounded-[40px] sticky top-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Finansal Özet</h4>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Teklif Dövizi: {baseCurrency}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">BoM Maliyeti</span>
                    <span className="text-base font-black text-slate-900">{fmt(totalBoMCost)}</span>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Diğer Giderler</span>
                    <span className="text-base font-black text-slate-900">{fmt(totalOtherCost)}</span>
                  </div>

                  <div className="h-px bg-slate-200/50" />

                  <div className="p-5 bg-slate-900 rounded-[24px] text-white shadow-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Toplam Maliyet</span>
                      <span className="text-lg font-black tracking-tighter">{fmt(grandCost)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tahmini Satış</span>
                        {marginMode === 'PROJECT_WIDE' && (
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-black">
                            %{globalMargin} Marj
                          </span>
                        )}
                      </div>
                      <span className="text-lg font-black tracking-tighter text-emerald-400">{fmt(grandSale)}</span>
                    </div>
                  </div>

                  <div className={cn(
                    'p-6 rounded-[28px] flex flex-col items-center gap-2 border-2',
                    marginPct >= 15 ? 'bg-emerald-500/5 border-emerald-500/20'
                      : marginPct >= 10 ? 'bg-amber-500/5 border-amber-500/20'
                      : 'bg-red-500/5 border-red-500/20',
                  )}>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Proje Marjı</span>
                    <span className={cn(
                      'text-5xl font-black italic tracking-tighter leading-none',
                      marginPct >= 15 ? 'text-emerald-600' : marginPct >= 10 ? 'text-amber-600' : 'text-red-600',
                    )}>
                      %{marginPct.toFixed(1)}
                    </span>
                    <p className={cn('text-xs font-bold mt-1', profit >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                      {profit >= 0
                        ? `+ ${fmt(profit)} Net Kar`
                        : `- ${fmt(Math.abs(profit))} Zarar`}
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <button
                    onClick={handleSaveCosts}
                    disabled={loading}
                    className="w-full bg-primary text-white py-4 rounded-2xl text-xs font-black shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] active:scale-95 disabled:opacity-60"
                  >
                    {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                    Analizi Kaydet
                  </button>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
                    <AlertCircle size={15} className="text-slate-400 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-slate-500 leading-relaxed font-medium">
                      Kaydedilen analiz teklif dövizinde ({baseCurrency}) oluşturulur ve teklif onay sürecini başlatır.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CostAnalysisModule;

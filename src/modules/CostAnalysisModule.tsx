import React, { useState, useMemo } from 'react';
import {
  Calculator, Plus, Trash2, Save, Loader2, TrendingUp, DollarSign,
  Package, Truck, AlertCircle, Globe, Percent, Gavel, CalendarClock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Opportunity, BoMItem, CostItem, CostConfig } from '../types';
import { apiService } from '../services/apiService';
import { useAuth } from '../contexts/AuthContext';
import {
  ProcurementMethod, PROCUREMENT_METHODS, METHOD_COST_TEMPLATES, MethodCostLine,
  CostCategory, COST_CATEGORY_LABEL, computeForwardRates, monthsUntil,
} from '../lib/procurementCosts';

const CURRENCIES = ['USD', 'EUR', 'TRY'] as const;
type Currency = typeof CURRENCIES[number];
const CURRENCY_SYMBOLS: Record<Currency, string> = { USD: '$', EUR: '€', TRY: '₺' };

// Varsayılan SPOT kurlar (1 yabancı = ? base)
const DEFAULT_SPOT: Record<Currency, Record<string, number>> = {
  USD: { TRY: 0.031, EUR: 1.08 },
  EUR: { TRY: 0.029, USD: 0.93 },
  TRY: { USD: 32.50, EUR: 35.00 },
};

const OPERATIONAL_CATS: CostCategory[] = ['LABOR', 'LOGISTICS', 'TECHNICAL_SERVICE', 'TRAVEL', 'ACCOMMODATION', 'ACCEPTANCE', 'NOTARY', 'CUSTOMS', 'OTHER'];

const CostAnalysisModule = ({
  opportunities, setOpportunities, setActiveTab,
}: {
  opportunities: Opportunity[];
  setOpportunities: React.Dispatch<React.SetStateAction<Opportunity[]>>;
  setActiveTab?: (tab: string) => void;
  tenantId?: string;
}) => {
  const { currentUser } = useAuth();
  const canApprove = currentUser?.role === 'SALES_MGR' || currentUser?.role === 'GENERAL_MANAGER';
  const [selectedOppId, setSelectedOppId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [approveNote, setApproveNote] = useState('');
  const [decisionLoading, setDecisionLoading] = useState(false);

  const [costItems, setCostItems] = useState<Partial<CostItem>[]>([]);
  const [localBomItems, setLocalBomItems] = useState<BoMItem[]>([]);

  // Döviz & forward
  const [baseCurrency, setBaseCurrency] = useState<Currency>('TRY');
  const [spotRates, setSpotRates] = useState<Record<string, number>>(DEFAULT_SPOT.TRY);
  const [annualDepreciation, setAnnualDepreciation] = useState(30);
  const [collectionDate, setCollectionDate] = useState('');
  const [forwardOverrides, setForwardOverrides] = useState<Record<string, number>>({});

  // Marj + usul
  const [targetMargin, setTargetMargin] = useState(20);
  const [method, setMethod] = useState<ProcurementMethod>('PRIVATE');
  const [methodCosts, setMethodCosts] = useState<MethodCostLine[]>([]);

  const selectedOpp = useMemo(() => opportunities.find(o => o.id === selectedOppId), [opportunities, selectedOppId]);

  React.useEffect(() => {
    setSubmitted(false);
    if (!selectedOpp) { setCostItems([]); setLocalBomItems([]); setMethodCosts([]); return; }
    setLocalBomItems(selectedOpp.bomItems || []);
    const cc = selectedOpp.costConfig;
    // Manuel operasyonel giderler (auto olmayan)
    setCostItems((selectedOpp.costItems || []).filter(c => !c.auto));
    if (cc) {
      setBaseCurrency((cc.baseCurrency as Currency) || 'TRY');
      // Geriye uyum: spotRates yoksa legacy rates
      setSpotRates(cc.spotRates || cc.rates || DEFAULT_SPOT[(cc.baseCurrency as Currency) || 'TRY']);
      setAnnualDepreciation(cc.annualDepreciation ?? 0);
      setCollectionDate(cc.collectionDate || '');
      setForwardOverrides(cc.forwardOverrides || {});
      setTargetMargin(cc.targetMargin ?? cc.globalMargin ?? 20);
      const m = (cc.procurementMethod as ProcurementMethod) || 'PRIVATE';
      setMethod(m);
      setMethodCosts((cc.methodCostLines as MethodCostLine[]) || METHOD_COST_TEMPLATES[m].map(l => ({ ...l })));
    } else {
      setBaseCurrency('TRY'); setSpotRates(DEFAULT_SPOT.TRY); setAnnualDepreciation(30);
      setCollectionDate(''); setForwardOverrides({}); setTargetMargin(20);
      setMethod('PRIVATE'); setMethodCosts([]);
    }
  }, [selectedOpp]);

  // Forward kurlar (tahsilat tarihine göre)
  const forwardRates = useMemo(
    () => computeForwardRates(spotRates, annualDepreciation, collectionDate, forwardOverrides),
    [spotRates, annualDepreciation, collectionDate, forwardOverrides],
  );
  const months = monthsUntil(collectionDate);

  const toBase = (amount: number, currency?: string): number => {
    if (!currency || currency === baseCurrency) return amount;
    return amount * (forwardRates[currency] ?? 1);
  };
  const sym = CURRENCY_SYMBOLS[baseCurrency] || baseCurrency;
  const fmt = (n: number) => `${sym}${Math.round(n).toLocaleString('tr-TR')}`;
  const mFrac = Math.min(0.99, Math.max(0, targetMargin / 100));

  // ── Hesaplamalar (forward kur, satış-üzerinden marj, toplam taban) ──────────
  const bomCost = useMemo(() => localBomItems.reduce((s, i) => s + toBase(i.purchaseCost, i.currency) * i.quantity, 0),
    [localBomItems, forwardRates, baseCurrency]);
  const opsCost = useMemo(() => costItems.reduce((s, i) => s + toBase(Number(i.amount) || 0, i.currency), 0),
    [costItems, forwardRates, baseCurrency]);

  // Usul %-masraflarının tabanı: ön-teklif = (BoM+ops)/(1−m)
  const preOffer = mFrac < 1 ? (bomCost + opsCost) / (1 - mFrac) : (bomCost + opsCost);
  const methodLineAmount = (l: MethodCostLine) => l.kind === 'PERCENT' ? (l.value / 100) * preOffer : l.value;
  const methodCostTotal = useMemo(() => methodCosts.reduce((s, l) => s + methodLineAmount(l), 0), [methodCosts, preOffer]);

  const grandCost = bomCost + opsCost + methodCostTotal;
  const offer = mFrac < 1 ? grandCost / (1 - mFrac) : grandCost;
  const profit = offer - grandCost;
  const marginPct = offer > 0 ? (profit / offer) * 100 : 0;

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleMethodChange = (m: ProcurementMethod) => {
    setMethod(m);
    setMethodCosts(METHOD_COST_TEMPLATES[m].map(l => ({ ...l }))); // şablonu yeniden seed
  };
  const updateMethodLine = (i: number, value: number) =>
    setMethodCosts(prev => prev.map((l, idx) => idx === i ? { ...l, value } : l));
  const removeMethodLine = (i: number) => setMethodCosts(prev => prev.filter((_, idx) => idx !== i));

  const handleUpdateBomItem = (index: number, field: keyof BoMItem, value: unknown) =>
    setLocalBomItems(prev => prev.map((it, i) => i === index ? { ...it, [field]: value } : it));

  const handleAddCostItem = () => setCostItems([...costItems, { description: '', category: 'LOGISTICS', amount: 0, currency: baseCurrency }]);
  const handleRemoveCostItem = (i: number) => setCostItems(costItems.filter((_, idx) => idx !== i));
  const handleUpdateCostItem = (index: number, field: keyof CostItem, value: unknown) =>
    setCostItems(prev => prev.map((it, i) => i === index ? { ...it, [field]: value } : it));

  const handleBaseCurrencyChange = (c: Currency) => {
    setBaseCurrency(c); setSpotRates(DEFAULT_SPOT[c] || {}); setForwardOverrides({});
  };

  const handleSave = async () => {
    if (!selectedOppId) return;
    setLoading(true);
    try {
      const costConfig: CostConfig = {
        baseCurrency, spotRates, forwardOverrides, annualDepreciation, collectionDate,
        targetMargin, procurementMethod: method,
        methodCostLines: methodCosts.map(l => ({ label: l.label, kind: l.kind, value: l.value, category: l.category })),
      };
      // BoM kalemine satış fiyatı = forward maliyet / (1−m)
      const bomWithPrices: BoMItem[] = localBomItems.map(item => {
        const costInBase = toBase(item.purchaseCost, item.currency);
        const unitSale = mFrac < 1 ? costInBase / (1 - mFrac) : costInBase;
        return { ...item, unitSalePrice: Math.round(unitSale * 100) / 100, totalSalePrice: Math.round(unitSale * item.quantity * 100) / 100 };
      });
      // Operasyonel + usul masrafları → CostItem (usul masrafları auto:true, hesaplı tutar, base döviz)
      const methodAsCostItems: Partial<CostItem>[] = methodCosts.map(l => ({
        description: l.label + (l.kind === 'PERCENT' ? ` (%${l.value})` : ''),
        category: l.category, amount: Math.round(methodLineAmount(l) * 100) / 100,
        currency: baseCurrency, auto: true,
      }));
      const allCosts = [...costItems, ...methodAsCostItems];

      await Promise.allSettled([
        apiService.saveCostItems(selectedOppId, allCosts as CostItem[]),
        apiService.saveBoMItems(selectedOppId, bomWithPrices),
        apiService.updateOpportunity(selectedOppId, { costConfig }),
      ]);
      // Maliyet analizi → Satış Müdürü onayına gönder + satış temsilcisine bilgilendirme
      await apiService.submitCostApproval(selectedOppId);
      setOpportunities(prev => prev.map(o => o.id === selectedOppId
        ? { ...o, technicalStatus: 'PENDING_APPROVAL', costItems: allCosts as CostItem[], bomItems: bomWithPrices, costConfig } : o));
      setSubmitted(true);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (decision: 'APPROVE' | 'REJECT') => {
    if (!selectedOppId) return;
    setDecisionLoading(true);
    try {
      const newStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      await apiService.approveCost(selectedOppId, { decision, note: approveNote || undefined });
      setOpportunities(prev => prev.map(o => o.id === selectedOppId
        ? { ...o, technicalStatus: newStatus } : o));
      setSubmitted(false);
      setApproveNote('');
      if (decision === 'APPROVE' && setActiveTab) setTimeout(() => setActiveTab('crm-proposals'), 600);
    } finally {
      setDecisionLoading(false);
    }
  };

  const foreignCurrencies = CURRENCIES.filter(c => c !== baseCurrency);

  return (
    <div className="p-8 space-y-8 h-full overflow-y-auto pb-24 font-sans bg-slate-50/30 custom-scrollbar">
      <AnimatePresence>
        {saveSuccess && (
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
            className="fixed top-6 right-6 z-50 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-xl font-bold text-sm flex items-center gap-2">
            <Save size={14} /> Analiz kaydedildi ve Satış Müdürü onayına gönderildi.
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Maliyet Analizi</h3>
          <p className="text-slate-500 font-medium text-sm mt-2">Satınalma usulü, forward (tahsilat) kuru ve satış-üzerinden marj ile maliyet/teklif.</p>
        </div>
        <select value={selectedOppId} onChange={(e) => setSelectedOppId(e.target.value)}
          className="bg-white/40 border border-white/40 backdrop-blur-md px-6 py-3.5 rounded-[20px] text-sm font-bold shadow-sm focus:ring-4 focus:ring-primary/5 outline-none w-full sm:w-auto sm:min-w-[300px]">
          <option value="">Analiz Edilecek Fırsatı Seçin</option>
          {opportunities.map(opp => <option key={opp.id} value={opp.id}>{opp.title}</option>)}
        </select>
      </div>

      {!selectedOppId ? (
        <div className="glass-panel p-20 rounded-[40px] border-dashed flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mb-6"><Calculator size={40} /></div>
          <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">İşlem Yapılacak Fırsatı Seçin</h4>
          <p className="text-sm text-slate-400 font-bold max-w-sm mt-2">Maliyet analizini başlatmak için yukarıdan bir satış fırsatı seçin.</p>
        </div>
      ) : (
        <>
          {/* ── Satınalma Usulü ──────────────────────────────────────────── */}
          <div className="glass-panel rounded-[32px] overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <div className="w-9 h-9 bg-violet-500/10 text-violet-600 rounded-xl flex items-center justify-center"><Gavel size={18} /></div>
              <h4 className="font-black text-slate-900 uppercase italic tracking-widest text-sm">Satınalma / Teklif Usulü</h4>
            </div>
            <div className="p-6 flex flex-wrap gap-3">
              {PROCUREMENT_METHODS.map(m => (
                <button key={m.key} onClick={() => handleMethodChange(m.key)} title={m.hint}
                  className={cn('px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border transition-all text-left',
                    method === m.key ? 'bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-500/20' : 'bg-white text-slate-500 border-slate-200 hover:border-violet-400')}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Döviz, Forward Kur & Tahsilat ────────────────────────────── */}
          <div className="glass-panel rounded-[32px] overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <div className="w-9 h-9 bg-blue-500/10 text-blue-600 rounded-xl flex items-center justify-center"><Globe size={18} /></div>
              <h4 className="font-black text-slate-900 uppercase italic tracking-widest text-sm">Teklif Para Birimi & Forward Kur</h4>
            </div>
            <div className="p-6 flex flex-wrap items-end gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Teklif Dövizi</label>
                <div className="flex gap-2">
                  {CURRENCIES.map(c => (
                    <button key={c} onClick={() => handleBaseCurrencyChange(c)}
                      className={cn('px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-widest border transition-all',
                        baseCurrency === c ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-white text-slate-500 border-slate-200 hover:border-primary/40')}>
                      {CURRENCY_SYMBOLS[c]} {c}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><CalendarClock size={11} /> Tahsilat Tarihi</label>
                <input type="date" value={collectionDate} onChange={e => setCollectionDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-sm font-bold outline-none focus:border-primary" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Yıllık Değer-Kaybı %</label>
                <input type="number" value={annualDepreciation} min={0} max={300}
                  onChange={e => setAnnualDepreciation(parseFloat(e.target.value) || 0)}
                  className="w-24 bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-sm font-black text-amber-700 outline-none focus:border-amber-500" />
              </div>
            </div>
            {foreignCurrencies.length > 0 && (
              <div className="px-6 pb-6 flex flex-wrap gap-4">
                {foreignCurrencies.map(fc => (
                  <div key={fc} className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-500 whitespace-nowrap">1 {fc} = spot</span>
                      <input type="number" step="0.0001" value={spotRates[fc] ?? ''}
                        onChange={e => setSpotRates(prev => ({ ...prev, [fc]: parseFloat(e.target.value) || 0 }))}
                        className="w-20 text-sm font-black text-slate-900 outline-none text-right" />
                      <span className="text-xs font-black text-slate-400">{baseCurrency}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px]">
                      <span className="font-bold text-emerald-600">forward ({months.toFixed(1)} ay):</span>
                      <input type="number" step="0.0001" value={forwardOverrides[fc] ?? Math.round((forwardRates[fc] ?? 0) * 10000) / 10000}
                        onChange={e => setForwardOverrides(prev => ({ ...prev, [fc]: parseFloat(e.target.value) || 0 }))}
                        className="w-20 font-black text-emerald-700 outline-none text-right bg-emerald-50 rounded px-1" />
                      <span className="font-bold text-emerald-600">{baseCurrency}</span>
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-slate-400 font-medium self-center max-w-[220px]">
                  Forward = spot × (1 + yıllık%/100 × ay/12). Maliyetler tahsilat tarihindeki (forward) kurdan hesaplanır.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 space-y-8">
              {/* BoM */}
              <div className="glass-panel rounded-[32px] overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500/10 text-indigo-600 rounded-xl flex items-center justify-center"><Package size={20} /></div>
                    <h4 className="font-black text-slate-900 uppercase italic tracking-widest text-sm">Ürün & Lisans Maliyetleri (BoM)</h4>
                  </div>
                  <span className="px-4 py-1.5 bg-indigo-500/10 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/20">{localBomItems.length} Kalem</span>
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
                        <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest text-right border-b border-slate-100 whitespace-nowrap">Birim Satış ({baseCurrency})</th>
                        <th className="px-4 py-4 font-black text-slate-400 uppercase tracking-widest text-right border-b border-slate-100 whitespace-nowrap">Toplam Maliyet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-white/40">
                      {localBomItems.map((item, i) => {
                        const costInBase = toBase(item.purchaseCost, item.currency);
                        const unitSale = mFrac < 1 ? costInBase / (1 - mFrac) : costInBase;
                        return (
                          <tr key={i} className="hover:bg-white/60 transition-colors">
                            <td className="px-4 py-3 font-mono font-bold text-indigo-600 whitespace-nowrap">{item.partNumber}</td>
                            <td className="px-4 py-3 font-medium text-slate-600 max-w-[160px] truncate">{item.description}</td>
                            <td className="px-4 py-3 text-center">
                              <input type="number" value={item.quantity} onChange={e => handleUpdateBomItem(i, 'quantity', parseInt(e.target.value) || 0)}
                                className="w-14 bg-white/60 border border-slate-200 rounded-lg py-1 px-2 text-center font-bold text-slate-900 outline-none focus:border-indigo-500" />
                            </td>
                            <td className="px-4 py-3">
                              <select value={item.currency || baseCurrency} onChange={e => handleUpdateBomItem(i, 'currency', e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg py-1 px-2 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500">
                                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex flex-col items-end gap-0.5">
                                <input type="number" value={item.purchaseCost} onChange={e => handleUpdateBomItem(i, 'purchaseCost', parseFloat(e.target.value) || 0)}
                                  className="w-28 bg-white/60 border border-slate-200 rounded-lg py-1 px-2 text-right font-bold text-slate-900 outline-none focus:border-indigo-500" />
                                {item.currency && item.currency !== baseCurrency && (
                                  <span className="text-[10px] text-slate-400 font-medium">≈ {sym}{costInBase.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} (forward)</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-emerald-700 whitespace-nowrap">{sym}{unitSale.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</td>
                            <td className="px-4 py-3 text-right font-black text-slate-900 whitespace-nowrap">{sym}{(costInBase * item.quantity).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}</td>
                          </tr>
                        );
                      })}
                      {localBomItems.length === 0 && (
                        <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-bold italic">Bu fırsata bağlı BoM kalemi bulunamadı.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Usul Masrafları (otomatik) */}
              {methodCosts.length > 0 && (
                <div className="glass-panel rounded-[32px] overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                    <div className="w-10 h-10 bg-violet-500/10 text-violet-600 rounded-xl flex items-center justify-center"><Gavel size={20} /></div>
                    <h4 className="font-black text-slate-900 uppercase italic tracking-widest text-sm">Usul Masrafları (otomatik)</h4>
                    <span className="text-[10px] text-slate-400 font-bold normal-case tracking-normal">— seçilen usule göre; düzenlenebilir</span>
                  </div>
                  <div className="p-6 space-y-3">
                    {methodCosts.map((l, i) => (
                      <div key={i} className="flex items-center gap-3 bg-white/40 p-4 rounded-2xl border border-white/60 flex-wrap">
                        <span className="flex-1 min-w-[180px] text-sm font-bold text-slate-700">{l.label}</span>
                        <span className="text-[10px] font-black text-violet-600 bg-violet-50 px-2 py-0.5 rounded uppercase">{COST_CATEGORY_LABEL[l.category as CostCategory]}</span>
                        <div className="flex items-center gap-1.5">
                          <input type="number" step={l.kind === 'PERCENT' ? '0.01' : '1'} value={l.value}
                            onChange={e => updateMethodLine(i, parseFloat(e.target.value) || 0)}
                            className="w-24 bg-white border border-slate-200 rounded-xl py-1.5 px-2 text-right font-black text-slate-900 outline-none focus:border-violet-500" />
                          <span className="text-xs font-black text-slate-400 w-12">{l.kind === 'PERCENT' ? '% (ön-teklif)' : baseCurrency}</span>
                        </div>
                        <span className="text-sm font-black text-slate-900 w-28 text-right">{fmt(methodLineAmount(l))}</span>
                        <button onClick={() => removeMethodLine(i)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Operasyonel Giderler */}
              <div className="glass-panel rounded-[32px] overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-amber-500/10 text-amber-600 rounded-xl flex items-center justify-center"><Truck size={20} /></div>
                    <h4 className="font-black text-slate-900 uppercase italic tracking-widest text-sm">Operasyonel & Ek Giderler</h4>
                  </div>
                  <button onClick={handleAddCostItem} className="bg-amber-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all flex items-center gap-2"><Plus size={14} /> Gider Ekle</button>
                </div>
                <div className="p-6 space-y-4">
                  <AnimatePresence mode="popLayout">
                    {costItems.map((item, i) => (
                      <motion.div layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} key={i}
                        className="flex items-center gap-3 bg-white/40 p-4 rounded-2xl border border-white/60 flex-wrap">
                        <select value={item.category} onChange={e => handleUpdateCostItem(i, 'category', e.target.value)}
                          className="bg-white px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-amber-500">
                          {OPERATIONAL_CATS.map(c => <option key={c} value={c}>{COST_CATEGORY_LABEL[c]}</option>)}
                        </select>
                        <input type="text" value={item.description} onChange={e => handleUpdateCostItem(i, 'description', e.target.value)} placeholder="Gider açıklaması..."
                          className="flex-1 min-w-[140px] bg-white px-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-amber-500" />
                        <select value={item.currency || baseCurrency} onChange={e => handleUpdateCostItem(i, 'currency', e.target.value)}
                          className="bg-white px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-amber-500 w-20">
                          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                          <input type="number" value={item.amount} onChange={e => handleUpdateCostItem(i, 'amount', e.target.value)}
                            className="w-32 bg-white pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-sm font-black text-right outline-none focus:border-amber-500" />
                        </div>
                        {item.currency && item.currency !== baseCurrency && (
                          <span className="text-xs text-slate-400 font-medium whitespace-nowrap">≈ {fmt(toBase(Number(item.amount) || 0, item.currency))}</span>
                        )}
                        <button onClick={() => handleRemoveCostItem(i)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {costItems.length === 0 && (
                    <div className="py-8 text-center text-slate-400 font-bold italic border-2 border-dashed border-slate-100 rounded-2xl">Henüz manuel gider girilmedi.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Sağ: Marj + Özet */}
            <div className="space-y-6">
              <div className="glass-panel p-6 rounded-[32px]">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center"><Percent size={18} /></div>
                  <h4 className="font-black text-slate-900 uppercase italic tracking-widest text-sm">Hedef Marj (satış üzerinden)</h4>
                </div>
                <div className="relative">
                  <Percent className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={16} />
                  <input type="number" value={targetMargin} min={0} max={99} onChange={e => setTargetMargin(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border-2 border-emerald-200 rounded-2xl py-3 pl-10 pr-4 text-2xl font-black text-emerald-700 outline-none focus:border-emerald-500" />
                </div>
                <p className="text-[10px] text-slate-400 font-medium mt-3 leading-relaxed">
                  Teklif = Toplam Maliyet ÷ (1 − marj): <span className="font-black text-slate-600">{fmt(grandCost)} ÷ {(1 - mFrac).toFixed(2)} = {fmt(offer)}</span>.
                  Marj = kâr/satış (tutarlı). Tüm maliyetler (malzeme + operasyonel + usul) tabana dahildir.
                </p>
              </div>

              <div className="glass-panel p-8 rounded-[40px] sticky top-8">
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20"><TrendingUp size={24} /></div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Finansal Özet</h4>
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">Teklif Dövizi: {baseCurrency} · {PROCUREMENT_METHODS.find(m => m.key === method)?.label}</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[['BoM Maliyeti', bomCost], ['Operasyonel Gider', opsCost], ['Usul Masrafı', methodCostTotal]].map(([l, v]) => (
                    <div key={l as string} className="flex justify-between items-center p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100/50">
                      <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{l}</span>
                      <span className="text-base font-black text-slate-900">{fmt(v as number)}</span>
                    </div>
                  ))}
                  <div className="p-5 bg-slate-900 rounded-[24px] text-white shadow-xl space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Toplam Maliyet</span>
                      <span className="text-lg font-black tracking-tighter">{fmt(grandCost)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Teklif Fiyatı</span>
                      <span className="text-lg font-black tracking-tighter text-emerald-400">{fmt(offer)}</span>
                    </div>
                  </div>
                  <div className={cn('p-6 rounded-[28px] flex flex-col items-center gap-2 border-2',
                    marginPct >= 15 ? 'bg-emerald-500/5 border-emerald-500/20' : marginPct >= 10 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-red-500/5 border-red-500/20')}>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Proje Marjı (kâr/satış)</span>
                    <span className={cn('text-5xl font-black italic tracking-tighter leading-none', marginPct >= 15 ? 'text-emerald-600' : marginPct >= 10 ? 'text-amber-600' : 'text-red-600')}>%{marginPct.toFixed(1)}</span>
                    <p className={cn('text-xs font-bold mt-1', profit >= 0 ? 'text-emerald-600' : 'text-red-600')}>{profit >= 0 ? `+ ${fmt(profit)} Net Kâr` : `- ${fmt(Math.abs(profit))} Zarar`}</p>
                  </div>
                </div>
                <div className="mt-6 space-y-4">
                  {(() => {
                    const status = submitted ? 'PENDING_APPROVAL' : selectedOpp?.technicalStatus;
                    if (status === 'PENDING_APPROVAL') {
                      return (
                        <>
                          <div className="p-4 rounded-2xl bg-amber-500/5 border-2 border-amber-500/20 flex items-start gap-3">
                            <CalendarClock size={16} className="text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-amber-700 leading-relaxed font-bold">Maliyet analizi Satış Müdürü onayını bekliyor. Satış temsilcisi bilgilendirildi.</p>
                          </div>
                          {canApprove && (
                            <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Satış Müdürü Kararı</span>
                              <input value={approveNote} onChange={(e) => setApproveNote(e.target.value)} placeholder="Not (opsiyonel)"
                                className="w-full bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-primary/10" />
                              <div className="flex gap-3">
                                <button onClick={() => handleDecision('APPROVE')} disabled={decisionLoading}
                                  className="flex-1 bg-emerald-600 text-white py-3 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2">
                                  {decisionLoading ? <Loader2 size={16} className="animate-spin" /> : null} Onayla
                                </button>
                                <button onClick={() => handleDecision('REJECT')} disabled={decisionLoading}
                                  className="flex-1 bg-red-500/10 text-red-600 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all active:scale-95 disabled:opacity-60">
                                  Reddet
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    }
                    if (status === 'APPROVED') {
                      return (
                        <div className="p-4 rounded-2xl bg-emerald-500/5 border-2 border-emerald-500/20 flex items-start gap-3">
                          <TrendingUp size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                          <p className="text-[11px] text-emerald-700 leading-relaxed font-bold">Maliyet analizi onaylandı. Teklif hazırlanabilir.</p>
                        </div>
                      );
                    }
                    return (
                      <>
                        {status === 'REJECTED' && (
                          <div className="p-4 rounded-2xl bg-red-500/5 border-2 border-red-500/20 flex items-start gap-3">
                            <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-red-700 leading-relaxed font-bold">Önceki analiz reddedildi. Revize edip yeniden onaya gönderin.</p>
                          </div>
                        )}
                        <button onClick={handleSave} disabled={loading}
                          className="w-full bg-primary text-white py-4 rounded-2xl text-xs font-black shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center justify-center gap-3 uppercase tracking-[0.2em] active:scale-95 disabled:opacity-60">
                          {loading ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />} Kaydet ve Onaya Gönder
                        </button>
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
                          <AlertCircle size={15} className="text-slate-400 mt-0.5 shrink-0" />
                          <p className="text-[10px] text-slate-500 leading-relaxed font-medium">Maliyetler tahsilat tarihindeki forward kurdan, {baseCurrency} cinsinden hesaplanır; usul masrafları otomatik eklenir. Kayıt Satış Müdürü onay akışını başlatır.</p>
                        </div>
                      </>
                    );
                  })()}
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

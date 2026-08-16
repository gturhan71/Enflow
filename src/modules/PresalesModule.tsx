import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  FileSearch,
  Plus,
  ArrowUpRight,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Upload,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/src/lib/utils';
import {
  Opportunity,
  Proposal,
  TodoTask,
  Unit,
  User,
  BoMLineQuote,
  BomHandoff,
  Brand,
  ProductCategory,
  BrandSource
} from '../types';
import SpecAnalysis from './SpecAnalysis';
import { useAuth } from '../contexts/AuthContext';
import { PermissionGate } from '../components/PermissionGate';
import { useBoM } from '../hooks/useBoM';
import { parseBoMFile } from '../utils/bomParser';
import { SaveButton } from '../components/SaveButton';
import { apiService } from '../services/apiService';

interface PresalesModuleProps {
  opportunities: Opportunity[];
  setOpportunities: React.Dispatch<React.SetStateAction<Opportunity[]>>;
  units: Unit[];
  users: User[];
  proposals?: Proposal[];
  setProposals?: React.Dispatch<React.SetStateAction<Proposal[]>>;
  setTasks?: React.Dispatch<React.SetStateAction<TodoTask[]>>;
  initialOppId?: string | null;  // görev "Git" / bildirim deep-link ile gelen fırsat
}

const PresalesModule = ({ opportunities, setOpportunities, units, users, setTasks, initialOppId }: PresalesModuleProps) => {
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [moduleView, setModuleView] = useState<'BOM' | 'ANALYSIS' | 'HANDOFFS'>('BOM');
  const isPresalesMgr = currentUser?.role === 'PRESALES_MGR' || currentUser?.role === 'GENERAL_MANAGER';
  const [selectedOppId, setSelectedOppId] = useState<string>('');

  // Zorunlu teknik değerlendirme kapısı (backend'de de uygulanır — bkz.
  // opportunities.ts POST /:id/bom): Presales Müdürü CRM_HANDOFF'u onaylamadan
  // fırsat burada seçilemez. Bu özellikten önce BoM girişi başlamış fırsatlar
  // (en az bir kalem varsa) muaf — devam eden iş listeden kaybolmaz.
  const isBomEligible = (o: Opportunity) =>
    o.status !== 'WON' && o.status !== 'LOST' && (o.techEvalStatus === 'COMPLETED' || (o.bomItems?.length ?? 0) > 0);
  const bomEligibleOpportunities = opportunities.filter(isBomEligible);
  const pendingTechEvalOpportunities = opportunities.filter(o => o.status !== 'WON' && o.status !== 'LOST' && !isBomEligible(o));

  // Deep-link: dışarıdan gelen fırsatı otomatik seç (varsa ve listede ise).
  useEffect(() => {
    if (initialOppId && opportunities.some(o => o.id === initialOppId)) {
      setSelectedOppId(initialOppId);
    }
  }, [initialOppId, opportunities]);
  const [showHandOffModal, setShowHandOffModal] = useState(false);
  const [isHandingOff, setIsHandingOff] = useState(false);

  // Devir (handoff) state — hedef birim/kişi artık Süreç Motoru'ndan çözüldüğü
  // için burada yalnız bir not tutulur (bkz. handleHandOff).
  const [handOffNote, setHandOffNote] = useState('');
  const [handOffError, setHandOffError] = useState<string | null>(null);

  // BoM Hook integration
  const {
    bomItems,
    setBomItems,
    addBoMItem,
    isSubmitting,
    saveAndHandoff,
    totalCost
  } = useBoM(selectedOppId, setOpportunities, opportunities);

  // BoM hangi dövizle hazırlanıyorsa o döviz maliyetlendirmeye değişmeden taşınır (kritik)
  const [bomCurrency, setBomCurrency] = useState('TRY');
  const [newItem, setNewItem] = useState({
    pn: '',
    desc: '',
    qty: 1,
    cost: 0,
    margin: 15,
    currency: 'TRY',
    brandId: '',
    categoryId: '',
    source: ''
  });

  // Marka & Ürün Grubu — Ayarlar'dan yönetilen ortak liste (Faz 1).
  const [brands, setBrands] = useState<Brand[]>([]);
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([]);
  const [brandSources, setBrandSources] = useState<BrandSource[]>([]);
  useEffect(() => {
    apiService.getBrands().then(setBrands).catch(() => {});
    apiService.getProductCategories().then(setProductCategories).catch(() => {});
  }, []);
  useEffect(() => {
    if (!newItem.brandId) { setBrandSources([]); return; }
    apiService.getBrandSources(newItem.brandId).then(setBrandSources).catch(() => setBrandSources([]));
  }, [newItem.brandId]);

  const [showApprovalPreview, setShowApprovalPreview] = useState(false);
  const [quoteLine, setQuoteLine] = useState<{ lineKey: string; name: string } | null>(null);

  const handleHandOff = async () => {
    if (!selectedOppId) return;
    const opp = opportunities.find(o => o.id === selectedOppId);
    if (!opp) return;

    setIsHandingOff(true);
    setHandOffError(null);
    try {
      // Süreç Motoru (Faz C) — hedef birim/kişi artık İş Akışı Tasarımcısı'ndaki
      // PRESALES_HANDOFF haritasından çözülür (backend advanceProcess); serbest
      // birim/personel seçimi kaldırıldı (değişmez kural — harita esastır).
      await apiService.handoffOpportunity(opp.id, 'PRESALES_HANDOFF', handOffNote || 'Teknik analiz tamamlandı, iş devredildi.');
      // technicalStatus artık backend'e kalıcı yazılıyor (eskiden yalnız local state'te tutulup sayfa yenilenince kayboluyordu).
      const updated = await apiService.updateOpportunity(opp.id, { technicalStatus: 'COMPLETED' }) as Opportunity;
      setOpportunities(prev => prev.map(o => o.id === selectedOppId ? { ...o, ...updated } : o));
      setShowHandOffModal(false);
      alert('İş başarıyla devredildi.');
    } catch (e) {
      setHandOffError(e instanceof Error ? e.message : 'Devir sırasında hata oluştu.');
    } finally {
      setIsHandingOff(false);
    }
  };

  const handleRequestApproval = () => {
    if (!selectedOppId) return;
    if (bomItems.length === 0) {
      alert('BoM listesi boş. Lütfen önce kalem ekleyin.');
      return;
    }
    setShowApprovalPreview(true);
  };

  const handleConfirmApproval = async () => {
    const opp = opportunities.find(o => o.id === selectedOppId);
    if (!opp) return;

    // BoM kaydet + Satış'a devret (maliyet analizi Satış'ın işi — burada teklif/onay yok)
    const success = await saveAndHandoff();
    if (!success) return;

    setShowApprovalPreview(false);

    try {
      // Satış'a "maliyet analizi yap" görevi (relatedModule = OPPORTUNITY)
      const task = await apiService.createTask({
        title: `Maliyet Analizi: ${opp.title}`,
        description: `Presales BoM listesini tamamladı (${bomItems.length} kalem). Satış birimi maliyet/karlılık analizini yapıp Satış Müdürü onayına sunabilir.`,
        unitId: 'unit_sales',
        assignedBy: currentUser?.id || 'system',
        priority: 'HIGH',
        status: 'PENDING',
        relatedModule: 'OPPORTUNITY',
        relatedItemId: selectedOppId,
        slaBusinessDays: 3,
      });
      if (setTasks) setTasks(prev => [task, ...prev]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Satışa devir görevi oluşturulamadı.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const parsedItems = await parseBoMFile(file);
      if (parsedItems.length > 0) {
        setBomItems(prev => [...parsedItems, ...prev]);
        alert(`${parsedItems.length} kalem başarıyla içe aktarıldı.`);
      } else {
        alert('Dosyada uygun veri bulunamadı. Lütfen formatı kontrol edin.');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Dosya yükleme hatası.');
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="p-8 h-[calc(100vh-80px)] overflow-hidden flex flex-col font-sans">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 font-sans">Presales & Dizayn</h3>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-slate-500 whitespace-nowrap">BoM listesini fırsata bağlayın:</p>
            <select
              value={selectedOppId}
              onChange={(e) => setSelectedOppId(e.target.value)}
              className="bg-white/50 border border-slate-200 rounded-lg px-3 py-1 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="">Fırsat Seçin</option>
              {bomEligibleOpportunities.map(opp => (
                <option key={opp.id} value={opp.id}>{opp.title}</option>
              ))}
            </select>
          </div>
          {pendingTechEvalOpportunities.length > 0 && (
            <p className="text-[11px] text-amber-600 font-bold mt-1">
              ⏳ {pendingTechEvalOpportunities.length} fırsat Presales Müdürü teknik değerlendirme onayı bekliyor — onaylanmadan BoM listesinde görünmez: {pendingTechEvalOpportunities.map(o => o.title).join(', ')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <PermissionGate permission="PRESALES_EDIT">
            <div className="flex items-center gap-2">
              <button 
                onClick={handleRequestApproval}
                disabled={!selectedOppId || isSubmitting}
                className="bg-primary text-white px-6 py-2.5 rounded-xl text-xs font-black shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-50 uppercase tracking-widest"
              >
                {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                BoM'u Kaydet & Satışa Devret
              </button>
              <button 
                onClick={() => setShowHandOffModal(true)}
                disabled={!selectedOppId}
                className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-black shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50 uppercase tracking-widest"
              >
                <ArrowUpRight size={16} /> İşi Devret
              </button>
            </div>
          </PermissionGate>
          <div className="h-8 w-px bg-slate-200" />
          <div className="flex bg-slate-200/50 p-1 rounded-2xl">
            <button onClick={() => setModuleView('BOM')} className={cn("px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2", moduleView === 'BOM' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}><LayoutDashboard size={16} />BoM Oluşturma</button>
            <button onClick={() => setModuleView('ANALYSIS')} className={cn("px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2", moduleView === 'ANALYSIS' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}><FileSearch size={16} />Şartname Analizi</button>
            {isPresalesMgr && <button onClick={() => setModuleView('HANDOFFS')} className={cn("px-6 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2", moduleView === 'HANDOFFS' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}><LayoutDashboard size={16} />Devredilen BoM'lar</button>}
          </div>
        </div>
      </div>

      {moduleView === 'BOM' ? (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 overflow-hidden">
          {/* Left Side: Requirements */}
          <div className="glass-panel rounded-3xl flex flex-col overflow-hidden bg-white border border-slate-100 shadow-sm">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h4 className="font-bold text-slate-900 flex items-center gap-2"><FileSearch size={20} className="text-indigo-600" />Şartname Maddeleri</h4>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="p-4 rounded-2xl border border-slate-200 bg-white"><p className="text-sm font-medium text-slate-700">Analiz tamamlandığında maddeler burada listelenir.</p></div>
            </div>
          </div>

          {/* Right Side: BoM Table */}
          <div className="glass-panel rounded-3xl flex flex-col overflow-hidden bg-white border border-slate-100 shadow-sm">
             <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h4 className="font-bold text-slate-900 font-sans">BoM Listesi</h4>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept=".xlsx, .xls, .csv, .xml" 
                    className="hidden" 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                  >
                    <Upload size={14} />
                    Excel / XML Yükle
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase font-sans">Toplam Maliyet</p>
                    <p className="text-sm font-mono font-bold text-slate-900">${totalCost.toLocaleString()}</p>
                  </div>
                  <SaveButton onClick={handleRequestApproval} loading={isSubmitting} />
                </div>
             </div>
             
             {/* BoM Para Birimi — yeni kalemler bu dövizle hazırlanır (maliyetlendirmeye değişmeden taşınır) */}
             <div className="px-4 pt-3 pb-1 bg-slate-50 flex items-center gap-2">
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">BoM Para Birimi</span>
               <select value={bomCurrency} onChange={(e) => { setBomCurrency(e.target.value); setNewItem(n => ({ ...n, currency: e.target.value })); }}
                 className="text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white outline-none">
                 <option value="TRY">₺ TRY</option><option value="USD">$ USD</option><option value="EUR">€ EUR</option>
               </select>
               <span className="text-[10px] text-amber-600 font-semibold">Her kalemin hazırlandığı döviz maliyetlendirmeye aynı kurla aktarılır.</span>
             </div>
             {/* Manual BoM Item Form */}
             <div className="p-4 bg-slate-50 border-b border-slate-100 grid grid-cols-12 gap-2">
                <input type="text" placeholder="P/N" className="col-span-3 p-2 text-xs border rounded-lg bg-white" value={newItem.pn} onChange={(e) => setNewItem({...newItem, pn: e.target.value})} />
                <input type="text" placeholder="Açıklama" className="col-span-4 p-2 text-xs border rounded-lg bg-white" value={newItem.desc} onChange={(e) => setNewItem({...newItem, desc: e.target.value})} />
                <input type="number" placeholder="Adet" className="col-span-1 p-2 text-xs border rounded-lg bg-white" value={newItem.qty} onChange={(e) => setNewItem({...newItem, qty: parseInt(e.target.value) || 1})} />
                <input type="number" placeholder="Maliyet" className="col-span-2 p-2 text-xs border rounded-lg bg-white" value={newItem.cost} onChange={(e) => setNewItem({...newItem, cost: parseFloat(e.target.value) || 0})} />
                <select value={newItem.currency} onChange={(e) => setNewItem({...newItem, currency: e.target.value})} className="col-span-1 p-2 text-xs border rounded-lg bg-white" title="Para birimi">
                  <option value="TRY">₺</option><option value="USD">$</option><option value="EUR">€</option>
                </select>
                <button
                  className="col-span-1 bg-primary text-white rounded-lg flex items-center justify-center hover:bg-primary/90 transition-all"
                  onClick={() => {
                    if (!newItem.pn && !newItem.desc) return;
                    addBoMItem({
                      pn: newItem.pn, desc: newItem.desc, qty: newItem.qty, cost: newItem.cost, margin: newItem.margin, currency: newItem.currency,
                      brandId: newItem.brandId || undefined, categoryId: newItem.categoryId || undefined, source: newItem.source || undefined,
                    });
                    setNewItem({ pn: '', desc: '', qty: 1, cost: 0, margin: 15, currency: bomCurrency, brandId: '', categoryId: '', source: '' });
                  }}
                >
                  <Plus size={16} />
                </button>
                {/* Marka / Ürün Grubu / Kaynak — marka seçilince Kaynak o markanın kayıtlı listesinden dolar */}
                <select value={newItem.brandId} onChange={(e) => setNewItem({ ...newItem, brandId: e.target.value, source: '' })} className="col-span-4 p-2 text-xs border rounded-lg bg-white" title="Marka">
                  <option value="">Marka seçilmedi</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <select value={newItem.categoryId} onChange={(e) => setNewItem({ ...newItem, categoryId: e.target.value })} className="col-span-4 p-2 text-xs border rounded-lg bg-white" title="Ürün Grubu">
                  <option value="">Ürün grubu seçilmedi</option>
                  {productCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {newItem.brandId ? (
                  <select value={newItem.source} onChange={(e) => setNewItem({ ...newItem, source: e.target.value })} className="col-span-4 p-2 text-xs border rounded-lg bg-white" title="Kaynak / Distribütör">
                    <option value="">Kaynak seçilmedi</option>
                    {brandSources.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                ) : (
                  <input type="text" placeholder="Kaynak (serbest metin — marka seçilirse listeden seçilir)" className="col-span-4 p-2 text-xs border rounded-lg bg-white"
                    value={newItem.source} onChange={(e) => setNewItem({ ...newItem, source: e.target.value })} />
                )}
             </div>

             <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
               {bomItems.map((item, i) => (
                 <div key={item.lineKey || i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-sans">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-xs font-bold text-indigo-600">{item.pn}</span>
                      <span className="text-sm font-bold text-slate-800">{item.cost.toLocaleString('tr-TR')} {item.currency || 'TRY'} x {item.qty}</span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{item.desc}</p>
                    {(item.brandId || item.categoryId || item.source) && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                        {item.brandId && <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">{brands.find(b => b.id === item.brandId)?.name || 'Marka'}</span>}
                        {item.categoryId && <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">{productCategories.find(c => c.id === item.categoryId)?.name || 'Ürün Grubu'}</span>}
                        {item.source && <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Kaynak: {item.source}</span>}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      {item.vendor ? <span className="text-[11px] text-emerald-600 font-semibold">✓ {item.vendor}</span> : <span className="text-[11px] text-slate-400">Tedarikçi seçilmedi</span>}
                      <button onClick={() => setQuoteLine({ lineKey: item.lineKey || '', name: item.pn || item.desc })}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded-lg px-2 py-1">
                        Teklif Değerlendir
                      </button>
                    </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      ) : moduleView === 'HANDOFFS' ? (
        <BomHandoffsView />
      ) : (
        <SpecAnalysis opportunityId={selectedOppId} onTransferToBoM={(prods) => { setBomItems([...prods.map(p => ({pn: p.pn, desc: p.description, qty: p.quantity, cost: 0, margin: 15, currency: bomCurrency, lineKey: undefined})), ...bomItems]); setModuleView('BOM'); }} />
      )}

      {/* Hand-off Modal */}
      <AnimatePresence>
        {showHandOffModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="glass-panel w-full max-w-md rounded-3xl shadow-2xl overflow-hidden bg-white p-8">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-xl font-bold text-slate-900">İşi Devret</h4>
                <button onClick={() => setShowHandOffModal(false)}><X size={20} /></button>
              </div>
              <div className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Hedef birim/kişi, Ayarlar → İş Akışı Tasarımcısı'nda kurgulanan
                  <span className="font-bold text-slate-700"> PRESALES_HANDOFF </span>
                  haritasına göre otomatik belirlenir.
                </p>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase">Not / Talimat</label>
                  <textarea value={handOffNote} onChange={(e) => setHandOffNote(e.target.value)} rows={3} placeholder="İşi devralacak kişiye notunuz..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 resize-none bg-white" />
                </div>
                {handOffError && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600 font-medium">{handOffError}</div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-6">
                <button onClick={() => setShowHandOffModal(false)} className="px-6 py-2 text-sm font-bold text-slate-500">İptal</button>
                <button
                  onClick={handleHandOff}
                  disabled={isHandingOff}
                  className="bg-indigo-600 text-white px-8 py-2 rounded-xl text-sm font-bold shadow-lg flex items-center gap-2 disabled:opacity-50"
                >
                  {isHandingOff ? <Loader2 size={18} className="animate-spin" /> : 'Devret ve Bildir'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* BoM Approval Preview Modal */}
      <AnimatePresence>
        {showApprovalPreview && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="glass-panel w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden bg-white/80 flex flex-col border border-white/50"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-white/40 backdrop-blur-sm">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight">BoM Devir Önizleme</h4>
                    <p className="text-sm text-slate-500 font-medium">BoM Satış birimine maliyet analizi için devredilecek.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowApprovalPreview(false)}
                  className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">P/N (Parça No)</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Açıklama</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-center">Adet</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Maliyet</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 text-right">Toplam</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {bomItems.map((item, i) => (
                        <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 text-xs font-mono font-bold text-indigo-600">{item.pn}</td>
                          <td className="px-6 py-4 text-xs text-slate-600 font-medium">{item.desc}</td>
                          <td className="px-6 py-4 text-xs text-slate-900 font-bold text-center">{item.qty}</td>
                          <td className="px-6 py-4 text-xs text-slate-900 font-bold text-right">${item.cost.toLocaleString()}</td>
                          <td className="px-6 py-4 text-xs text-primary font-black text-right">${(item.cost * item.qty).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-sans">
                        <td colSpan={4} className="px-6 py-4 text-xs font-black uppercase tracking-widest">Genel Toplam</td>
                        <td className="px-6 py-4 text-lg font-black text-right">
                          ${totalCost.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="mt-6 p-6 rounded-3xl bg-amber-50 border border-amber-100 flex items-start gap-4">
                  <div className="mt-1 text-amber-500">
                    <AlertCircle size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-900">Önemli Not</p>
                    <p className="text-xs text-amber-700 leading-relaxed mt-1">
                      Bu BoM Satış birimine maliyet/karlılık analizi için devredilecek. Maliyet analizi daha önce
                      yapıldıysa devir yeni bir tur başlatır (maliyet durumu sıfırlanır). Lütfen kalemlerin doğruluğundan emin olun.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-4">
                <button 
                  onClick={() => setShowApprovalPreview(false)}
                  className="px-8 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Vazgeç
                </button>
                <button 
                  onClick={handleConfirmApproval}
                  disabled={isSubmitting}
                  className="bg-primary text-white px-10 py-3 rounded-2xl text-xs font-black shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all flex items-center gap-3 disabled:opacity-50 uppercase tracking-[0.2em]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Devrediliyor...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Kaydet ve Satışa Devret
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {quoteLine && selectedOppId && (
          <BoMQuotePanel
            opportunityId={selectedOppId}
            lineKey={quoteLine.lineKey}
            componentName={quoteLine.name}
            onClose={() => setQuoteLine(null)}
            onSelected={(cost, vendor) => setBomItems(prev => prev.map(b => b.lineKey === quoteLine.lineKey ? { ...b, cost, vendor } : b))}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Devredilen BoM'lar (Presales yönetici liste/detay) ──────────────────────────
const COMP_LABEL: Record<string, string> = { COMPLIANT: 'Uygun', PARTIAL: 'Kısmen Uygun', NON_COMPLIANT: 'Uygun Değil' };

const BomHandoffsView: React.FC = () => {
  const [handoffs, setHandoffs] = useState<BomHandoff[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<BomHandoff | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiService.getBomHandoffs().then(d => { if (active) setHandoffs((d as BomHandoff[]) || []); }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  const fmtTotals = (json?: string | null) => {
    if (!json) return '—';
    try { const t = JSON.parse(json) as Record<string, number>; return Object.entries(t).map(([c, v]) => `${v.toLocaleString('tr-TR')} ${c}`).join(' + ') || '—'; } catch { return '—'; }
  };
  const snap = selected?.snapshot ? (() => { try { return JSON.parse(selected.snapshot as string) as { items: { partNumber: string; description: string; quantity: number; purchaseCost: number; currency: string; vendor?: string | null }[]; evaluation?: { lines?: { componentName?: string; quoteCount: number; selected?: { vendorName: string; technicalCompliance: string; fileName?: string; fileUrl?: string } | null; alternatives?: unknown[] }[] } | null }; } catch { return null; } })() : null;

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
      {/* Liste */}
      <div className="glass-panel rounded-3xl flex flex-col overflow-hidden bg-white border border-slate-100 shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h4 className="font-black text-slate-900">Satışa Devredilen BoM'lar</h4>
          <span className="text-xs font-bold text-indigo-600">{handoffs.length} fırsat</span>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && <p className="text-sm text-slate-400 italic px-2">Yükleniyor...</p>}
          {!loading && handoffs.length === 0 && <p className="text-sm text-slate-400 italic px-2">Henüz Satışa devredilen BoM yok.</p>}
          {handoffs.map(h => (
            <button key={h.id} onClick={() => setSelected(h)}
              className={cn("w-full text-left p-3 rounded-2xl border transition-all", selected?.id === h.id ? "border-indigo-400 bg-indigo-50/40" : "border-slate-100 bg-slate-50 hover:bg-white")}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-900 truncate">{h.oppTitle}</span>
                {h.handoffCount > 1 && <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">{h.handoffCount}. revizyon</span>}
              </div>
              <p className="text-[11px] text-slate-500">{h.customerName || '—'} · {h.itemCount} kalem · {fmtTotals(h.totalsByCurrency)}</p>
              <p className="text-[10px] text-slate-400">Son devir: {h.lastHandoffAt ? new Date(h.lastHandoffAt).toLocaleDateString('tr-TR') : '—'}{h.handedOffByName ? ` · ${h.handedOffByName}` : ''}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Detay */}
      <div className="glass-panel rounded-3xl flex flex-col overflow-hidden bg-white border border-slate-100 shadow-sm">
        <div className="p-5 border-b border-slate-100">
          <h4 className="font-black text-slate-900">{selected ? selected.oppTitle : 'Detay'}</h4>
          <p className="text-xs text-slate-400">{selected ? 'BoM içeriği + tedarikçi değerlendirme' : 'İncelemek için soldan bir BoM seçin'}</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {snap?.items?.map((it, i) => {
            const evalLine = snap.evaluation?.lines?.find(l => l.componentName === it.partNumber || l.componentName === it.description);
            return (
              <div key={i} className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-bold text-indigo-600">{it.partNumber}</span>
                  <span className="text-sm font-bold text-slate-800">{it.purchaseCost.toLocaleString('tr-TR')} {it.currency} × {it.quantity}</span>
                </div>
                <p className="text-xs text-slate-600">{it.description}</p>
                <div className="flex items-center justify-between mt-1">
                  {it.vendor ? <span className="text-[11px] text-emerald-600 font-semibold">✓ {it.vendor}</span> : <span className="text-[11px] text-slate-400">Tedarikçi —</span>}
                  {evalLine?.selected && <span className="text-[10px] text-slate-500">{COMP_LABEL[evalLine.selected.technicalCompliance] || ''}{(evalLine.alternatives?.length ?? 0) > 0 ? ` · +${evalLine.alternatives!.length} alternatif` : ''}</span>}
                </div>
                {evalLine?.selected?.fileUrl && (
                  <a href={evalLine.selected.fileUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-indigo-600 hover:underline">📎 {evalLine.selected.fileName || 'Teklif dosyası'}</a>
                )}
              </div>
            );
          })}
          {selected && (!snap || !snap.items?.length) && <p className="text-sm text-slate-400 italic">Snapshot içeriği yok.</p>}
        </div>
      </div>
    </div>
  );
};

// ── BoM Tedarikçi Teklif Değerlendirme Paneli ────────────────────────────────────
const COMPLIANCE: Record<string, { label: string; cls: string }> = {
  COMPLIANT: { label: 'Uygun', cls: 'bg-emerald-100 text-emerald-700' },
  PARTIAL: { label: 'Kısmen Uygun', cls: 'bg-amber-100 text-amber-700' },
  NON_COMPLIANT: { label: 'Uygun Değil', cls: 'bg-red-100 text-red-700' },
};

const BoMQuotePanel: React.FC<{
  opportunityId: string; lineKey: string; componentName: string;
  onClose: () => void; onSelected: (cost: number, vendor: string) => void;
}> = ({ opportunityId, lineKey, componentName, onClose, onSelected }) => {
  const [quotes, setQuotes] = useState<BoMLineQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestId, setSuggestId] = useState<string | null>(null);
  const [f, setF] = useState({ vendorName: '', unitPrice: '', currency: 'TRY', technicalCompliance: 'COMPLIANT', specSummary: '', deliveryDays: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = (await apiService.getBomQuotes(opportunityId)) as BoMLineQuote[];
      setQuotes((all || []).filter(q => q.lineKey === lineKey));
    } finally { setLoading(false); }
  }, [opportunityId, lineKey]);
  useEffect(() => { load(); }, [load]);

  const addQuote = async () => {
    if (!f.vendorName.trim() || !f.unitPrice) return;
    await apiService.addBomQuote({
      opportunityId, lineKey, componentName,
      vendorName: f.vendorName.trim(), unitPrice: Number(f.unitPrice), currency: f.currency,
      technicalCompliance: f.technicalCompliance, specSummary: f.specSummary || undefined,
      deliveryDays: f.deliveryDays ? Number(f.deliveryDays) : undefined,
    });
    setF({ vendorName: '', unitPrice: '', currency: 'TRY', technicalCompliance: 'COMPLIANT', specSummary: '', deliveryDays: '' });
    load();
  };

  const suggest = () => {
    const compliant = quotes.filter(q => q.technicalCompliance !== 'NON_COMPLIANT');
    if (compliant.length === 0) { setSuggestId(null); return; }
    const cheapest = compliant.reduce((a, b) => (a.unitPrice <= b.unitPrice ? a : b));
    setSuggestId(cheapest.id);
  };

  const selectQuote = async (q: BoMLineQuote) => {
    if (q.technicalCompliance === 'NON_COMPLIANT') return;
    try {
      await apiService.selectBomQuote(q.id);
      onSelected(q.unitPrice, q.vendorName);
      load();
    } catch (e) { alert('Seçim hatası: ' + (e instanceof Error ? e.message : '')); }
  };

  const removeQuote = async (q: BoMLineQuote) => { await apiService.deleteBomQuote(q.id); load(); };

  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const uploadFile = async (q: BoMLineQuote, file: File) => {
    setUploadingId(q.id);
    try {
      const fd = new FormData(); fd.append('file', file);
      const tid = localStorage.getItem('enflow_active_tenant_id') || '';
      const token = localStorage.getItem('enflow_auth_token') || 'mock-token';
      const r = await fetch(`/api/bom-quotes/${q.id}/upload`, { method: 'POST', headers: { 'x-tenant-id': tid, 'Authorization': `Bearer ${token}` }, body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);
      await load();
    } catch (e) { alert('Yükleme hatası: ' + (e instanceof Error ? e.message : '')); }
    finally { setUploadingId(null); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="glass-panel w-full max-w-2xl rounded-3xl shadow-2xl bg-white max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h4 className="text-lg font-black text-slate-900">Tedarikçi Teklif Değerlendirme</h4>
            <p className="text-xs text-slate-500">{componentName} — fiyat + teknik uygunluk; yalnız uygun teklif BoM'a işlenir.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl"><X size={18} /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Alınan Teklifler ({quotes.length})</span>
            <button onClick={suggest} disabled={quotes.length === 0} className="text-[11px] font-bold text-indigo-600 border border-indigo-200 rounded-lg px-2 py-1 disabled:opacity-40">En uygun öner</button>
          </div>
          {loading && <p className="text-sm text-slate-400 italic">Yükleniyor...</p>}
          {!loading && quotes.length === 0 && <p className="text-sm text-slate-400 italic">Henüz teklif eklenmedi.</p>}
          {quotes.map(q => {
            const c = COMPLIANCE[q.technicalCompliance] || COMPLIANCE.COMPLIANT;
            return (
              <div key={q.id} className={`rounded-2xl p-3 border ${q.isSelected ? 'border-emerald-500/50 bg-emerald-50' : suggestId === q.id ? 'border-indigo-400 bg-indigo-50/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 flex items-center gap-2">{q.vendorName}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${c.cls}`}>{c.label}</span>
                      {q.isSelected && <span className="text-[10px] font-bold text-emerald-600">✓ SEÇİLİ</span>}
                      {suggestId === q.id && !q.isSelected && <span className="text-[10px] font-bold text-indigo-600">★ Önerilen</span>}
                    </p>
                    {q.specSummary && <p className="text-[11px] text-slate-500 mt-0.5">{q.specSummary}</p>}
                    {q.deliveryDays != null && <p className="text-[10px] text-slate-400">{q.deliveryDays} gün teslimat</p>}
                    <div className="flex items-center gap-2 mt-1">
                      {q.fileUrl ? (
                        <a href={q.fileUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1">
                          <Upload size={10} /> {q.fileName || 'Teklif dosyası'}
                        </a>
                      ) : <span className="text-[10px] text-slate-400">Orijinal teklif dosyası yok</span>}
                      <label className="text-[10px] font-bold text-slate-500 hover:text-indigo-600 cursor-pointer border border-slate-200 rounded px-1.5 py-0.5">
                        {uploadingId === q.id ? '...' : q.fileUrl ? 'Değiştir' : 'Dosya Yükle'}
                        <input type="file" className="hidden" accept=".pdf,.xls,.xlsx,.xml,.doc,.docx,.csv" disabled={uploadingId === q.id}
                          onChange={e => { const file = e.target.files?.[0]; if (file) uploadFile(q, file); e.target.value = ''; }} />
                      </label>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-black text-slate-900">{q.unitPrice.toLocaleString('tr-TR')} {q.currency}</p>
                    <div className="flex items-center gap-2 justify-end mt-1">
                      <button onClick={() => selectQuote(q)} disabled={q.technicalCompliance === 'NON_COMPLIANT' || q.isSelected}
                        title={q.technicalCompliance === 'NON_COMPLIANT' ? 'Teknik uygun olmayan seçilemez' : 'BoM\'a seç'}
                        className="text-[11px] font-bold text-emerald-600 disabled:text-slate-300 disabled:cursor-not-allowed">Seç</button>
                      <button onClick={() => removeQuote(q)} className="text-slate-300 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50 space-y-2">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Yeni Teklif Ekle</p>
          <div className="grid grid-cols-12 gap-2">
            <input value={f.vendorName} onChange={e => setF({ ...f, vendorName: e.target.value })} placeholder="Tedarikçi (üretici/dist.)" className="col-span-5 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none" />
            <input type="number" value={f.unitPrice} onChange={e => setF({ ...f, unitPrice: e.target.value })} placeholder="Birim fiyat" className="col-span-3 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none" />
            <select value={f.currency} onChange={e => setF({ ...f, currency: e.target.value })} className="col-span-2 px-2 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none">
              <option>TRY</option><option>USD</option><option>EUR</option>
            </select>
            <input type="number" value={f.deliveryDays} onChange={e => setF({ ...f, deliveryDays: e.target.value })} placeholder="Gün" className="col-span-2 px-2 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none" />
            <select value={f.technicalCompliance} onChange={e => setF({ ...f, technicalCompliance: e.target.value })} className="col-span-5 px-2 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none">
              <option value="COMPLIANT">Uygun</option><option value="PARTIAL">Kısmen Uygun</option><option value="NON_COMPLIANT">Uygun Değil</option>
            </select>
            <input value={f.specSummary} onChange={e => setF({ ...f, specSummary: e.target.value })} placeholder="Teknik not / uygunluk" className="col-span-5 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg outline-none" />
            <button onClick={addQuote} disabled={!f.vendorName.trim() || !f.unitPrice} className="col-span-2 bg-primary text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-40"><Plus size={14} />Ekle</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PresalesModule;

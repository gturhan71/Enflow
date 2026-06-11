import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSignature, 
  Download, 
  ChevronRight, 
  Save, 
  Printer, 
  Plus, 
  Trash2, 
  Percent, 
  DollarSign, 
  FileText,
  Building,
  User,
  Calendar,
  Settings2,
  Loader2,
  Hash,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Opportunity, BoMItem, CostItem, Customer, Proposal } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ProposalEditorProps {
  opportunity: Opportunity;
  bomItems: BoMItem[];
  costItems: CostItem[];
  customers: Customer[];
  version: number;
  initialData?: {
    items?: BoMItem[];
    terms?: string;
    description?: string;
    totalPrice?: number;
  };
  onSave: (proposal: Omit<Proposal, 'id'>) => void;
  onCancel: () => void;
}

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const trToEn = (text: string) => {
  return text
    .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U').replace(/ü/g, 'u')
    .replace(/Ş/g, 'S').replace(/ş/g, 's')
    .replace(/İ/g, 'I').replace(/ı/g, 'i')
    .replace(/Ö/g, 'O').replace(/ö/g, 'o')
    .replace(/Ç/g, 'C').replace(/ç/g, 'c');
};

const ProposalEditor = ({ opportunity, bomItems, costItems, customers, version, initialData, onSave, onCancel }: ProposalEditorProps) => {
  const customer = customers.find(c => c.id === opportunity.customerId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [items, setItems] = useState(() => {
    if (initialData?.items && initialData.items.length > 0) {
      return initialData.items;
    }
    return bomItems.map(item => ({
      ...item,
      salePrice: item.purchaseCost * (1 + (item.marginPercentage || 15) / 100)
    }));
  });
  
  const [globalMargin, setGlobalMargin] = useState(15);
  const [openForNegotiation, setOpenForNegotiation] = useState(() => {
    return (initialData as any)?.openForNegotiation || false;
  });
  const [terms, setTerms] = useState(initialData?.terms || `1. Teklif geçerlilik süresi 30 gündür.
2. Ödeme vadesi fatura tarihinden itibaren 30 gündür.
3. Fiyatlara KDV dahil değildir.
4. Teslimat süresi stok durumuna göre 4-6 haftadır.`);
  const [description, setDescription] = useState(initialData?.description || 'Proje kapsamında ihtiyaç duyulan teknik donanım ve lisansları içeren fiyat teklifidir.');

  // Calculation logic
  const totalBoMCost = useMemo(() => 
    items.reduce((sum, item) => sum + (item.purchaseCost * item.quantity), 0),
  [items]);

  const totalOpsCost = useMemo(() => 
    costItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
  [costItems]);

  const grandTotalCost = totalBoMCost + totalOpsCost;
  
  const calculatedTotalPrice = useMemo(() => 
    items.reduce((sum, item) => sum + (item.salePrice * item.quantity), 0),
  [items]);

  const [manualTotalPrice, setManualTotalPrice] = useState<number>(initialData?.totalPrice || 0);

  // Initialize manual price with calculated price if no initial totalPrice
  useEffect(() => {
    if (!initialData?.totalPrice) {
      setManualTotalPrice(Math.round(calculatedTotalPrice));
    }
  }, [calculatedTotalPrice, initialData?.totalPrice]);

  const netProfit = manualTotalPrice - grandTotalCost;
  const realMargin = manualTotalPrice > 0 ? (netProfit / manualTotalPrice) * 100 : 0;

  const applyGlobalMargin = () => {
    setItems(items.map(item => ({
      ...item,
      marginPercentage: globalMargin,
      salePrice: item.purchaseCost * (1 + globalMargin / 100)
    })));
  };

  const updateItemMargin = (id: string, margin: number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        return {
          ...item,
          marginPercentage: margin,
          salePrice: item.purchaseCost * (1 + margin / 100)
        };
      }
      return item;
    }));
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        putOnlyUsedFonts: true
      });
      const pageWidth = doc.internal.pageSize.getWidth();
      
      let fontLoaded = false;
      try {
        const [regRes, boldRes] = await Promise.all([
          fetch('https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/Roboto-Regular.ttf'),
          fetch('https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/Roboto-Bold.ttf')
        ]);
        
        if (regRes.ok && boldRes.ok) {
          const [regBuffer, boldBuffer] = await Promise.all([
            regRes.arrayBuffer(),
            boldRes.arrayBuffer()
          ]);
          
          doc.addFileToVFS('Roboto-Regular.ttf', arrayBufferToBase64(regBuffer));
          doc.addFileToVFS('Roboto-Bold.ttf', arrayBufferToBase64(boldBuffer));
          doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
          doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
          doc.setFont('Roboto');
          fontLoaded = true;
        }
      } catch (err) {
        console.warn('Custom font load failed, falling back to Helvetica', err);
      }
      
      const font = fontLoaded ? 'Roboto' : 'helvetica';
      const cleanText = (t: string) => fontLoaded ? t : trToEn(t);
      
      doc.setFont(font);

      // Header
      doc.setDrawColor(16, 185, 129); // Primary Emerald
      doc.setLineWidth(0.5);
      doc.line(20, 32, pageWidth - 20, 32);
      
      doc.setTextColor(16, 185, 129);
      doc.setFontSize(22);
      doc.setFont(font, 'bold');
      doc.text(cleanText('ENFLOW TEKNOLOJI SISTEMLERI'), 20, 24);
      
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(9);
      doc.setFont(font, 'normal');
      doc.text(cleanText('Kurumsal Surec Yonetimi ve Otomasyon | www.enflow.com'), 20, 29);

      // Proposal Title
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(18);
      doc.setFont(font, 'bold');
      doc.text(cleanText('FIYAT TEKLIFI'), 20, 50);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.setFont(font, 'normal');
      doc.text(cleanText(`Teklif No: PR-${opportunity.id.slice(-6).toUpperCase()}-V${version}`), pageWidth - 20, 50, { align: 'right' });
      doc.text(cleanText(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`), pageWidth - 20, 55, { align: 'right' });

      // Info Boxes
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(20, 65, 80, 35, 2, 2, 'D');
      doc.text(cleanText('MUSTERI BILGILERI'), 24, 71);
      doc.setFont(font, 'bold');
      doc.text(cleanText(customer?.name || 'Bilinmeyen Musteri'), 24, 78);
      doc.setFont(font, 'normal');
      doc.text(cleanText(customer?.address || '-'), 24, 83, { maxWidth: 70 });

      doc.roundedRect(110, 65, 80, 35, 2, 2, 'D');
      doc.text(cleanText('PROJE BILGILERI'), 114, 71);
      doc.setFont(font, 'bold');
      doc.text(cleanText(opportunity.title), 114, 78);
      doc.setFont(font, 'normal');
      doc.text(cleanText(`Versiyon: V${version}`), 114, 83);

      // Description
      doc.setFontSize(10);
      doc.setFont(font, 'bold');
      doc.text(cleanText('Teklif Ozeti ve Aciklama:'), 20, 115);
      doc.setFont(font, 'normal');
      doc.setFontSize(9);
      const descLines = doc.splitTextToSize(cleanText(description), pageWidth - 40);
      doc.text(descLines, 20, 122);

      // Table Data Construction
      const bomData = items.map((item, index) => [
        index + 1,
        cleanText(item.partNumber),
        cleanText(item.description),
        item.quantity,
        `$${Math.round(item.salePrice).toLocaleString()}`,
        `$${Math.round(item.salePrice * item.quantity).toLocaleString()}`
      ]);

      const costData = costItems.map((item, index) => [
        items.length + index + 1,
        cleanText(item.category || 'DIĞER'),
        cleanText(item.description || 'Operasyonel Gider'),
        1,
        `$${Math.round(item.amount || 0).toLocaleString()}`,
        `$${Math.round(item.amount || 0).toLocaleString()}`
      ]);

      const tableData = [...bomData, ...costData];

      autoTable(doc, {
        startY: 122 + (descLines.length * 5) + 10,
        head: [[cleanText('#'), cleanText('P/N / Kategori'), cleanText('Aciklama'), cleanText('Adet'), cleanText('Birim Fiyat'), cleanText('Toplam')]],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [248, 250, 252], textColor: [30, 41, 59], font: font, fontStyle: 'bold' },
        styles: { fontSize: 8, font: font },
      });

      const lastTable = (doc as any).lastAutoTable;
      let finalY = lastTable ? lastTable.finalY + 10 : 200;

      // Totals
      doc.setFontSize(10);
      doc.text(cleanText('Ara Toplam (Urun):'), 140, finalY + 5);
      doc.text(`$${calculatedTotalPrice.toLocaleString()}`, 190, finalY + 5, { align: 'right' });
      
      // If manual adjustment was made, show it
      if (Math.abs(manualTotalPrice - calculatedTotalPrice) > 1) {
        doc.text(cleanText('Teklif Revizyonu:'), 140, finalY + 12);
        doc.text(`$${(manualTotalPrice - calculatedTotalPrice).toLocaleString()}`, 190, finalY + 12, { align: 'right' });
        finalY += 7;
      }

      doc.setFont(font, 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text(cleanText('GENEL TOPLAM:'), 140, finalY + 12);
      doc.text(`$${manualTotalPrice.toLocaleString()}`, 190, finalY + 12, { align: 'right' });

      doc.save(`Teklif_${opportunity.title.replace(/\s+/g, '_')}_V${version}.pdf`);
    } catch (err) {
      console.error('PDF Generation failed:', err);
      alert('PDF hatası: ' + err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50 overflow-hidden font-geist">
      {/* Header */}
      <div className="p-6 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 bg-primary text-white rounded-[20px] flex items-center justify-center shadow-2xl shadow-primary/20 rotate-3 hover:rotate-0 transition-transform duration-500">
            <FileSignature size={28} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h4 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">Teklif Editörü</h4>
              <div className="px-3 py-1 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-lg shadow-black/10">
                <Hash size={10} strokeWidth={3} /> VERSİYON {version}
              </div>
            </div>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1 opacity-70">Karlılık ve Müşteri Sunumu Hazırlama</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="px-8 py-3.5 rounded-2xl text-xs font-black text-slate-400 hover:text-slate-800 transition-all uppercase tracking-widest">İptal</button>
          
          <button 
            onClick={generatePDF}
            disabled={isGenerating}
            className="px-8 py-3.5 bg-white border border-slate-200 text-slate-700 rounded-2xl text-xs font-black hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm active:scale-95 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
            PDF ÇIKTISI AL
          </button>

          <button
            onClick={() => {
              const cleanItems: BoMItem[] = items.map(item => ({
                id: item.id,
                partNumber: item.partNumber,
                description: item.description,
                quantity: item.quantity,
                purchaseCost: item.purchaseCost,
                marginPercentage: item.marginPercentage,
                unitSalePrice: item.unitSalePrice ?? (item.purchaseCost * (1 + item.marginPercentage / 100)),
                totalSalePrice: item.totalSalePrice ?? (item.purchaseCost * (1 + item.marginPercentage / 100) * item.quantity),
                vendor: item.vendor,
                source: item.source,
              }));
              onSave({
                opportunityId: opportunity.id,
                status: 'DRAFT',
                version,
                openForNegotiation,
                totalPrice: manualTotalPrice,
                items: cleanItems,
                content: JSON.stringify({ items: cleanItems, totalPrice: manualTotalPrice, description, terms }),
              });
            }}
            className="px-10 py-3.5 bg-primary text-white rounded-2xl text-xs font-black hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 flex items-center gap-2 active:scale-95 uppercase tracking-widest"
          >
            <Save size={16} />
            TEKLİFİ KAYDET
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Main Area */}
          <div className="lg:col-span-8 space-y-8">
            {/* BoM Table */}
            <div className="glass-panel rounded-[32px] overflow-hidden bg-white/40 border-white/60">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/10 text-indigo-600 rounded-xl flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <h5 className="font-black text-slate-900 uppercase italic tracking-widest text-sm">Ürün & Lisans Kalemleri</h5>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative group">
                    <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                    <input 
                      type="number" 
                      value={globalMargin}
                      onChange={(e) => setGlobalMargin(Number(e.target.value))}
                      className="bg-white pl-8 pr-4 py-2 border border-slate-200 rounded-xl text-xs font-black w-24 outline-none focus:ring-4 focus:ring-primary/5"
                    />
                  </div>
                  <button onClick={applyGlobalMargin} className="text-[10px] font-black text-primary hover:underline uppercase tracking-widest">Hepsine Uygula</button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest">Ürün Detayı</th>
                      <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-center w-24">Miktar</th>
                      <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-right w-32">Maliyet</th>
                      <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-center w-24">Marj %</th>
                      <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-right w-32">Birim Satış</th>
                      <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-right w-32">Toplam</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-white/60 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-mono font-bold text-indigo-600">{item.partNumber}</p>
                          <p className="font-medium text-slate-600 line-clamp-1">{item.description}</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <input 
                            type="number" 
                            value={item.quantity}
                            onChange={(e) => setItems(items.map(i => i.id === item.id ? { ...i, quantity: Number(e.target.value) } : i))}
                            className="w-12 bg-white/60 border border-slate-100 rounded-lg py-1 text-center font-bold"
                          />
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-500">${item.purchaseCost.toLocaleString()}</td>
                        <td className="px-6 py-4 text-center">
                          <input 
                            type="number" 
                            value={item.marginPercentage}
                            onChange={(e) => updateItemMargin(item.id, Number(e.target.value))}
                            className="w-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg py-1 text-center font-black"
                          />
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">${Math.round(item.salePrice).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-black text-slate-900">${Math.round(item.salePrice * item.quantity).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Terms & Description */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="glass-panel p-6 rounded-[32px] bg-white shadow-sm border border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-3 block">Teklif Özeti & Özel Notlar</label>
                <textarea 
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-100 rounded-[24px] p-5 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/5 transition-all resize-none leading-relaxed"
                />
              </div>
              <div className="glass-panel p-6 rounded-[32px] bg-white shadow-sm border border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-3 block">Ticari Şartlar & Koşullar</label>
                <textarea 
                  rows={6}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full bg-slate-50/50 border border-slate-100 rounded-[24px] p-5 text-sm font-medium outline-none focus:ring-4 focus:ring-primary/5 transition-all resize-none leading-relaxed"
                />
              </div>
            </div>
          </div>

          {/* Right Summary Panel */}
          <div className="lg:col-span-4 space-y-6">
            {/* Customer Box */}
            <div className="glass-panel p-8 rounded-[40px] bg-white/80">
              <h5 className="font-black text-slate-900 uppercase italic tracking-tighter text-lg mb-6 flex items-center gap-3">
                <Building size={20} className="text-primary" /> Müşteri Kartı
              </h5>
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Firma Adı</p>
                  <p className="text-sm font-black text-slate-900 leading-tight uppercase">{customer?.name}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Teklif Sorumlusu</p>
                  <p className="text-sm font-bold text-slate-700 leading-tight uppercase italic">{opportunity.assignedTo?.name || '-'}</p>
                </div>
              </div>
            </div>

            {/* Financial Cockpit */}
            <div className="glass-panel p-8 rounded-[40px] bg-slate-900 text-white shadow-2xl relative overflow-hidden">
              <div className="relative z-10">
                <h5 className="font-black uppercase italic tracking-tighter text-lg mb-8 flex items-center gap-3">
                  <DollarSign size={20} className="text-primary" /> Finansal Kokpit
                </h5>

                <div className="space-y-6">
                  <div className="flex justify-between items-center text-slate-400 border-b border-slate-800 pb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest">Ürün Maliyeti (BoM)</span>
                    <span className="font-mono text-sm">${totalBoMCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-amber-400 border-b border-slate-800 pb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest">Operasyonel Giderler</span>
                    <span className="font-mono text-sm">${totalOpsCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300 border-b border-slate-800 pb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest">Toplam Girdi Maliyeti</span>
                    <span className="font-mono text-sm font-black">${grandTotalCost.toLocaleString()}</span>
                  </div>

                  <div className="pt-4 flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/10 mb-4">
                    <div>
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">Pazarlığa Açık</span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">Yönetici pazarlık simülasyonuna açar</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={openForNegotiation}
                        onChange={(e) => setOpenForNegotiation(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                    </label>
                  </div>

                  <div className="pt-4">
                    <label className="text-[10px] font-black text-primary uppercase tracking-widest block mb-4">SON TEKLİF TUTARI (MANUEL)</label>
                    <div className="relative">
                      <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={24} />
                      <input 
                        type="number" 
                        value={manualTotalPrice}
                        onChange={(e) => setManualTotalPrice(Number(e.target.value))}
                        className="w-full bg-white/10 border-2 border-primary/30 rounded-[28px] py-6 pl-14 pr-8 text-4xl font-black italic tracking-tighter outline-none focus:border-primary transition-all text-white"
                      />
                    </div>
                  </div>

                  <div className={cn(
                    "mt-8 p-8 rounded-[32px] flex flex-col items-center justify-center gap-2 border-2",
                    realMargin >= 15 ? "bg-emerald-500/10 border-emerald-500/20" : realMargin >= 10 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20"
                  )}>
                    <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">GERÇEK PROJE MARJI</span>
                    <div className="flex items-baseline gap-1">
                      <span className={cn("text-5xl font-black italic tracking-tighter leading-none", realMargin >= 15 ? "text-emerald-400" : realMargin >= 10 ? "text-amber-400" : "text-red-400")}>
                        %{realMargin.toFixed(1)}
                      </span>
                    </div>
                    <p className={cn("text-xs font-bold mt-2 uppercase tracking-widest", netProfit >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {netProfit >= 0 ? `+ $${netProfit.toLocaleString()} NET KAR` : `- $${Math.abs(netProfit).toLocaleString()} ZARAR`}
                    </p>
                  </div>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
            </div>

            {/* Hint */}
            <div className="p-6 bg-primary/5 rounded-[32px] border border-primary/10 flex items-start gap-3 shadow-sm">
              <AlertCircle size={20} className="text-primary shrink-0 mt-0.5" />
              <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                <strong>PROFESYONEL İPUCU:</strong> Son teklif rakamını manuel girdiğinizde sistem otomatik olarak <strong>"Gerçek Marj"</strong> hesabını yapar. Bu hesaplamaya maliyet analizindeki tüm gizli giderler dahildir.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalEditor;

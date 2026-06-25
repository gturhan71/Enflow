import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSignature,
  Printer,
  Save,
  Plus,
  Percent,
  DollarSign,
  FileText,
  Building,
  Hash,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Opportunity, BoMItem, CostItem, Customer, Proposal } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Currency helpers ──────────────────────────────────────────────────────────
const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', TRY: '₺' };
const sym = (currency: string) => CURRENCY_SYMBOLS[currency] || currency;
const fmt = (n: number, currency: string) =>
  `${sym(currency)}${Math.round(n).toLocaleString('tr-TR')}`;

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
};

// Roboto (CDN) Windows-1252 encoding kullanır:
//   ö ü ç Ö Ü Ç → Latin-1 içinde (0x00-0xFF) → doğrudan render edilir ✓
//   ğ Ğ ş Ş ı İ → Latin-1 dışında (0x0100+)  → PDF'de görünmez ✗
// pdfSafe: sadece bu 6 karakteri dönüştürür, diğerlerini korur.
const pdfSafe = (t: string) =>
  t.replace(/İ/g, 'I').replace(/ı/g, 'i')
   .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
   .replace(/Ş/g, 'S').replace(/ş/g, 's');

// Tam fallback (font yoksa helvetica için tüm Türkçe → Latin)
const trToEn = (text: string) =>
  pdfSafe(text)
    .replace(/Ü/g, 'U').replace(/ü/g, 'u')
    .replace(/Ö/g, 'O').replace(/ö/g, 'o')
    .replace(/Ç/g, 'C').replace(/ç/g, 'c');

// ── Props ─────────────────────────────────────────────────────────────────────
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
    marginMode?: 'PER_ITEM' | 'PROJECT_WIDE';
    globalMargin?: number;
    currency?: string;
    openForNegotiation?: boolean;
  };
  onSave: (proposal: Omit<Proposal, 'id'>) => void;
  onCancel: () => void;
}

// BoM kalemleri çalışma zamanında maliyet analizinden türetilen salePrice/purchaseCostBase
// alanlarıyla zenginleştirilir (bkz. items useMemo). Bu alanlar BoMItem'da yok.
type PricedBoMItem = BoMItem & { salePrice: number; purchaseCostBase?: number };

// ── Component ─────────────────────────────────────────────────────────────────
const ProposalEditor = ({
  opportunity,
  bomItems,
  costItems,
  customers,
  version,
  initialData,
  onSave,
  onCancel,
}: ProposalEditorProps) => {
  const customer = customers.find(c => c.id === opportunity.customerId);

  // ── Maliyet analizinden döviz & kur bilgisi ───────────────────────────────
  const costConfig = opportunity.costConfig;

  const baseCurrency = initialData?.currency ?? costConfig?.baseCurrency ?? 'USD';
  const exchangeRates: Record<string, number> = costConfig?.rates ?? {};
  const currencySym = sym(baseCurrency);

  // Döviz dönüşüm helper
  const toBase = (amount: number, currency?: string): number => {
    if (!currency || currency === baseCurrency) return amount;
    return amount * (exchangeRates[currency] ?? 1);
  };

  // ── Marj modu ─────────────────────────────────────────────────────────────
  const [marginMode, setMarginMode] = useState<'PER_ITEM' | 'PROJECT_WIDE'>(
    initialData?.marginMode ?? costConfig?.marginMode ?? 'PER_ITEM'
  );
  const [globalMargin, setGlobalMargin] = useState(
    initialData?.globalMargin ?? costConfig?.globalMargin ?? 15
  );

  // ── BoM kalemleri ─────────────────────────────────────────────────────────
  const [items, setItems] = useState<BoMItem[]>(() => {
    // initialData.items mevcut olsa bile fiyatların güncel bomItems'dan gelmesi gerekir.
    // Kayıtlı teklif içeriği eski (kur uygulanmamış) fiyatlar içerebilir.
    // Strateji: bomItems'daki güncel unitSalePrice/currency ile initialData.items'ı merge et.
    const freshById: Record<string, BoMItem> = {};
    for (const b of bomItems) { if (b.id) freshById[b.id] = b; }

    const baseSource = (initialData?.items && initialData.items.length > 0)
      ? initialData.items
      : bomItems;

    // Her kayıtlı kalemi güncel BoM verisiyle besle (unitSalePrice ve currency her zaman güncel)
    const source = baseSource.map(item => {
      const fresh = freshById[item.id as string];
      if (!fresh) return item;
      return {
        ...item,
        unitSalePrice: fresh.unitSalePrice ?? item.unitSalePrice,
        currency: fresh.currency ?? item.currency,
        purchaseCost: fresh.purchaseCost,
        marginPercentage: fresh.marginPercentage,
      };
    });

    // Maliyet analizinde kullanılan marj modu — unitSalePrice'tan geriye costInBase hesaplamak için
    const initMarginMode = initialData?.marginMode ?? costConfig?.marginMode ?? 'PER_ITEM';

    return source.map(item => {
      // item.currency != baseCurrency ise kur bilgisi geçerliyse dönüştür
      const rate = (item.currency && item.currency !== baseCurrency)
        ? (exchangeRates[item.currency] ?? 0)
        : 1;
      const hasRate = rate > 0;

      let salePrice: number;
      let purchaseCostBase: number;

      if (item.unitSalePrice != null) {
        // unitSalePrice mevcut → maliyet analizi sırasında base currency'de hesaplandı, kur uygulandı
        salePrice = item.unitSalePrice;
        if (hasRate) {
          // Kur mevcut: purchaseCost × rate en doğru değeri verir
          // Kaydedilmiş eski purchaseCostBase'i KULLANMA — eski kayıtlarda ham döviz değeri olabilir
          purchaseCostBase = Math.round(item.purchaseCost * rate * 100) / 100;
        } else {
          // Kur yok: unitSalePrice'tan geriye hesapla
          const margin = item.marginPercentage ?? 0;
          purchaseCostBase = (initMarginMode === 'PER_ITEM' && margin > 0)
            ? Math.round(item.unitSalePrice / (1 + margin / 100) * 100) / 100
            : item.unitSalePrice;  // PROJECT_WIDE: unitSalePrice === costInBase
        }
      } else if (hasRate) {
        // Kur bilgisi mevcut — purchaseCost'u base currency'ye çevir
        const costInBase = item.purchaseCost * rate;
        const margin = item.marginPercentage ?? globalMargin;
        purchaseCostBase = Math.round(costInBase * 100) / 100;
        salePrice = Math.round(costInBase * (1 + margin / 100) * 100) / 100;
      } else {
        // Fallback: kur bilgisi yok — ham değer kullan
        purchaseCostBase = item.purchaseCost;
        const margin = item.marginPercentage ?? globalMargin;
        salePrice = Math.round(item.purchaseCost * (1 + margin / 100) * 100) / 100;
      }

      return { ...item, salePrice, purchaseCostBase } as BoMItem & { salePrice: number; purchaseCostBase: number };
    });
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [openForNegotiation, setOpenForNegotiation] = useState(
    initialData?.openForNegotiation ?? false
  );
  const [terms, setTerms] = useState(
    initialData?.terms ||
    `1. Teklif geçerlilik süresi 30 gündür.\n2. Ödeme vadesi fatura tarihinden itibaren 30 gündür.\n3. Fiyatlara KDV dahil değildir.\n4. Teslimat süresi stok durumuna göre 4-6 haftadır.`
  );
  const [description, setDescription] = useState(
    initialData?.description || 'Proje kapsamında ihtiyaç duyulan teknik donanım ve lisansları içeren fiyat teklifidir.'
  );

  // ── Hesaplamalar ──────────────────────────────────────────────────────────
  const totalBoMCostBase = useMemo(() =>
    items.reduce((s, i) => {
      const it = i as BoMItem & { purchaseCostBase?: number };
      return s + (it.purchaseCostBase ?? i.purchaseCost) * i.quantity;
    }, 0),
  [items]);

  const totalOpsCostBase = useMemo(() =>
    costItems.reduce((s, i) => s + toBase(Number(i.amount) || 0, i.currency), 0),
  [costItems, baseCurrency, exchangeRates]);

  const grandCostBase = totalBoMCostBase + totalOpsCostBase;

  // PER_ITEM: her kalemin salePrice'ından toplam
  const perItemTotal = useMemo(() =>
    items.reduce((s, i) => s + (i as PricedBoMItem).salePrice * i.quantity, 0),
  [items]);

  // PROJECT_WIDE: toplam maliyete tek marj
  const projectWideTotal = useMemo(
    () => grandCostBase * (1 + globalMargin / 100),
    [grandCostBase, globalMargin]
  );

  const calculatedTotalPrice = marginMode === 'PROJECT_WIDE' ? projectWideTotal : perItemTotal;

  const [manualTotalPrice, setManualTotalPrice] = useState<number>(
    initialData?.totalPrice || 0
  );

  useEffect(() => {
    if (!initialData?.totalPrice) {
      setManualTotalPrice(Math.round(calculatedTotalPrice));
    }
  }, [calculatedTotalPrice, initialData?.totalPrice]);

  // Marj modu değişince opsiyonlar sıfırlanır (PROJECT_WIDE: item salePrice'ları gizlenir)
  useEffect(() => {
    if (marginMode === 'PROJECT_WIDE') {
      setManualTotalPrice(Math.round(projectWideTotal));
    } else {
      setManualTotalPrice(Math.round(perItemTotal));
    }
  }, [marginMode, globalMargin]);

  const netProfit = manualTotalPrice - grandCostBase;
  const realMargin = manualTotalPrice > 0 ? (netProfit / manualTotalPrice) * 100 : 0;

  // ── Item handlers ─────────────────────────────────────────────────────────
  const applyGlobalMarginToItems = () => {
    setItems(items.map(item => {
      const it = item as BoMItem & { purchaseCostBase?: number; salePrice: number };
      const costInBase = it.purchaseCostBase ?? item.purchaseCost;
      return {
        ...item,
        marginPercentage: globalMargin,
        salePrice: Math.round(costInBase * (1 + globalMargin / 100) * 100) / 100,
      };
    }));
  };

  const updateItemMargin = (id: string, margin: number) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      const it = item as BoMItem & { purchaseCostBase?: number; salePrice: number };
      const costInBase = it.purchaseCostBase ?? item.purchaseCost;
      return {
        ...item,
        marginPercentage: margin,
        salePrice: Math.round(costInBase * (1 + margin / 100) * 100) / 100,
      };
    }));
  };

  // ── PDF ───────────────────────────────────────────────────────────────────
  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', putOnlyUsedFonts: true });
      const pageWidth = doc.internal.pageSize.getWidth();

      // CDN Roboto — Windows-1252 encoding ile text render'ı çalışır.
      // pdfSafe() Latin-1 dışı kalan 6 Türkçe karakter (ğ,Ğ,ş,Ş,ı,İ) dönüştürür;
      // ö, ü, ç, Ö, Ü, Ç Latin-1 içinde olduğundan korunur.
      let fontLoaded = false;
      try {
        const [regRes, boldRes] = await Promise.all([
          fetch('https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/Roboto-Regular.ttf'),
          fetch('https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/Roboto-Bold.ttf'),
        ]);
        if (regRes.ok && boldRes.ok) {
          const [regBuf, boldBuf] = await Promise.all([regRes.arrayBuffer(), boldRes.arrayBuffer()]);
          doc.addFileToVFS('Roboto-Regular.ttf', arrayBufferToBase64(regBuf));
          doc.addFileToVFS('Roboto-Bold.ttf', arrayBufferToBase64(boldBuf));
          doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
          doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
          doc.setFont('Roboto', 'normal');
          fontLoaded = true;
        }
      } catch { /* fallback: helvetica + trToEn */ }

      const font = fontLoaded ? 'Roboto' : 'helvetica';
      // Her iki durumda da pdfSafe veya trToEn ile güvenli string üret
      const ct = (t: string) => fontLoaded ? pdfSafe(t) : trToEn(t);

      doc.setFont(font);
      doc.setDrawColor(16, 185, 129);
      doc.setLineWidth(0.5);
      doc.line(20, 32, pageWidth - 20, 32);
      doc.setTextColor(16, 185, 129);
      doc.setFontSize(22);
      doc.setFont(font, 'bold');
      doc.text(ct('ENFLOW TEKNOLOJİ SİSTEMLERİ'), 20, 24);
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(9);
      doc.setFont(font, 'normal');
      doc.text(ct('Kurumsal Süreç Yönetimi ve Otomasyon | www.enflow.com'), 20, 29);

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(18);
      doc.setFont(font, 'bold');
      doc.text(ct('FİYAT TEKLİFİ'), 20, 50);
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.setFont(font, 'normal');
      doc.text(ct(`Teklif No: PR-${opportunity.id.slice(-6).toUpperCase()}-V${version}`), pageWidth - 20, 50, { align: 'right' });
      doc.text(ct(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`), pageWidth - 20, 55, { align: 'right' });
      doc.text(ct(`Döviz: ${baseCurrency}`), pageWidth - 20, 60, { align: 'right' });

      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(20, 65, 80, 35, 2, 2, 'D');
      doc.text(ct('MÜŞTERİ BİLGİLERİ'), 24, 71);
      doc.setFont(font, 'bold');
      doc.text(ct(customer?.name || 'Bilinmeyen Müşteri'), 24, 78);
      doc.setFont(font, 'normal');
      doc.text(ct(customer?.address || '-'), 24, 83, { maxWidth: 70 });
      doc.roundedRect(110, 65, 80, 35, 2, 2, 'D');
      doc.text(ct('PROJE BİLGİLERİ'), 114, 71);
      doc.setFont(font, 'bold');
      doc.text(ct(opportunity.title), 114, 78);
      doc.setFont(font, 'normal');
      doc.text(ct(`Versiyon: V${version}`), 114, 83);

      doc.setFontSize(10);
      doc.setFont(font, 'bold');
      doc.text(ct('Teklif Özeti ve Açıklama:'), 20, 115);
      doc.setFont(font, 'normal');
      doc.setFontSize(9);
      const descLines = doc.splitTextToSize(ct(description), pageWidth - 40);
      doc.text(descLines, 20, 122);

      const priceFmt = (n: number) => `${currencySym}${Math.round(n).toLocaleString('tr-TR')}`;

      const tableData = [
        ...items.map((item, i) => {
          const it = item as BoMItem & { salePrice: number };
          const unitPrice = marginMode === 'PROJECT_WIDE'
            ? (item as PricedBoMItem).purchaseCostBase ?? item.purchaseCost
            : it.salePrice;
          return [i + 1, ct(item.partNumber), ct(item.description), item.quantity, priceFmt(unitPrice), priceFmt(unitPrice * item.quantity)];
        }),
        ...costItems.map((item, i) => {
          const amtBase = toBase(Number(item.amount) || 0, item.currency);
          return [items.length + i + 1, ct(item.category || 'DİĞER'), ct(item.description || 'Operasyonel Gider'), 1, priceFmt(amtBase), priceFmt(amtBase)];
        }),
      ];

      // autoTable: font ve bodyStyles açıkça belirtilmeli — aksi hâlde Türkçe karakterler kaybolabilir
      autoTable(doc, {
        startY: 122 + descLines.length * 5 + 10,
        head: [[ct('#'), ct('P/N / Kategori'), ct('Açıklama'), ct('Adet'), ct('Birim Fiyat'), ct('Toplam')]],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [248, 250, 252], textColor: [30, 41, 59], font, fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, font },
        bodyStyles: { font },
        alternateRowStyles: { font },
      });

      const lastTable = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable;
      let finalY = lastTable ? lastTable.finalY + 10 : 200;

      doc.setFontSize(10);
      doc.text(ct('Toplam Maliyet:'), 140, finalY + 5);
      doc.text(priceFmt(grandCostBase), 190, finalY + 5, { align: 'right' });

      if (marginMode === 'PROJECT_WIDE') {
        doc.text(ct(`Kâr Marjı (%${globalMargin}):`), 140, finalY + 12);
        doc.text(priceFmt(manualTotalPrice - grandCostBase), 190, finalY + 12, { align: 'right' });
        finalY += 7;
      }

      doc.setFont(font, 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text(ct('GENEL TOPLAM:'), 140, finalY + 12);
      doc.text(priceFmt(manualTotalPrice), 190, finalY + 12, { align: 'right' });

      doc.save(`Teklif_${opportunity.title.replace(/\s+/g, '_')}_V${version}.pdf`);
    } catch (err) {
      alert('PDF hatası: ' + err);
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
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
              <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-widest">
                {baseCurrency}
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
              const cleanItems = items.map(item => ({
                id: item.id,
                partNumber: item.partNumber,
                description: item.description,
                quantity: item.quantity,
                purchaseCost: item.purchaseCost,
                marginPercentage: item.marginPercentage,
                currency: item.currency,
                unitSalePrice: (item as PricedBoMItem).salePrice ?? item.unitSalePrice,
                totalSalePrice: ((item as PricedBoMItem).salePrice ?? item.unitSalePrice ?? item.purchaseCost) * item.quantity,
                purchaseCostBase: (item as PricedBoMItem).purchaseCostBase,
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
                content: JSON.stringify({
                  items: cleanItems,
                  totalPrice: manualTotalPrice,
                  description,
                  terms,
                  marginMode,
                  globalMargin,
                  currency: baseCurrency,
                  openForNegotiation,
                }),
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

            {/* ── Kar Marjı Modu ─────────────────────────────────────────── */}
            <div className="glass-panel rounded-[32px] overflow-hidden bg-white/40">
              <div className="p-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                <div className="w-9 h-9 bg-emerald-500/10 text-emerald-600 rounded-xl flex items-center justify-center">
                  <Percent size={18} />
                </div>
                <h5 className="font-black text-slate-900 uppercase italic tracking-widest text-sm">Kar Marjı Modu</h5>
                <span className="ml-auto text-[10px] text-slate-400 font-bold">Maliyet analizi dövizi: <span className="text-primary font-black">{baseCurrency}</span></span>
              </div>
              <div className="p-6 flex flex-wrap items-end gap-8">
                {/* Mod toggle */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Marj Yöntemi</label>
                  <div className="flex rounded-2xl overflow-hidden border border-slate-200">
                    <button
                      onClick={() => setMarginMode('PER_ITEM')}
                      className={cn(
                        'px-5 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all',
                        marginMode === 'PER_ITEM' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'
                      )}
                    >
                      Kalem Bazında
                    </button>
                    <button
                      onClick={() => setMarginMode('PROJECT_WIDE')}
                      className={cn(
                        'px-5 py-2.5 text-[10px] font-black uppercase tracking-widest border-l border-slate-200 transition-all',
                        marginMode === 'PROJECT_WIDE' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'
                      )}
                    >
                      Proje Geneli
                    </button>
                  </div>
                </div>

                {/* Genel marj (PROJECT_WIDE) veya hepsine uygula (PER_ITEM) */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {marginMode === 'PROJECT_WIDE' ? 'Proje Marjı (%)' : 'Toplu Marj Uygula (%)'}
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                      <input
                        type="number"
                        value={globalMargin}
                        min={0}
                        max={100}
                        onChange={(e) => setGlobalMargin(parseFloat(e.target.value) || 0)}
                        className="bg-white pl-8 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-black w-28 outline-none focus:ring-4 focus:ring-primary/5"
                      />
                    </div>
                    {marginMode === 'PER_ITEM' && (
                      <button
                        onClick={applyGlobalMarginToItems}
                        className="text-[10px] font-black text-white bg-primary px-4 py-2.5 rounded-xl uppercase tracking-widest hover:bg-primary/90 transition-all"
                      >
                        Hepsine Uygula
                      </button>
                    )}
                    {marginMode === 'PROJECT_WIDE' && (
                      <div className="text-xs text-slate-500 font-medium">
                        {fmt(grandCostBase, baseCurrency)} × {(1 + globalMargin / 100).toFixed(2)} = <span className="font-black text-emerald-600">{fmt(projectWideTotal, baseCurrency)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── BoM Tablosu ───────────────────────────────────────────── */}
            <div className="glass-panel rounded-[32px] overflow-hidden bg-white/40 border-white/60">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-500/10 text-indigo-600 rounded-xl flex items-center justify-center">
                    <FileText size={20} />
                  </div>
                  <h5 className="font-black text-slate-900 uppercase italic tracking-widest text-sm">Ürün & Lisans Kalemleri</h5>
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {marginMode === 'PROJECT_WIDE' ? 'Maliyet fiyatları — marj proje genelinde' : 'Kalem bazında satış fiyatı'}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest">Ürün Detayı</th>
                      <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-center w-24">Miktar</th>
                      <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-right w-36">Maliyet ({baseCurrency})</th>
                      {marginMode === 'PER_ITEM' && (
                        <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-center w-24">Marj %</th>
                      )}
                      {marginMode === 'PER_ITEM' && (
                        <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-right w-36">Birim Satış</th>
                      )}
                      <th className="px-6 py-4 font-black text-slate-400 uppercase tracking-widest text-right w-36">
                        {marginMode === 'PROJECT_WIDE' ? `Toplam Maliyet` : 'Toplam Satış'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {items.map((item) => {
                      const it = item as BoMItem & { salePrice: number; purchaseCostBase?: number };
                      const costInBase = it.purchaseCostBase ?? item.purchaseCost;
                      const rowTotal = marginMode === 'PROJECT_WIDE'
                        ? costInBase * item.quantity
                        : it.salePrice * item.quantity;
                      return (
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
                          <td className="px-6 py-4 text-right font-medium text-slate-500">
                            {fmt(costInBase, baseCurrency)}
                          </td>
                          {marginMode === 'PER_ITEM' && (
                            <td className="px-6 py-4 text-center">
                              <input
                                type="number"
                                value={item.marginPercentage ?? 0}
                                onChange={(e) => updateItemMargin(item.id, Number(e.target.value))}
                                className="w-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-lg py-1 text-center font-black"
                              />
                            </td>
                          )}
                          {marginMode === 'PER_ITEM' && (
                            <td className="px-6 py-4 text-right font-bold text-slate-900">
                              {fmt(it.salePrice, baseCurrency)}
                            </td>
                          )}
                          <td className="px-6 py-4 text-right font-black text-slate-900">
                            {fmt(rowTotal, baseCurrency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Tedarikçi Değerlendirme & Uygunluk (Presales teklif değerlendirme snapshot'ı) */}
            {(() => {
              if (!opportunity.bomEvaluation) return null;
              let snap: { lines?: { componentName?: string | null; quoteCount: number; selected?: { vendorName: string; unitPrice: number; currency: string; technicalCompliance: string } | null }[]; totalQuotes?: number } | null = null;
              try { snap = JSON.parse(opportunity.bomEvaluation); } catch { return null; }
              if (!snap?.lines?.length) return null;
              const compLabel: Record<string, string> = { COMPLIANT: 'Uygun', PARTIAL: 'Kısmen Uygun', NON_COMPLIANT: 'Uygun Değil' };
              return (
                <div className="glass-panel p-6 rounded-[32px] bg-white shadow-sm border border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-3 block">Tedarikçi Değerlendirme & Teknik Uygunluk ({snap.totalQuotes ?? 0} teklif)</label>
                  <div className="space-y-2">
                    {snap.lines.map((ln, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{ln.componentName || 'Kalem'}</p>
                          <p className="text-[11px] text-slate-400">{ln.quoteCount} teklif değerlendirildi</p>
                        </div>
                        {ln.selected ? (
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-slate-900">{ln.selected.vendorName}</p>
                            <p className="text-[11px] text-slate-500">{ln.selected.unitPrice.toLocaleString('tr-TR')} {ln.selected.currency} · <span className="text-emerald-600 font-semibold">{compLabel[ln.selected.technicalCompliance] || ln.selected.technicalCompliance}</span></p>
                          </div>
                        ) : <span className="text-[11px] text-amber-600 font-semibold">Seçim yapılmadı</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

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
                    <span className="font-mono text-sm">{fmt(totalBoMCostBase, baseCurrency)}</span>
                  </div>
                  <div className="flex justify-between items-center text-amber-400 border-b border-slate-800 pb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest">Operasyonel Giderler</span>
                    <span className="font-mono text-sm">{fmt(totalOpsCostBase, baseCurrency)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300 border-b border-slate-800 pb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest">Toplam Girdi Maliyeti</span>
                    <span className="font-mono text-sm font-black">{fmt(grandCostBase, baseCurrency)}</span>
                  </div>

                  {marginMode === 'PROJECT_WIDE' && (
                    <div className="flex justify-between items-center text-emerald-400 border-b border-slate-800 pb-4">
                      <span className="text-[10px] font-black uppercase tracking-widest">Kar Marjı (%{globalMargin})</span>
                      <span className="font-mono text-sm">{fmt(projectWideTotal - grandCostBase, baseCurrency)}</span>
                    </div>
                  )}

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
                    <label className="text-[10px] font-black text-primary uppercase tracking-widest block mb-4">
                      SON TEKLİF TUTARI — {baseCurrency}
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary text-2xl font-black">{currencySym}</span>
                      <input
                        type="number"
                        value={manualTotalPrice}
                        onChange={(e) => setManualTotalPrice(Number(e.target.value))}
                        className="w-full bg-white/10 border-2 border-primary/30 rounded-[28px] py-6 pl-14 pr-8 text-4xl font-black italic tracking-tighter outline-none focus:border-primary transition-all text-white"
                      />
                    </div>
                  </div>

                  <div className={cn(
                    'mt-8 p-8 rounded-[32px] flex flex-col items-center justify-center gap-2 border-2',
                    realMargin >= 15 ? 'bg-emerald-500/10 border-emerald-500/20'
                    : realMargin >= 10 ? 'bg-amber-500/10 border-amber-500/20'
                    : 'bg-red-500/10 border-red-500/20'
                  )}>
                    <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">GERÇEK PROJE MARJI</span>
                    <span className={cn(
                      'text-5xl font-black italic tracking-tighter leading-none',
                      realMargin >= 15 ? 'text-emerald-400' : realMargin >= 10 ? 'text-amber-400' : 'text-red-400'
                    )}>
                      %{realMargin.toFixed(1)}
                    </span>
                    <p className={cn('text-xs font-bold mt-2 uppercase tracking-widest', netProfit >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                      {netProfit >= 0
                        ? `+ ${fmt(netProfit, baseCurrency)} NET KAR`
                        : `- ${fmt(Math.abs(netProfit), baseCurrency)} ZARAR`}
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
                <strong>İPUCU:</strong> Son teklif tutarını manuel düzenlediğinizde <strong>Gerçek Marj</strong> otomatik güncellenir. Tüm tutarlar <strong>{baseCurrency}</strong> cinsindendir.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalEditor;

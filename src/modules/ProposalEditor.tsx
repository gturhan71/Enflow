import React, { useState, useEffect } from 'react';
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
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Opportunity, BoMItem } from '../types';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ProposalEditorProps {
  opportunity: Opportunity;
  bomItems: BoMItem[];
  customers: any[];
  onSave: (proposal: any) => void;
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

const ProposalEditor = ({ opportunity, bomItems, customers, onSave, onCancel }: ProposalEditorProps) => {
  const customer = customers.find(c => c.id === opportunity.customerId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [items, setItems] = useState(bomItems.map(item => ({
    ...item,
    salePrice: item.purchaseCost * (1 + (item.marginPercentage || 15) / 100)
  })));
  
  const [globalMargin, setGlobalMargin] = useState(15);
  const [terms, setTerms] = useState(`1. Teklif geçerlilik süresi 30 gündür.
2. Ödeme vadesi fatura tarihinden itibaren 30 gündür.
3. Fiyatlara KDV dahil değildir.
4. Teslimat süresi stok durumuna göre 4-6 haftadır.`);
  const [description, setDescription] = useState('Proje kapsamında ihtiyaç duyulan teknik donanım ve lisansları içeren fiyat teklifidir.');

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

  const totalPrice = items.reduce((sum, item) => sum + (item.salePrice * item.quantity), 0);
  const totalCost = items.reduce((sum, item) => sum + (item.purchaseCost * item.quantity), 0);
  const totalMargin = ((totalPrice - totalCost) / (totalPrice || 1)) * 100;

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
      
      // Try loading Turkish-compatible font (Roboto) from a reliable CDN
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

      // Header / Letterhead - Minimalist & Professional
      doc.setDrawColor(79, 70, 229);
      doc.setLineWidth(0.5);
      doc.line(20, 32, pageWidth - 20, 32);
      
      doc.setTextColor(79, 70, 229);
      doc.setFontSize(22);
      doc.setFont(font, 'bold');
      doc.text(cleanText('TEKNOLOJİ SİSTEMLERİ A.Ş.'), 20, 24);
      
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(9);
      doc.setFont(font, 'normal');
      doc.text(cleanText('İnovasyon Merkezi, No:123, İstanbul | info@teknolojik.com | +90 212 555 0000'), 20, 29);

      // Proposal Title
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(18);
      doc.setFont(font, 'bold');
      doc.text(cleanText('FİYAT TEKLİFİ'), 20, 50);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.setFont(font, 'normal');
      doc.text(cleanText(`Teklif No: PR-${opportunity.id.replace('opp', '')}-${Date.now().toString().slice(-4)}`), pageWidth - 20, 50, { align: 'right' });
      doc.text(cleanText(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`), pageWidth - 20, 55, { align: 'right' });

      // Customer Info Box
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(20, 65, 80, 35, 2, 2, 'D');
      
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7);
      doc.setFont(font, 'bold');
      doc.text(cleanText('MÜŞTERİ BİLGİLERİ'), 24, 71);
      
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10);
      doc.setFont(font, 'bold');
      doc.text(cleanText(customer?.name || 'Bilinmeyen Müşteri'), 24, 78);
      
      doc.setFont(font, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(cleanText(customer?.address || 'Adres Kayıtlı Değil'), 24, 83, { maxWidth: 70 });
      doc.text(cleanText(`Yetkili: ${customer?.contactPerson || '-'}`), 24, 94);

      // Project Info Box
      doc.roundedRect(110, 65, 80, 35, 2, 2, 'D');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7);
      doc.setFont(font, 'bold');
      doc.text(cleanText('PROJE BİLGİLERİ'), 114, 71);
      
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10);
      doc.setFont(font, 'bold');
      doc.text(cleanText(opportunity.title), 114, 78);
      
      doc.setFont(font, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text(cleanText(`Satış Sorumlusu: Mehmet Öz`), 114, 83);
      doc.text(cleanText(`Ödeme Koşulu: 30 Gün Vadeli`), 114, 88);

      // Description Section
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.setFont(font, 'bold');
      doc.text(cleanText('Teklif Özeti ve Açıklama:'), 20, 115);
      
      doc.setFontSize(9);
      doc.setFont(font, 'normal');
      const descLines = doc.splitTextToSize(cleanText(description), pageWidth - 40);
      doc.text(descLines, 20, 122);

      // Table
      const tableData = items.map((item, index) => [
        index + 1,
        cleanText(item.partNumber),
        cleanText(item.description),
        item.quantity,
        `$${item.salePrice.toLocaleString()}`,
        `$${(item.salePrice * item.quantity).toLocaleString()}`
      ]);

      autoTable(doc, {
        startY: 122 + (descLines.length * 5) + 10,
        head: [[cleanText('#'), cleanText('P/N'), cleanText('Ürün Açıklaması'), cleanText('Adet'), cleanText('Birim Fiyat'), cleanText('Toplam')]],
        body: tableData,
        theme: 'grid',
        headStyles: { 
          fillColor: [248, 250, 252], 
          textColor: [30, 41, 59], 
          fontStyle: 'bold',
          font: font,
          lineWidth: 0.1,
          lineColor: [226, 232, 240]
        },
        styles: { 
          fontSize: 8, 
          font: font,
          cellPadding: 3
        },
        columnStyles: {
          3: { halign: 'center' },
          4: { halign: 'right' },
          5: { halign: 'right' }
        }
      });

      const lastTable = (doc as any).lastAutoTable;
      const finalY = lastTable ? lastTable.finalY + 10 : 200;

      // Financials Summary
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.setFont(font, 'normal');
      doc.text(cleanText('Ara Toplam:'), 140, finalY + 5);
      doc.setTextColor(30, 41, 59);
      doc.text(`$${totalPrice.toLocaleString()}`, 190, finalY + 5, { align: 'right' });
      
      doc.setTextColor(71, 85, 105);
      doc.text(cleanText('KDV (%20):'), 140, finalY + 12);
      doc.setTextColor(30, 41, 59);
      doc.text(`$${(totalPrice * 0.2).toLocaleString()}`, 190, finalY + 12, { align: 'right' });

      doc.setDrawColor(226, 232, 240);
      doc.line(135, finalY + 16, 195, finalY + 16);

      doc.setFontSize(12);
      doc.setFont(font, 'bold');
      doc.setTextColor(79, 70, 229);
      doc.text(cleanText('GENEL TOPLAM:'), 140, finalY + 24);
      doc.text(`$${(totalPrice * 1.2).toLocaleString()}`, 190, finalY + 24, { align: 'right' });

      // Terms & Conditions
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10);
      doc.setFont(font, 'bold');
      doc.text(cleanText('ŞARTLAR VE KOŞULLAR'), 20, finalY + 45);
      
      doc.setFontSize(8);
      doc.setFont(font, 'normal');
      doc.setTextColor(100, 116, 139);
      const termLines = doc.splitTextToSize(cleanText(terms), pageWidth - 40);
      doc.text(termLines, 20, finalY + 52);

      // Footer
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(cleanText('Bu teklif dijital olarak Enflow CRM üzerinden oluşturulmuştur. Tüm hakları saklıdır.'), pageWidth / 2, 285, { align: 'center' });

      doc.save(`Teklif_${opportunity.title.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error('PDF Generation failed:', err);
      alert('PDF oluşturulurken bir hata oluştu: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <FileSignature size={24} />
          </div>
          <div>
            <h4 className="text-xl font-bold text-slate-900">Teklif Oluşturma Ekranı</h4>
            <p className="text-sm text-slate-500">BoM verileri üzerinden marj ayarlı fiyat teklifi hazırlama.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onCancel}
            className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all"
          >
            İptal
          </button>
          <button 
            onClick={generatePDF}
            disabled={isGenerating}
            className="px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <Loader2 className="animate-spin" size={18} />
            ) : (
              <Printer size={18} />
            )}
            {isGenerating ? 'Hazırlanıyor...' : 'PDF & Yazdır'}
          </button>
          <button 
            onClick={() => onSave({ items, totalPrice, description, terms })}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center gap-2"
          >
            <Save size={18} />
            Teklifi Kaydet
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
        {/* Main Editor Area */}
        <div className="lg:col-span-8 flex flex-col gap-6 overflow-hidden">
          {/* Items Table */}
          <div className="glass-panel rounded-3xl flex flex-col overflow-hidden bg-white shadow-sm border border-slate-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <h5 className="font-bold text-slate-900 flex items-center gap-2">
                <FileText size={18} className="text-indigo-600" />
                Teklif Kalemleri
              </h5>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <Percent size={14} className="text-slate-400" />
                  <input 
                    type="number" 
                    value={globalMargin}
                    onChange={(e) => setGlobalMargin(Number(e.target.value))}
                    className="w-12 bg-transparent text-sm font-bold text-slate-700 outline-none"
                    placeholder="Margin"
                  />
                  <button 
                    onClick={applyGlobalMargin}
                    className="text-[10px] font-bold text-indigo-600 hover:underline"
                  >
                    Hepsine Uygula
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-4 font-bold text-slate-400 uppercase text-[10px]">Ürün Details</th>
                    <th className="px-5 py-4 font-bold text-slate-400 uppercase text-[10px] text-center w-24">Adet</th>
                    <th className="px-5 py-4 font-bold text-slate-400 uppercase text-[10px] text-right w-32">Maliyet</th>
                    <th className="px-5 py-4 font-bold text-slate-400 uppercase text-[10px] text-center w-28">Marj (%)</th>
                    <th className="px-5 py-4 font-bold text-slate-400 uppercase text-[10px] text-right w-36">Birim Satış</th>
                    <th className="px-5 py-4 font-bold text-slate-400 uppercase text-[10px] text-right w-36">Toplam</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-mono text-xs font-bold text-indigo-600">{item.partNumber}</p>
                        <p className="text-sm font-medium text-slate-900 mt-0.5">{item.description}</p>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <input 
                          type="number" 
                          value={item.quantity}
                          onChange={(e) => {
                            const qty = Number(e.target.value);
                            setItems(items.map(i => i.id === item.id ? { ...i, quantity: qty } : i));
                          }}
                          className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-bold outline-none focus:border-indigo-500"
                        />
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-slate-500">${item.purchaseCost.toLocaleString()}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center">
                          <input 
                            type="number" 
                            value={item.marginPercentage}
                            onChange={(e) => updateItemMargin(item.id, Number(e.target.value))}
                            className="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-center font-bold text-indigo-600 outline-none focus:border-indigo-500"
                          />
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-slate-900">${Math.round(item.salePrice).toLocaleString()}</td>
                      <td className="px-5 py-4 text-right font-black text-slate-900">${Math.round(item.salePrice * item.quantity).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Description & Terms */}
          <div className="grid grid-cols-2 gap-6">
            <div className="glass-panel rounded-3xl p-6 bg-white shadow-sm border border-slate-200">
              <label className="text-xs font-bold text-slate-400 uppercase mb-3 block">Teklif Açıklaması</label>
              <textarea 
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500 resize-none leading-relaxed"
                placeholder="Müşteriye özel açıklama girin..."
              />
            </div>
            <div className="glass-panel rounded-3xl p-6 bg-white shadow-sm border border-slate-200">
              <label className="text-xs font-bold text-slate-400 uppercase mb-3 block">Şartlar ve Koşullar</label>
              <textarea 
                rows={5}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:border-indigo-500 resize-none leading-relaxed"
                placeholder="Garanti, ödeme, teslimat şartları..."
              />
            </div>
          </div>
        </div>

        {/* Sidebar Summary */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Customer Summary */}
          <div className="glass-panel rounded-3xl p-6 bg-white shadow-sm border border-slate-200">
            <h5 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Building size={18} className="text-indigo-600" />
              Müşteri Özeti
            </h5>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 border border-slate-100">
                  <Building size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Firma</p>
                  <p className="text-sm font-bold text-slate-900">{customer?.name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 border border-slate-100">
                  <User size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">İlgili Kişi</p>
                  <p className="text-sm font-bold text-slate-900">{customer?.contactPerson}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 border border-slate-100">
                  <Calendar size={20} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Teklif Tarihi</p>
                  <p className="text-sm font-bold text-slate-900">{new Date().toLocaleDateString('tr-TR')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="glass-panel rounded-3xl p-6 bg-slate-900 text-white shadow-xl shadow-slate-200">
            <h5 className="font-bold mb-6 flex items-center gap-2">
              <DollarSign size={18} className="text-indigo-400" />
              Finansal Özet
            </h5>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-slate-400">
                <span className="text-xs font-bold uppercase">Toplam Maliyet</span>
                <span className="font-mono">${totalCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-indigo-400">
                <span className="text-xs font-bold uppercase">Ortalama Marj</span>
                <span className="font-bold">%{totalMargin.toFixed(1)}</span>
              </div>
              <div className="h-px bg-slate-800 my-4" />
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-white uppercase">Teklif Toplamı</span>
                <span className="text-2xl font-black text-indigo-400">${Math.round(totalPrice).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-slate-500">
                <span>KDV Dahil (%20)</span>
                <span>${Math.round(totalPrice * 1.2).toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="flex-1" />

          {/* Guidelines */}
          <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100 flex items-start gap-3">
            <Settings2 size={20} className="text-indigo-600 shrink-0" />
            <p className="text-xs text-indigo-700 leading-relaxed">
              <strong>İpucu:</strong> Sağ taraftaki marj kutucuklarını kullanarak her kalem için ayrı kâr oranı belirleyebilirsiniz. PDF butonu antetli kağıt formunda şık bir çıktı üretir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProposalEditor;

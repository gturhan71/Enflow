import React, { useState } from 'react';
import { 
  FileSearch,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  List,
  FileBarChart,
  BarChart3,
  ChevronRight,
  ShoppingCart
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as pdfjs from 'pdfjs-dist';
import { apiService } from '../services/apiService';
import { useAIGate } from '../contexts/AIGateContext';
import { AnalysisResult } from '../types';

// Configure PDF.js worker using a reliable CDN with modern mjs support
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

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

interface SpecAnalysisProps {
  opportunityId: string;
  onTransferToBoM?: (products: { pn: string, description: string, quantity: number }[]) => void;
}

const SpecAnalysis = ({ opportunityId, onTransferToBoM }: SpecAnalysisProps) => {
  const { requireAI } = useAIGate();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } else if (extension === 'xlsx' || extension === 'xls') {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer);
      let fullText = '';
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        fullText += XLSX.utils.sheet_to_txt(sheet);
      });
      return fullText;
    } else if (extension === 'pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        fullText += textContent.items.map((item) => (item as { str: string }).str).join(' ');
      }
      return fullText;
    } else {
      return '';
    }
  };

  const performAnalysis = async () => {
    if (files.length === 0) {
      setError('Lütfen analiz için en az bir dosya yükleyin.');
      return;
    }

    if (!opportunityId) {
      setError('Lütfen önce bir fırsat seçin.');
      return;
    }

    // YZ kapısı — entegre YZ yoksa popup açılır + Entegrasyonlar'a yönlendirir.
    if (!(await requireAI('Şartname analizi'))) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      let combinedText = '';
      for (const file of files) {
        const text = await extractTextFromFile(file);
        combinedText += `\n--- Dosya: ${file.name} ---\n${text}\n`;
      }

      if (combinedText.trim().length === 0) {
        throw new Error('Dosyalardan metin ayıklanamadı.');
      }

      // Analiz sunucuda yapılır — tenant'ın yapılandırdığı YZ (Entegrasyonlar),
      // sağlayıcıdan bağımsız. Metin ayıklama client'ta kaldı; API key client'a asla gelmez.
      const data = await apiService.presalesSpecExtract({ text: combinedText, opportunityId });
      if (!data.usedAI && (!data.extractedProducts || data.extractedProducts.length === 0)) {
        setError(data.summary || 'Yapay zeka entegrasyonu yapılandırılmadı. Ayarlar → Entegrasyonlar bölümünden bir YZ bağlayın.');
        return;
      }
      setResult({
        title: data.title,
        summary: data.summary,
        specDetails: data.specDetails,
        extractedProducts: data.extractedProducts,
      });
    } catch {
      setError('Analiz sırasında bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const exportToPDF = async () => {
    if (!result) return;
    setIsExporting(true);

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

      // Title
      doc.setFont(font, 'bold');
      doc.setFontSize(20);
      doc.setTextColor(79, 70, 229);
      doc.text(cleanText('Teknik Şartname Analiz Raporu'), pageWidth / 2, 20, { align: 'center' });

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(14);
      doc.text(cleanText(`Başlık: ${result.title}`), 20, 40);

      doc.setFont(font, 'bold');
      doc.setFontSize(12);
      doc.text(cleanText('Özet:'), 20, 55);
      
      doc.setFont(font, 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const summaryLines = doc.splitTextToSize(cleanText(result.summary), pageWidth - 40);
      doc.text(summaryLines, 20, 62);

      let currentY = 62 + (summaryLines.length * 6);

      doc.setFont(font, 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text(cleanText('Teknik Detaylar:'), 20, currentY + 10);
      
      doc.setFont(font, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      const detailLines = doc.splitTextToSize(cleanText(result.specDetails), pageWidth - 40);
      doc.text(detailLines, 20, currentY + 17);

      currentY += 17 + (detailLines.length * 5);

      doc.setFont(font, 'bold');
      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text(cleanText('Çıkartılan Ürün Listesi:'), 20, currentY + 10);

      const tableData = result.extractedProducts.map(p => [
        cleanText(p.pn), 
        cleanText(p.description), 
        p.quantity.toString()
      ]);
      
      autoTable(doc, {
        startY: currentY + 15,
        head: [[cleanText('Part Number'), cleanText('Açıklama'), cleanText('Adet')]],
        body: tableData,
        theme: 'grid',
        headStyles: { 
          fillColor: [79, 70, 229], 
          font: font, 
          fontStyle: 'bold' 
        },
        styles: { 
          font: font, 
          fontSize: 8 
        }
      });

      doc.save(`Analiz_Raporu_${opportunityId}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('PDF oluşturulurken bir hata oluştu: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 overflow-hidden">
        {/* Left: Configuration & Upload */}
        <div className="glass-panel rounded-3xl flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <FileSearch size={20} className="text-indigo-600" />
              Şartname Analiz Yapılandırması
            </h4>
          </div>
          <div className="p-8 space-y-8 flex-1 overflow-y-auto">
            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <Upload size={16} />
                Dosyaları Yükleyin (Word, Excel, PDF)
              </label>
              <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer relative group">
                <input 
                  type="file" 
                  multiple 
                  accept=".pdf,.docx,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                    <FileText size={32} />
                  </div>
                  {files.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-slate-900">{files.length} dosya seçildi</p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {files.map((f, i) => (
                          <span key={i} className="text-[10px] bg-white px-2 py-1 rounded-md border border-slate-200 text-slate-600">
                            {f.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-slate-600">Dosyaları buraya sürükleyin veya tıklayın</p>
                      <p className="text-xs text-slate-400">Desteklenen formatlar: .docx, .xlsx, .pdf</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                <AlertCircle size={18} className="text-red-500 mt-0.5" />
                <p className="text-xs text-red-700 font-medium">{error}</p>
              </div>
            )}

            <button 
              onClick={performAnalysis}
              disabled={isAnalyzing || files.length === 0}
              className={cn(
                "w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl",
                isAnalyzing || files.length === 0 
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none" 
                  : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
              )}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  Şartname Analiz Ediliyor...
                </>
              ) : (
                <>
                  <FileBarChart size={20} />
                  Analizi Başlat
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Results */}
        <div className="glass-panel rounded-3xl flex flex-col overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 size={20} className="text-indigo-600" />
              Analiz Sonuçları
            </h4>
            <div className="flex items-center gap-2">
              {result && onTransferToBoM && (
                <button 
                  onClick={() => {
                    setIsTransferring(true);
                    setTimeout(() => {
                      onTransferToBoM(result.extractedProducts);
                      setIsTransferring(false);
                    }, 1000);
                  }}
                  disabled={isTransferring}
                  className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-100 disabled:opacity-50"
                >
                  {isTransferring ? <Loader2 size={14} className="animate-spin" /> : <ShoppingCart size={14} />}
                  {isTransferring ? 'Aktarılıyor...' : 'BoM\'a Aktar'}
                </button>
              )}
              {result && (
                <button 
                  onClick={exportToPDF}
                  disabled={isExporting}
                  className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-50"
                >
                  {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {isExporting ? 'Hazırlanıyor...' : 'PDF Olarak İndir'}
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-8">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  <div className="space-y-4">
                    <h5 className="text-lg font-bold text-slate-900 border-l-4 border-indigo-600 pl-4">
                      {result.title}
                    </h5>
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Genel Özet</p>
                      <p className="text-sm text-slate-600 border border-slate-100 bg-slate-50/50 rounded-2xl p-4 leading-relaxed">
                        {result.summary}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Teknik Detaylar</p>
                      <p className="text-sm text-slate-600 border border-slate-100 bg-slate-50/50 rounded-2xl p-4 leading-relaxed">
                        {result.specDetails}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <List size={14} />
                      Çıkartılan Ürün Listesi
                    </p>
                    <div className="space-y-3">
                      {result.extractedProducts.map((p, i) => (
                        <div key={i} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-indigo-300 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold text-xs">
                              {i + 1}
                            </div>
                            <div>
                              <p className="text-xs font-mono font-bold text-indigo-600">{p.pn}</p>
                              <p className="text-sm text-slate-900 font-medium">{p.description}</p>
                            </div>
                          </div>
                          <div className="bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                            <span className="text-xs text-slate-400 mr-2 uppercase">Adet:</span>
                            <span className="text-sm font-bold text-slate-900">{p.quantity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 space-y-4">
                  <FileBarChart size={64} className="mb-2" />
                  <p className="text-lg font-medium">Birim analizi henüz yapılmadı.</p>
                  <p className="text-sm text-center max-w-xs">Şartnameleri yükleyin ve "Analizi Başlat" butonuna basarak teknik detayları ve ürün listesini çıkartın.</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpecAnalysis;

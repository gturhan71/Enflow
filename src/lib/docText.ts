// Enflow — Tarayıcıda belge metni çıkarımı (ortak yardımcı)
// ─────────────────────────────────────────────────────────────────────────────
// Word (.docx) / Excel (.xlsx/.xls) / PDF dosyalarından düz metin çıkarır.
// Eskiden yalnız SpecAnalysis.tsx içinde yerel bir fonksiyondu; Şartname↔Ürün
// Uygunluk ekranı da aynı çıkarımı kullandığından buraya taşındı (DRY).
//
// API key / YZ çağrısı burada YOK — yalnız client-side metin ayıklama.

import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import * as pdfjs from 'pdfjs-dist';

// PDF.js worker — modern .mjs desteği olan güvenilir bir CDN.
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

/** Tek bir dosyadan düz metin çıkarır. Desteklenmeyen uzantı → boş string. */
export const extractTextFromFile = async (file: File): Promise<string> => {
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
      fullText += textContent.items.map((item) => (item as { str: string }).str).join(' ') + '\n';
    }
    return fullText;
  }
  return '';
};

/** Birden çok dosyayı ayıklayıp dosya-adı başlıklı tek metinde birleştirir. */
export const extractCombinedText = async (files: File[]): Promise<string> => {
  let combined = '';
  for (const file of files) {
    const text = await extractTextFromFile(file);
    combined += `\n--- Dosya: ${file.name} ---\n${text}\n`;
  }
  return combined;
};

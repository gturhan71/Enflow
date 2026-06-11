import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Proposal, Opportunity, Customer } from '../types';

const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return window.btoa(binary);
};

const trToEn = (text: string): string =>
  text
    .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U').replace(/ü/g, 'u')
    .replace(/Ş/g, 'S').replace(/ş/g, 's')
    .replace(/İ/g, 'I').replace(/ı/g, 'i')
    .replace(/Ö/g, 'O').replace(/ö/g, 'o')
    .replace(/Ç/g, 'C').replace(/ç/g, 'c');

interface ContentItem {
  partNumber?: string;
  description?: string;
  quantity?: number;
  salePrice?: number;
  unitSalePrice?: number;
  totalSalePrice?: number;
  purchaseCost?: number;
  marginPercentage?: number;
}

interface ParsedContent {
  items?: ContentItem[];
  totalPrice?: number;
  description?: string;
  terms?: string;
  version?: number;
}

const parseContent = (raw: string | Record<string, unknown> | undefined): ParsedContent => {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return {}; }
  }
  return raw as ParsedContent;
};

export const generateProposalPDF = async (
  proposal: Proposal,
  opportunity: Opportunity,
  customer?: Customer | null
): Promise<void> => {
  const content = parseContent(proposal.content as string | Record<string, unknown> | undefined);
  const items: ContentItem[] = content.items || [];
  const totalPrice: number = content.totalPrice ?? proposal.totalPrice ?? 0;
  const description: string = content.description ?? proposal.description ?? '';
  const terms: string = content.terms ?? proposal.terms ?? '';
  const version: number = content.version ?? proposal.version ?? 1;
  const currency = customer?.currency || 'TRY';

  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', putOnlyUsedFonts: true });
  const pageWidth = doc.internal.pageSize.getWidth();

  let fontLoaded = false;
  let font = 'helvetica';

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
      doc.setFont('Roboto');
      font = 'Roboto';
      fontLoaded = true;
    }
  } catch { /* fallback to helvetica */ }

  const clean = (t: string) => (fontLoaded ? t : trToEn(t));
  const fmt = (n: number) => `${n.toLocaleString('tr-TR')} ${currency}`;

  // ── Header ────────────────────────────────────────────────
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.5);
  doc.line(20, 32, pageWidth - 20, 32);

  doc.setTextColor(16, 185, 129);
  doc.setFontSize(22);
  doc.setFont(font, 'bold');
  doc.text(clean('ENFLOW TEKNOLOJI SISTEMLERI'), 20, 24);

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(9);
  doc.setFont(font, 'normal');
  doc.text(clean('Kurumsal Surec Yonetimi ve Otomasyon | www.enflow.com'), 20, 29);

  // ── Teklif başlığı ────────────────────────────────────────
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(18);
  doc.setFont(font, 'bold');
  doc.text(clean('FIYAT TEKLIFI'), 20, 50);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.setFont(font, 'normal');
  doc.text(clean(`Teklif No: PR-${proposal.id.slice(-6).toUpperCase()}-V${version}`), pageWidth - 20, 50, { align: 'right' });
  doc.text(clean(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`), pageWidth - 20, 55, { align: 'right' });
  doc.text(clean(`Durum: ONAYLANDI`), pageWidth - 20, 60, { align: 'right' });

  // ── Info boxes ────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setDrawColor(226, 232, 240);

  doc.roundedRect(20, 68, 80, 32, 2, 2, 'D');
  doc.text(clean('MUSTERI BILGILERI'), 24, 74);
  doc.setFont(font, 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(clean(customer?.name || 'Musteri'), 24, 80);
  doc.setFont(font, 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(clean(customer?.city || customer?.address || '-'), 24, 85, { maxWidth: 70 });
  doc.text(clean(`VKN: ${customer?.taxNumber || '-'}`), 24, 90);

  doc.roundedRect(110, 68, 80, 32, 2, 2, 'D');
  doc.text(clean('PROJE BILGILERI'), 114, 74);
  doc.setFont(font, 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(clean(opportunity.title), 114, 80, { maxWidth: 72 });
  doc.setFont(font, 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(clean(`Versiyon: V${version}`), 114, 90);

  // ── Açıklama ──────────────────────────────────────────────
  let cursorY = 115;
  if (description) {
    doc.setFontSize(10);
    doc.setFont(font, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(clean('Teklif Ozeti:'), 20, cursorY);
    doc.setFont(font, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const descLines = doc.splitTextToSize(clean(description), pageWidth - 40);
    doc.text(descLines, 20, cursorY + 6);
    cursorY += 6 + descLines.length * 5 + 4;
  }

  // ── Kalemler tablosu ──────────────────────────────────────
  const tableRows = items.map((item, i) => {
    const unitPrice = item.salePrice ?? item.unitSalePrice ?? (item.purchaseCost ?? 0) * (1 + (item.marginPercentage ?? 0) / 100);
    const qty = item.quantity ?? 1;
    const lineTotal = item.totalSalePrice ?? unitPrice * qty;
    return [
      i + 1,
      clean(item.partNumber || '-'),
      clean(item.description || '-'),
      qty,
      fmt(Math.round(unitPrice)),
      fmt(Math.round(lineTotal)),
    ];
  });

  autoTable(doc, {
    startY: cursorY + 4,
    head: [[clean('#'), clean('P/N'), clean('Aciklama'), clean('Adet'), clean('Birim'), clean('Toplam')]],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [248, 250, 252], textColor: [30, 41, 59], font, fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8, font },
    columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 24 }, 3: { halign: 'center', cellWidth: 12 }, 4: { halign: 'right' }, 5: { halign: 'right' } },
  });

  const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  let finalY = lastTable ? lastTable.finalY + 10 : cursorY + 80;

  // ── Toplam kutusu ─────────────────────────────────────────
  doc.setFillColor(15, 23, 42);
  doc.roundedRect(110, finalY, 80, 18, 3, 3, 'F');
  doc.setFont(font, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text(clean('GENEL TOPLAM'), 116, finalY + 7);
  doc.setFont(font, 'bold');
  doc.setFontSize(13);
  doc.setTextColor(52, 211, 153);
  doc.text(fmt(Math.round(totalPrice)), 188, finalY + 13, { align: 'right' });

  // ── Şartlar ───────────────────────────────────────────────
  if (terms) {
    finalY += 28;
    if (finalY > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      finalY = 20;
    }
    doc.setFontSize(10);
    doc.setFont(font, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(clean('Sartlar & Kosullar'), 20, finalY);
    doc.setFont(font, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const termLines = doc.splitTextToSize(clean(terms), pageWidth - 40);
    doc.text(termLines, 20, finalY + 6);
  }

  // ── Footer ────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont(font, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      clean(`Enflow Teknoloji • Bu teklif gizlidir • Sayfa ${p}/${pageCount}`),
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  const safeName = opportunity.title.replace(/[^a-z0-9]/gi, '_').slice(0, 40);
  doc.save(`Teklif_${safeName}_V${version}_ONAYLANDI.pdf`);
};

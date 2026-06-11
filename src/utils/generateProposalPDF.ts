import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Proposal, Opportunity, Customer } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Sayıyı Türkçe yazıya çevirme ─────────────────────────────────────────────

const ONES  = ['', 'bir', 'iki', 'üç', 'dört', 'beş', 'altı', 'yedi', 'sekiz', 'dokuz'];
const TENS  = ['', 'on', 'yirmi', 'otuz', 'kırk', 'elli', 'altmış', 'yetmiş', 'seksen', 'doksan'];

const convertChunk = (n: number): string => {
  if (n === 0) return '';
  if (n < 10) return ONES[n];
  if (n < 100) {
    const t = TENS[Math.floor(n / 10)];
    const o = n % 10 ? ' ' + ONES[n % 10] : '';
    return t + o;
  }
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const hStr = h === 1 ? 'yüz' : ONES[h] + ' yüz';
  return rest ? hStr + ' ' + convertChunk(rest) : hStr;
};

const numberToTurkish = (n: number): string => {
  if (n === 0) return 'sıfır';
  const parts: string[] = [];
  if (n >= 1_000_000_000) {
    parts.push(convertChunk(Math.floor(n / 1_000_000_000)) + ' milyar');
    n %= 1_000_000_000;
  }
  if (n >= 1_000_000) {
    parts.push(convertChunk(Math.floor(n / 1_000_000)) + ' milyon');
    n %= 1_000_000;
  }
  if (n >= 1000) {
    const thousands = Math.floor(n / 1000);
    parts.push(thousands === 1 ? 'bin' : convertChunk(thousands) + ' bin');
    n %= 1000;
  }
  if (n > 0) parts.push(convertChunk(n));
  return parts.join(' ');
};

const CURRENCY_WORDS: Record<string, string> = {
  TRY: 'Türk Lirası',
  USD: 'Amerikan Doları',
  EUR: 'Avro',
};

// ── Content parser ────────────────────────────────────────────────────────────

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
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
  return raw as ParsedContent;
};

// ── lastAutoTable helper ──────────────────────────────────────────────────────

const getLastY = (doc: jsPDF, fallback: number): number =>
  ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY) ?? fallback;

// ── Main export ───────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 15;

export const generateProposalPDF = async (
  proposal: Proposal,
  opportunity: Opportunity,
  customer?: Customer | null,
): Promise<void> => {
  const content     = parseContent(proposal.content as string | Record<string, unknown> | undefined);
  const items       = content.items ?? [];
  const totalPrice  = content.totalPrice ?? proposal.totalPrice ?? 0;
  const description = content.description ?? proposal.description ?? '';
  const terms       = content.terms ?? proposal.terms ?? '';
  const version     = content.version ?? proposal.version ?? 1;
  const currency    = customer?.currency ?? 'TRY';
  const fmt         = (n: number) => `${n.toLocaleString('tr-TR')} ${currency}`;

  const doc       = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', putOnlyUsedFonts: true });
  const pageW     = doc.internal.pageSize.getWidth();
  const pageH     = doc.internal.pageSize.getHeight();

  // ── Font yükleme ────────────────────────────────────────────────────────────
  let fontLoaded = false;
  let font       = 'helvetica';
  try {
    const [regRes, boldRes] = await Promise.all([
      fetch('https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/Roboto-Regular.ttf'),
      fetch('https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/Roboto-Bold.ttf'),
    ]);
    if (regRes.ok && boldRes.ok) {
      const [rb, bb] = await Promise.all([regRes.arrayBuffer(), boldRes.arrayBuffer()]);
      doc.addFileToVFS('Roboto-Regular.ttf', arrayBufferToBase64(rb));
      doc.addFileToVFS('Roboto-Bold.ttf', arrayBufferToBase64(bb));
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
      doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
      doc.setFont('Roboto');
      font = 'Roboto';
      fontLoaded = true;
    }
  } catch { /* helvetica fallback */ }

  const clean = (t: string) => (fontLoaded ? t : trToEn(t ?? ''));

  // ── Sayfa 1 header ──────────────────────────────────────────────────────────
  const drawPageHeader = (isFirstPage: boolean) => {
    if (!isFirstPage) return;
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.5);
    doc.line(20, 32, pageW - 20, 32);

    doc.setTextColor(16, 185, 129);
    doc.setFontSize(22);
    doc.setFont(font, 'bold');
    doc.text(clean('ENFLOW TEKNOLOJI SISTEMLERI'), 20, 24);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.setFont(font, 'normal');
    doc.text(clean('Kurumsal Surec Yonetimi ve Otomasyon | www.enflow.com'), 20, 29);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(18);
    doc.setFont(font, 'bold');
    doc.text(clean('FIYAT TEKLIFI'), 20, 50);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.setFont(font, 'normal');
    doc.text(clean(`Teklif No: PR-${proposal.id.slice(-6).toUpperCase()}-V${version}`), pageW - 20, 50, { align: 'right' });
    doc.text(clean(`Tarih: ${new Date().toLocaleDateString('tr-TR')}`), pageW - 20, 55, { align: 'right' });
    doc.text(clean('Durum: ONAYLANDI'), pageW - 20, 60, { align: 'right' });

    // Müşteri & proje kutuları
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
  };

  drawPageHeader(true);

  // ── Açıklama ────────────────────────────────────────────────────────────────
  let cursorY = 115;
  if (description) {
    doc.setFontSize(10);
    doc.setFont(font, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(clean('Teklif Ozeti:'), 20, cursorY);
    doc.setFont(font, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const lines = doc.splitTextToSize(clean(description), pageW - 40);
    doc.text(lines, 20, cursorY + 6);
    cursorY += 6 + lines.length * 5 + 4;
  }

  // ── Kalem tabloları — sayfa başına max 15 satır ─────────────────────────────
  const TABLE_HEAD = [[
    clean('#'), clean('P/N'), clean('Aciklama'), clean('Adet'), clean('Birim Fiyat'), clean('Toplam'),
  ]];

  const COL_STYLES = {
    0: { cellWidth: 8 },
    1: { cellWidth: 24 },
    3: { halign: 'center' as const, cellWidth: 12 },
    4: { halign: 'right' as const },
    5: { halign: 'right' as const },
  };

  const tableRows = items.map((item, i) => {
    const unit  = item.salePrice ?? item.unitSalePrice ?? (item.purchaseCost ?? 0) * (1 + (item.marginPercentage ?? 0) / 100);
    const qty   = item.quantity ?? 1;
    const total = item.totalSalePrice ?? unit * qty;
    return [
      i + 1,
      clean(item.partNumber || '-'),
      clean(item.description || '-'),
      qty,
      fmt(Math.round(unit)),
      fmt(Math.round(total)),
    ];
  });

  // Chunk'lara böl
  const chunks: (typeof tableRows)[] = [];
  for (let i = 0; i < tableRows.length; i += ITEMS_PER_PAGE) {
    chunks.push(tableRows.slice(i, i + ITEMS_PER_PAGE));
  }
  if (chunks.length === 0) chunks.push([]); // boş teklif için güvenli fallback

  let tableEndY = cursorY + 4;

  chunks.forEach((chunk, idx) => {
    autoTable(doc, {
      startY: tableEndY,
      head: TABLE_HEAD,
      body: chunk,
      theme: 'grid',
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: [30, 41, 59],
        font,
        fontStyle: 'bold',
        fontSize: 8,
        lineColor: [226, 232, 240],
        lineWidth: 0.3,
      },
      styles: { fontSize: 8, font, lineColor: [226, 232, 240], lineWidth: 0.2 },
      bodyStyles: { fillColor: [255, 255, 255], textColor: [71, 85, 105] },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      columnStyles: COL_STYLES,
      pageBreak: 'avoid', // autoTable kendi sayfa eklemesine izin verme — biz yönetiyoruz
    });

    tableEndY = getLastY(doc, tableEndY + chunk.length * 7 + 20);

    // Sonraki chunk için yeni sayfa aç
    if (idx < chunks.length - 1) {
      doc.addPage();
      tableEndY = 20;
    }
  });

  // ── Toplam satırları (beyaz arka plan, sadece label+rakam bold) ──────────────
  const W     = [255, 255, 255] as [number, number, number];
  const LABEL_NORMAL = { fillColor: W, textColor: [100, 116, 139] as [number,number,number], fontStyle: 'normal' as const, font, fontSize: 9, halign: 'right' as const };
  const LABEL_BOLD   = { fillColor: W, textColor: [30,  41,  59] as [number,number,number], fontStyle: 'bold'   as const, font, fontSize: 10, halign: 'right' as const };
  const AMT_NORMAL   = { fillColor: W, textColor: [30,  41,  59] as [number,number,number], fontStyle: 'bold'   as const, font, fontSize: 9,  halign: 'right' as const };
  const AMT_GRAND    = { fillColor: W, textColor: [16, 185, 129] as [number,number,number], fontStyle: 'bold'   as const, font, fontSize: 11, halign: 'right' as const };

  autoTable(doc, {
    startY: tableEndY + 4,
    tableWidth: 100,
    margin: { left: pageW - 100 - 20 },
    body: [
      [
        { content: clean('Ara Toplam'), styles: LABEL_NORMAL },
        { content: fmt(Math.round(totalPrice)), styles: AMT_NORMAL },
      ],
      [
        { content: clean('KDV (%)'), styles: LABEL_NORMAL },
        { content: '—', styles: { ...AMT_NORMAL, textColor: [100, 116, 139] as [number,number,number] } },
      ],
      [
        { content: clean('GENEL TOPLAM'), styles: LABEL_BOLD },
        { content: fmt(Math.round(totalPrice)), styles: AMT_GRAND },
      ],
    ],
    theme: 'plain',
    styles: { font, fontSize: 9, lineColor: [226, 232, 240], lineWidth: 0.3 },
    columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 50 } },
  });

  const totalsEndY = getLastY(doc, tableEndY + 40);

  // ── Yazıyla ──────────────────────────────────────────────────────────────────
  const rounded  = Math.round(totalPrice);
  const inWords  = numberToTurkish(rounded);
  const currWord = CURRENCY_WORDS[currency] ?? currency;
  const wordsLine = clean(`Yazıyla: ${inWords} ${currWord}`);

  const needsNewPage = totalsEndY + 16 > pageH - 20;
  if (needsNewPage) { doc.addPage(); }

  const wordsY = needsNewPage ? 25 : totalsEndY + 6;
  doc.setFont(font, 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(wordsLine, 20, wordsY, { maxWidth: pageW - 40 });

  // ── Şartlar ──────────────────────────────────────────────────────────────────
  if (terms) {
    const termsY = wordsY + 14;
    const termsNeedsPage = termsY > pageH - 40;
    if (termsNeedsPage) { doc.addPage(); }
    const ty = termsNeedsPage ? 20 : termsY;

    doc.setFontSize(10);
    doc.setFont(font, 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(clean('Sartlar & Kosullar'), 20, ty);
    doc.setFont(font, 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const termLines = doc.splitTextToSize(clean(terms), pageW - 40);
    doc.text(termLines, 20, ty + 6);
  }

  // ── Sayfa altbilgisi ──────────────────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont(font, 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      clean(`Enflow Teknoloji • Bu teklif gizlidir • Sayfa ${p}/${total}`),
      pageW / 2, pageH - 8, { align: 'center' },
    );
  }

  const safeName = opportunity.title.replace(/[^a-z0-9çğıöşü]/gi, '_').slice(0, 40);
  doc.save(`Teklif_${safeName}_V${version}_ONAYLANDI.pdf`);
};

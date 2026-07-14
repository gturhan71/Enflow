// Enflow — Güvenli dosya yükleme yardımcısı (paylaşımlı multer fabrikası).
// ─────────────────────────────────────────────────────────────────────────────
// Tüm yükleme route'ları bunu kullanır. Amaç:
//  - Yalnız beyaz-listedeki iş dokümanı / görsel türlerine izin ver (hem uzantı
//    hem MIME kontrolü) → çalıştırılabilir/HTML/SVG yükleyip depolanmış XSS'i engelle.
//  - Boyut sınırı uygula (DoS azaltımı).
// NOT: Yüklenen dosyalar ayrıca statik serviste `Content-Disposition: attachment`
// + `X-Content-Type-Options: nosniff` ile sunulur (index.ts) — ikinci savunma katmanı.
import multer from 'multer';
import path from 'path';
import type { Request } from 'express';

const ALLOWED_EXT = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.rtf', '.odt', '.ods',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tif', '.tiff',
  '.zip',
]);

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/rtf', 'text/rtf',
  'text/plain', 'text/csv',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff',
  'application/zip', 'application/x-zip-compressed', 'application/octet-stream',
]);

function fileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback): void {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();
  if (ALLOWED_EXT.has(ext) && ALLOWED_MIME.has(mime)) {
    cb(null, true);
  } else {
    cb(new Error(`Desteklenmeyen dosya türü (${ext || 'bilinmiyor'} / ${mime || 'bilinmiyor'}).`));
  }
}

/** Bellek-tabanlı, tür-doğrulamalı yükleme. maxMb: azami dosya boyutu (MB). */
export function documentUpload(maxMb = 50) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxMb * 1024 * 1024, files: 1 },
    fileFilter,
  });
}

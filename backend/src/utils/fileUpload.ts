// contractWorkflow.ts'teki multer/Nextcloud upload mantığının paylaşılan hali.
// Mevcut, çalışan contractWorkflow.ts regresyon riskine karşı kasıtlı olarak
// dokunulmadan bırakıldı; bu yardımcılar yalnızca Faz 2 (Proje Devir Paketi)
// gibi yeni checklist-tipi modüller için kullanılır.

import path from 'path';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { logger } from './logger';
import { checkLimit, incrementUsage } from '../usageService';

export function slugify(str: string): string {
  return str
    .replace(/[ğ]/gi, 'g').replace(/[ü]/gi, 'u').replace(/[ş]/gi, 's')
    .replace(/[ı]/gi, 'i').replace(/[ö]/gi, 'o').replace(/[ç]/gi, 'c')
    .replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').slice(0, 60);
}

export function getUploadDir(root: string, folderName: string): string {
  const dir = path.join(root, folderName);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function uploadToNextcloud(
  fileBuffer: Buffer,
  fileName: string,
  remotePath: string,
  ncUrl: string,
  ncUser: string,
  ncPass: string,
): Promise<string> {
  const fullPath = remotePath.endsWith('/') ? `${remotePath}${fileName}` : `${remotePath}/${fileName}`;
  const uploadUrl = `${ncUrl}/remote.php/dav/files/${ncUser}${fullPath}`;
  const auth = Buffer.from(`${ncUser}:${ncPass}`).toString('base64');

  // MKCOL (klasör ağacı oluştur) — best-effort, hataları yut
  const mkcolUrl = `${ncUrl}/remote.php/dav/files/${ncUser}${remotePath}`;
  await new Promise<void>(resolve => {
    const lib = mkcolUrl.startsWith('https') ? https : http;
    const req = lib.request(mkcolUrl, {
      method: 'MKCOL',
      headers: { Authorization: `Basic ${auth}` },
    });
    req.on('response', () => resolve());
    req.on('error', () => resolve());
    req.end();
  });

  // PUT file
  return new Promise((resolve, reject) => {
    const lib = uploadUrl.startsWith('https') ? https : http;
    const req = lib.request(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileBuffer.length,
      },
    }, res => {
      if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
        resolve(uploadUrl);
      } else {
        reject(new Error(`Nextcloud PUT ${res.statusCode}`));
      }
    });
    req.on('error', reject);
    req.write(fileBuffer);
    req.end();
  });
}

/**
 * `uploadToNextcloud`'u env değişkenleri + INTEGRATION_SYNC kotasıyla sarmalar
 * — çağıran taraftaki tekrarlanan "NC_URL var mı / try-catch" bloğunun tek
 * kaynağı. Nextcloud yapılandırılmamışsa, kota dolmuşsa veya çağrı başarısız
 * olursa `null` döner (çağıran zaten yerel depolamaya düşüyor) — hiçbir zaman
 * fırlatmaz, mevcut "best-effort mirror" davranışı korunur. Yalnız GERÇEK bir
 * PUT başarılı olduğunda kota artırılır (başarısız denemeler ücretsiz).
 */
export async function tryUploadToNextcloud(
  tenantId: string,
  fileBuffer: Buffer,
  fileName: string,
  remotePath: string,
): Promise<string | null> {
  const ncUrl = process.env.NEXTCLOUD_URL;
  const ncUser = process.env.NEXTCLOUD_USER;
  const ncPass = process.env.NEXTCLOUD_PASS;
  if (!ncUrl || !ncUser || !ncPass) return null;

  const ok = await checkLimit(tenantId, 'INTEGRATION_SYNC');
  if (!ok) {
    logger.warn('[Nextcloud] Entegrasyon senkron kotası dolu, yerel depolamaya düşülüyor.', { tenantId });
    return null;
  }

  try {
    let url: string;
    try {
      url = await uploadToNextcloud(fileBuffer, fileName, remotePath, ncUrl, ncUser, ncPass);
    } catch {
      // Tek retry — WebDAV geçici ağ blip'lerine karşı (bkz.
      // docs/OLCEKLENDIRME_DUZELTME_PLANI.md Faz C / S-10).
      await new Promise(r => setTimeout(r, 500));
      url = await uploadToNextcloud(fileBuffer, fileName, remotePath, ncUrl, ncUser, ncPass);
    }
    await incrementUsage(tenantId, 'INTEGRATION_SYNC');
    return url;
  } catch (e) {
    logger.warn('[Nextcloud] Upload failed, using local:', (e as Error).message);
    return null;
  }
}

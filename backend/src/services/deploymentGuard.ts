// Enflow — Çoklu-replika dağıtım ön-kontrolü (boot-time, best-effort).
// ─────────────────────────────────────────────────────────────────────────────
// contractWorkflow.ts'teki evrak yükleme (ve fileUpload.ts'i kullanan diğer
// checklist modülleri) Nextcloud yapılandırılmadığında dosyayı yalnız yerel
// diske yazar (backend/uploads/). Tek replikada sorun yok; ama ops
// ENFLOW_MULTI_REPLICA=true ile birden fazla backend kopyası + load balancer
// kurduğunda, bir replikaya yüklenen evrak diğerinden 404 döner (bkz.
// docs/OLCEKLENDIRME_DUZELTME_PLANI.md Faz A / S-03). contractWorkflow.ts'e
// regresyon riski nedeniyle dokunulmuyor — bu modül yalnız operasyonel bir
// erken-uyarı: süreci durdurmaz, tek-replika kurulumlarda (varsayılan) hiçbir
// etkisi yok.

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export function checkDeploymentTopology(): void {
  if (process.env.ENFLOW_MULTI_REPLICA !== 'true') return;

  const hasSharedStorage = Boolean(
    process.env.NEXTCLOUD_URL && process.env.NEXTCLOUD_USER && process.env.NEXTCLOUD_PASS
  );
  if (hasSharedStorage) return;

  logger.error(
    '[deploymentGuard] ENFLOW_MULTI_REPLICA=true ama paylaşımlı dosya deposu ' +
    '(NEXTCLOUD_URL/NEXTCLOUD_USER/NEXTCLOUD_PASS) yapılandırılmamış. Evrak ' +
    'yüklemeleri (sözleşme/devir paketi) replikalar arasında tutarsız olacak — ' +
    'bir replikaya yüklenen dosya diğerinden erişilemez. Bkz. ' +
    'docs/SYSTEM_REQUIREMENTS.md Senaryo 4.'
  );
}

/**
 * Sır içeren dosyalardan grup/diğer kullanıcılara AÇIK olanları döndürür (POSIX). `.env` JWT imza
 * anahtarını, tenant veri şifreleme ana anahtarını ve DB parolasını taşır; 0644 ise aynı makinedeki
 * her yerel kullanıcı okuyabilir. Windows'ta mode anlamsız → boş.
 */
export function insecureSecretFiles(files: string[], platform: NodeJS.Platform = process.platform): { file: string; mode: string }[] {
  if (platform === 'win32') return [];
  const out: { file: string; mode: string }[] = [];
  for (const file of files) {
    try {
      const mode = fs.statSync(file).mode & 0o777;
      if ((mode & 0o077) !== 0) out.push({ file, mode: mode.toString(8) });
    } catch { /* dosya yok */ }
  }
  return out;
}

export function checkSecretFilePermissions(): void {
  const bad = insecureSecretFiles([path.resolve(process.cwd(), '.env')]);
  for (const b of bad) {
    logger.warn(`[deploymentGuard] ${b.file} izinleri ${b.mode} — gizli anahtarlar/parolalar diğer yerel kullanıcılara açık. Düzeltin: chmod 600 "${b.file}" (upgrade-tool bir sonraki yükseltmede de düzeltir).`);
  }
}

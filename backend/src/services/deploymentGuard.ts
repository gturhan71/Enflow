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

// Enflow — Güncelleme bildirimcisi (ince köprü).
// ─────────────────────────────────────────────────────────────────────────────
// AYRI upgrade-tool'un repo köküne yazdığı `update-status.json` dosyasını OKUR ve
// güncelleme varsa/uygulandıysa her tenant'ın GENERAL_MANAGER kullanıcılarına bir
// bildirim (zil) düşürür. Burada SÜRÜM/UPGRADE MANTIĞI YOKTUR — git/remote'a
// konuşmaz; yalnız aracın yazdığı durumu yansıtır. Dedup: tenant.moduleSettings.update.
import { readFileSync } from 'fs';
import path from 'path';
import { prisma } from '../prismaClient';

export interface UpdateStatus {
  checkedAt?: string;
  current?: { shortSha?: string | null; tag?: string | null; date?: string | null };
  update?: {
    available?: boolean;
    applied?: boolean;
    failed?: boolean;
    kind?: 'tag' | 'commit';
    target?: string | null;
    ref?: string | null;
    notes?: string | null;
    publishedAt?: string | null;
    to?: string | null;
    error?: string | null;
  };
}

/** Repo kökü: ENFLOW_HOME ya da backend/src/services'ten üç üst. */
export function enflowHome(): string {
  return process.env.ENFLOW_HOME || path.resolve(__dirname, '../../..');
}

export function readUpdateStatus(): UpdateStatus | null {
  try {
    return JSON.parse(readFileSync(path.join(enflowHome(), 'update-status.json'), 'utf-8')) as UpdateStatus;
  } catch {
    return null;
  }
}

interface UpdateMarker { lastNotifiedRef?: string | null; lastAppliedTo?: string | null }

async function readMarker(tenantId: string): Promise<UpdateMarker> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { moduleSettings: true } });
  try {
    const ms = JSON.parse(t?.moduleSettings || '{}') as Record<string, unknown>;
    return (ms.update as UpdateMarker) || {};
  } catch { return {}; }
}
async function writeMarker(tenantId: string, patch: UpdateMarker): Promise<void> {
  const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { moduleSettings: true } });
  let ms: Record<string, unknown> = {};
  try { ms = JSON.parse(t?.moduleSettings || '{}'); } catch { ms = {}; }
  ms.update = { ...(ms.update as object), ...patch };
  await prisma.tenant.update({ where: { id: tenantId }, data: { moduleSettings: JSON.stringify(ms) } });
}

async function notifyGMs(tenantId: string, type: string, title: string, message: string): Promise<void> {
  const gms = await prisma.user.findMany({ where: { tenantId, role: 'GENERAL_MANAGER' }, select: { id: true } });
  for (const u of gms) {
    await prisma.notification.create({
      data: {
        tenantId, userId: u.id, type, title, message,
        // Detay için Ayarlar→Entegrasyonlar'daki "Güncellemeler" kartına yönlendir.
        relatedModule: 'settings-integrations',
      },
    }).catch(() => undefined);
  }
}

let running = false;

async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const status = readUpdateStatus();
    const u = status?.update;
    if (!u) return; // araç henüz çalışmadı / dosya yok

    const tenants = await prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) {
      try {
        const marker = await readMarker(t.id);

        // Başarıyla uygulandı → bilgi bildirimi (uygulanan hedef bazında dedup)
        if (u.applied && u.to && marker.lastAppliedTo !== u.to) {
          await notifyGMs(t.id, 'SUCCESS', 'Sistem güncellendi', `Enflow ${u.to} sürümüne yükseltildi.`);
          await writeMarker(t.id, { lastAppliedTo: u.to });
          continue;
        }

        // Güncelleme mevcut → hatırlatma (hedef ref bazında dedup, spam yok)
        if (u.available && u.target && marker.lastNotifiedRef !== (u.ref || u.target)) {
          const when = u.publishedAt ? new Date(u.publishedAt).toLocaleDateString('tr-TR') : '';
          const note = u.notes ? ` — ${u.notes}` : '';
          await notifyGMs(
            t.id, 'WARNING', 'Yeni sürüm mevcut',
            `Yeni Enflow sürümü yayında: ${u.target}${when ? ` (${when})` : ''}${note}. Yükseltme aracını çalıştırın.`
          );
          await writeMarker(t.id, { lastNotifiedRef: u.ref || u.target });
        }
      } catch { /* tek tenant hatası diğerlerini durdurmaz */ }
    }
  } catch { /* sweep ana akışı bozmaz */ } finally {
    running = false;
  }
}

export function startUpdateNotifier(): void {
  // İlk tarama 20sn sonra (boot yükünü dağıt), sonra 10 dakikada bir.
  setTimeout(() => { void tick(); }, 20_000);
  setInterval(() => { void tick(); }, 10 * 60_000);
}

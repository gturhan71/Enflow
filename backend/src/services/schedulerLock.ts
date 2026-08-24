// Enflow — Çoklu-replika zamanlayıcı kilidi (DB-native, taşınabilir SQL).
// ─────────────────────────────────────────────────────────────────────────────
// backupScheduler/activityLogArchiveScheduler/updateNotifier gibi in-process
// zamanlayıcılar birden fazla backend replikasında aynı anda ayağa kalkarsa,
// her biri bağımsız tetiklenip aynı işi mükerrer yapardı (bkz.
// docs/OLCEKLENDIRME_DUZELTME_PLANI.md Faz A / S-01). Bu modül, dialect-özel
// pg_advisory_lock yerine SQLite+Postgres'te aynı davranan bir "leased lock"
// (süreli kiralama) sağlar: SchedulerLock tablosunda tek satır güncellenir,
// yalnız süresi dolmuş veya zaten kendi holder'ında olan bir kilit devralınır.

import { randomUUID } from 'crypto';
import { prisma } from '../prismaClient';

// Süreç başına sabit — bu backend süreci hayatta olduğu sürece aynı kalır,
// böylece aynı sürecin ardışık tick'leri kendi kilidini sorunsuz yeniler.
const HOLDER_ID = randomUUID();

/**
 * Kilidi devralmayı dener. Başarılıysa true döner ve kilit `ttlMs` süresince
 * bu holder'a aittir (crash-safety fallback — normal akışta `releaseLock` işi
 * bitince hemen serbest bırakır, diğer replikalar TTL dolmasını beklemez).
 */
export async function acquireLock(name: string, ttlMs: number): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);

  const claimed = await prisma.schedulerLock.updateMany({
    where: { name, OR: [{ expiresAt: { lt: now } }, { holder: HOLDER_ID }] },
    data: { holder: HOLDER_ID, expiresAt },
  });
  if (claimed.count > 0) return true;

  // Satır hiç yoksa (ilk çalıştırma) — oluşturmayı dene; eşzamanlı iki
  // replika aynı anda create ederse biri unique-violation ile elenir (o da
  // "kilit alınamadı" sayılır, bir sonraki tick'te tekrar dener).
  try {
    await prisma.schedulerLock.create({ data: { name, holder: HOLDER_ID, expiresAt } });
    return true;
  } catch {
    return false;
  }
}

/** İş bitince kilidi hemen serbest bırakır (expiresAt'i geçmişe çeker). */
export async function releaseLock(name: string): Promise<void> {
  await prisma.schedulerLock.updateMany({
    where: { name, holder: HOLDER_ID },
    data: { expiresAt: new Date(0) },
  }).catch(() => undefined);
}

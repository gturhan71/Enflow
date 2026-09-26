// /uploads erişim koruması (kimlik + kiracı sahipliği).
// ─────────────────────────────────────────────────────────────────────────────
// Önceden /uploads herkese AÇIKTI (kimlik doğrulamasız): sözleşme evrakları, hukuk dosyaları, teminat mektupları
// URL'yi bilen herkesçe indirilebiliyordu. Şimdi (1) geçerli oturum zorunlu (tenantMiddleware), (2) dosya bir
// kiracının kaydına (fileUrl/url/path alanlı tablolar) bağlıysa YALNIZ o kiracı erişir; başka kiracı 403.
// Hiçbir kayda bağlı olmayan dosya (ör. henüz bağlanmamış yükleme) oturumlu kullanıcıya açık kalır — meşru
// indirmeleri kırmamak için bilinçli ödün; fiziksel yol kiracıya göre ayrılırsa (ileri iş) tamamen kapanır.
import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';
import { logger } from '../utils/logger';

interface RefField { model: string; delegate: string; field: string }

/** tenantId'li tablolarda dosya yolu tutabilecek String alanlar (fileUrl, sampleFileUrl, url, path…). */
export function discoverRefFields(models = Prisma.dmmf.datamodel.models): RefField[] {
  const out: RefField[] = [];
  for (const m of models) {
    if (!m.fields.some((f) => f.name === 'tenantId')) continue;
    for (const f of m.fields) {
      if (f.kind === 'scalar' && f.type === 'String' && !f.isList && /(file|url|path)/i.test(f.name) && !/^(tenantId|id)$/.test(f.name)) {
        out.push({ model: m.name, delegate: m.name.charAt(0).toLowerCase() + m.name.slice(1), field: f.name });
      }
    }
  }
  return out;
}

const REF_FIELDS = discoverRefFields();

/** Bu dosya yoluna bağlı kayıtların sahibi kiracılar (boş küme = hiçbir kayda bağlı değil). */
export async function ownersOfUpload(urlPath: string): Promise<Set<string>> {
  const owners = new Set<string>();
  await Promise.all(REF_FIELDS.map(async ({ delegate, field }) => {
    const d = (prisma as unknown as Record<string, { findMany: (a: unknown) => Promise<{ tenantId: string }[]> }>)[delegate];
    if (!d?.findMany) return;
    try {
      const rows = await d.findMany({ where: { [field]: urlPath }, select: { tenantId: true }, take: 5 });
      for (const r of rows) owners.add(r.tenantId);
    } catch (e) {
      logger.warn(`[uploadsGuard] ${delegate}.${field} sorgulanamadı`, e);
    }
  }));
  return owners;
}

const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; owners: Set<string> }>();

async function cachedOwners(urlPath: string): Promise<Set<string>> {
  const hit = cache.get(urlPath);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.owners;
  const owners = await ownersOfUpload(urlPath);
  if (cache.size > 2000) cache.clear();
  cache.set(urlPath, { at: Date.now(), owners });
  return owners;
}

/** tenantMiddleware'DEN SONRA çalışır (req.tenantId hazır). `/uploads` altına mount edilir → req.path = `/contracts/x/y.pdf`. */
export async function uploadsTenantGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  let rel: string;
  try { rel = decodeURIComponent(req.path); } catch { res.status(400).json({ error: 'Geçersiz yol.' }); return; }
  if (rel.includes('..')) { res.status(400).json({ error: 'Geçersiz yol.' }); return; }
  const owners = await cachedOwners(`/uploads${rel}`);
  if (owners.size > 0 && !owners.has(req.tenantId)) {
    res.status(403).json({ error: 'Bu dosyaya erişim yetkiniz yok.' });
    return;
  }
  next();
}

// Enflow — plan kataloğu: tek-kaynak SKU→plan eşlemesi + varsayılan plan limitleri.
// bootstrapTenant.ts, routes/tenants.ts ve usageService.ts bu dosyayı kullanır
// (önceden PLAN_MAP iki yerde ayrı ayrı tanımlıydı ve sürüklenme riski taşıyordu).
// src/modules/LicenseTypesModule.tsx (frontend fiyatlandırma gösterimi) ile senkron tutulmalı.
export type PlanId = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';

export const PLAN_MAP: Record<string, PlanId> = {
  STARTER: 'STARTER', PRO: 'PROFESSIONAL', PROFESSIONAL: 'PROFESSIONAL', ENTERPRISE: 'ENTERPRISE', CUSTOM: 'PROFESSIONAL',
};

// Plan sıralaması — /tenants/activate-license'ın "yalnız yükselt" kuralı için
// (bkz. docs/LICENSING_ARCHITECTURE.md): aktive edilen yeni lisansın planı mevcut
// plandan düşükse (rank azalıyorsa) reddedilir. Düşürme yalnız vendor'un yeni bir
// lisans üretmesiyle (dolayısıyla harici, uygulama-dışı bir süreçle) mümkündür —
// bu app ödeme/faturalama takip etmez, o her zaman lisans üretim sürecinin dışındaydı.
export const PLAN_RANK: Record<PlanId, number> = { STARTER: 0, PROFESSIONAL: 1, ENTERPRISE: 2 };

// Lisansta (Subscription.licensedUserLimit / licensedStorageLimit) özel bir
// değer yoksa uygulanan varsayılan plan limitleri. ENTERPRISE için 999/1000
// pratikte "sınırsız" temsilidir (frontend'de de aynı sentinel kullanılır).
export const DEFAULT_PLAN_LIMITS: Record<PlanId, { users: number; storageGB: number }> = {
  STARTER: { users: 5, storageGB: 20 },
  PROFESSIONAL: { users: 10, storageGB: 40 },
  ENTERPRISE: { users: 999, storageGB: 1000 },
};

// 30 günlük deneme (lisanssız bootstrap) — bilinçli olarak plan varsayılanlarının
// altında. Depolama alt-GB (500 MB) granülaritesinde olduğu için Subscription.
// licensedStorageLimit (GB birimli Int) sütununa sığmaz — enforcement bu sabiti
// doğrudan MB olarak kullanır (bkz. usageService.ts, licenseModel === 'TRIAL').
export const TRIAL_USER_LIMIT = 5;
export const TRIAL_STORAGE_LIMIT_MB = 500;

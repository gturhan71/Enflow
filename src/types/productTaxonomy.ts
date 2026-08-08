// ── Marka & Ürün Grubu Taksonomisi (2026-08-08, Faz 1) ───────────────────────
// Tenant-yapılandırılabilir, yönetilebilir liste — Presales BoM kalemi + DMO
// katalog kaydı bu ortak listelerden seçim yapar. Ayarlar → Marka & Ürün Grubu.

export interface Brand {
  id: string;
  tenantId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductCategory {
  id: string;
  tenantId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BrandSource {
  id: string;
  tenantId: string;
  brandId: string;
  name: string;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

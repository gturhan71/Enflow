// ── Eklenti Kataloğu (Plugin Catalog) ────────────────────────────────────────
// Satılabilir eklentilerin KOD-SEVİYESİ sözlüğü (UNIT_DEFINITIONS gibi).
// Çekirdek ticari sürümün DIŞINDA, ayrı lisanslanabilir upsell kalemleri.
// Yeni bir agent/eklenti eklemek = bu diziye bir satır + (agent ise) bir handler.
//
// Tasarım ilkesi: katalog generic'tir — herhangi bir birim/rol için eklenti
// tanımlanabilir. Şu an yalnızca VIRTUAL_AGENT kategorisi var ama category
// alanı ileride başka eklenti türlerine (entegrasyon, rapor paketi vb.) açık.

export type PluginCategory = 'VIRTUAL_AGENT';
export type AgentMode = 'ADVISORY' | 'AUTONOMOUS';

export interface PluginDefinition {
  key: string;              // benzersiz SKU (örn. AGENT_TENDER)
  name: string;             // satış/UI adı
  category: PluginCategory;
  description: string;
  // VIRTUAL_AGENT'a özel alanlar:
  unitKey?: string;         // hangi birim adına çalışır (UNIT_DEFINITIONS.key)
  role?: string;            // o birimin rolü (boş koltuğu dolduracağı rol)
  defaultMode?: AgentMode;  // varsayılan çalışma modu
  allowedModes?: AgentMode[]; // bu eklenti için izinli modlar
  entityType?: string;      // işlediği varlık tipi (TENDER, PROJECT, ...)
  priceNote?: string;       // upsell fiyat notu (UI'da bilgi amaçlı)
  // handler'ın hazır olup olmadığı (iskelet mi, çalışır mı)
  status: 'AVAILABLE' | 'COMING_SOON';
}

// Her aktif birim için bir agent slotu önceden tanımlı (her-rol-hazır altyapı).
// İlk teslimatta İhale + Proje "AVAILABLE", diğerleri "COMING_SOON" — ama
// lisans/entitlement altyapısı hepsi için bugünden hazır.
export const PLUGIN_CATALOG: PluginDefinition[] = [
  {
    key: 'AGENT_TENDER',
    name: 'Sanal İhale Asistanı',
    category: 'VIRTUAL_AGENT',
    description:
      'İhale uygunluk denetimini (checklist eksiksizliği) ve son teslim tarihi riskini hazırlar, gerçek kişiye onaya devreder.',
    unitKey: 'TENDER',
    role: 'ISAB_MGR',
    defaultMode: 'ADVISORY',
    allowedModes: ['ADVISORY', 'AUTONOMOUS'],
    entityType: 'TENDER',
    priceNote: 'Aylık eklenti',
    status: 'AVAILABLE',
  },
  {
    key: 'AGENT_PROJECT',
    name: 'Sanal Proje Asistanı',
    category: 'VIRTUAL_AGENT',
    description:
      'Proje devir paketi eksik evraklarını ve geciken milestone\'ları tespit eder, proje yöneticisine devreder.',
    unitKey: 'PROJECT',
    role: 'PROJECT_MANAGER',
    defaultMode: 'ADVISORY',
    allowedModes: ['ADVISORY', 'AUTONOMOUS'],
    entityType: 'PROJECT',
    priceNote: 'Aylık eklenti',
    status: 'AVAILABLE',
  },
  // Her rol için altyapı hazır — handler'lar sonraki fazlarda eklenecek:
  {
    key: 'AGENT_FINANCE',
    name: 'Sanal Finans Asistanı',
    category: 'VIRTUAL_AGENT',
    description:
      'Eşik altı maliyet onay önerisi ve fatura taslağı hazırlar. Yalnızca danışman modu — insan ratifikasyonu zorunlu.',
    unitKey: 'FINANCE',
    role: 'FINANCE_MGR',
    defaultMode: 'ADVISORY',
    allowedModes: ['ADVISORY'], // para — asla otonom değil
    entityType: 'PROJECT_COST',
    priceNote: 'Aylık eklenti',
    status: 'AVAILABLE',
  },
  {
    key: 'AGENT_LEGAL',
    name: 'Sanal Hukuk Asistanı',
    category: 'VIRTUAL_AGENT',
    description:
      'Sözleşme inceleme / hukuki görüş taslağı hazırlar. Yalnızca danışman modu — insan onayı zorunlu.',
    unitKey: 'LEGAL',
    role: 'LEGAL_MGR',
    defaultMode: 'ADVISORY',
    allowedModes: ['ADVISORY'], // hukuki sorumluluk — asla otonom değil
    entityType: 'LEGAL_CASE',
    priceNote: 'Aylık eklenti',
    status: 'COMING_SOON',
  },
  {
    key: 'AGENT_CRM',
    name: 'Sanal CRM Asistanı',
    category: 'VIRTUAL_AGENT',
    description: 'Fırsat triyajı ve eksik alan/aşama önerisi hazırlar.',
    unitKey: 'CRM',
    role: 'SALES_MANAGER',
    defaultMode: 'ADVISORY',
    allowedModes: ['ADVISORY', 'AUTONOMOUS'],
    entityType: 'OPPORTUNITY',
    priceNote: 'Aylık eklenti',
    status: 'COMING_SOON',
  },
  {
    key: 'AGENT_PRESALES',
    name: 'Sanal Presales Asistanı',
    category: 'VIRTUAL_AGENT',
    description: 'BoM eksiksizlik ve maliyet analizi tutarlılık denetimi hazırlar.',
    unitKey: 'PRESALES',
    role: 'PRESALES',
    defaultMode: 'ADVISORY',
    allowedModes: ['ADVISORY', 'AUTONOMOUS'],
    entityType: 'PROPOSAL',
    priceNote: 'Aylık eklenti',
    status: 'AVAILABLE',
  },
  {
    key: 'AGENT_PROCUREMENT',
    name: 'Sanal Satınalma Asistanı',
    category: 'VIRTUAL_AGENT',
    description: 'Satınalma talebi doğrulaması ve tekliflerden tedarikçi önerisi hazırlar.',
    unitKey: 'PROCUREMENT',
    role: 'PROCUREMENT',
    defaultMode: 'ADVISORY',
    allowedModes: ['ADVISORY', 'AUTONOMOUS'],
    entityType: 'PURCHASE_REQUEST',
    priceNote: 'Aylık eklenti',
    status: 'AVAILABLE',
  },
];

export function getPlugin(key: string): PluginDefinition | undefined {
  return PLUGIN_CATALOG.find((p) => p.key === key);
}

// Belirli bir rolü dolduran (boş koltuk) lisanslanabilir agent eklentisini bul.
// autoSkipOrphanStages generic kancası bunu kullanır.
export function getAgentPluginForRole(role: string): PluginDefinition | undefined {
  return PLUGIN_CATALOG.find(
    (p) => p.category === 'VIRTUAL_AGENT' && p.role === role,
  );
}

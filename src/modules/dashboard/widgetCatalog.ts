// Enflow — Dashboard widget kataloğu (tek doğruluk kaynağı)
// Her kart için: başlık, "felsefe" açıklaması (rol/seviye fark etmeksizin
// herkese aynı gösterilir) ve hangi vadedeki yönetimsel kararı beslediği.
// Kişiselleştirme (Faz 3) ve yeni widget'lar (Faz 4) bu kataloğa eklenir.

export type WK =
  | 'kpiOverview' | 'costApprovals' | 'tenderDeadlines' | 'guaranteeExpiries' | 'guaranteeRequests'
  | 'financingGap' | 'tenderPipeline' | 'withdrawnTenders' | 'bomHandoffs' | 'invoicesDue'
  | 'milestonesDue' | 'purchaseRequests' | 'myOpportunities' | 'myTasks' | 'projects'
  | 'contractDeadlines' | 'legalDeadlines' | 'approvalBottlenecks' | 'topRisks' | 'agentActivity'
  | 'visitPerformance';

export type DecisionHorizon = 'operational' | 'near' | 'mid' | 'long';

export interface WidgetMeta {
  key: WK;
  philosophy: string;
  horizon: DecisionHorizon;
}

export const HORIZON_LABEL: Record<DecisionHorizon, string> = {
  operational: 'Bugün',
  near: 'Yakın vade',
  mid: 'Orta vade',
  long: 'Uzun vade',
};

export const HORIZON_COLOR: Record<DecisionHorizon, string> = {
  operational: 'bg-rose-100 text-rose-600',
  near: 'bg-amber-100 text-amber-700',
  mid: 'bg-sky-100 text-sky-700',
  long: 'bg-violet-100 text-violet-700',
};

export const WIDGET_META: Record<WK, WidgetMeta> = {
  kpiOverview: {
    key: 'kpiOverview',
    philosophy: 'Satış hattının o anki nabzı: kazanım oranı ve açık pipeline büyüklüğü, hedeflere göre nerede durduğunuzu gösterir — kaynak planlaması ve hedef revizyonu kararlarını besler.',
    horizon: 'mid',
  },
  costApprovals: {
    key: 'costApprovals',
    philosophy: 'Teknik/maliyet onayı bekleyen fırsatlar burada birikir; onay gecikirse teklif süreci de gecikir — günlük iş sırasına göre öncelik vermenizi sağlar.',
    horizon: 'operational',
  },
  tenderDeadlines: {
    key: 'tenderDeadlines',
    philosophy: 'Teklif verilmesi gereken ihalelerin son başvuru tarihine kalan gün sayısı; kaçırılan bir vade geri döndürülemez — hazırlık ekibinin zamanlamasını yönetir.',
    horizon: 'near',
  },
  guaranteeExpiries: {
    key: 'guaranteeExpiries',
    philosophy: '30 gün içinde süresi dolacak teminat mektupları; süresi dolan teminat sözleşme/ihale yükümlülüğünü tehlikeye atar — finansmanla önceden koordinasyon gerektirir.',
    horizon: 'near',
  },
  guaranteeRequests: {
    key: 'guaranteeRequests',
    philosophy: 'Talep edilmiş ama henüz düzenlenmemiş teminatlar; bekleyen talep ihale/sözleşme sürecini durdurabilir.',
    horizon: 'operational',
  },
  financingGap: {
    key: 'financingGap',
    philosophy: 'Alacak ve gecikmiş alacağın döviz bazında toplamı; nakit akışı planlaması ve tahsilat önceliklendirmesi için temel gösterge.',
    horizon: 'mid',
  },
  tenderPipeline: {
    key: 'tenderPipeline',
    philosophy: 'Aktif/teklif verilmiş/kazanılmış/kaybedilmiş ihale sayıları tek bakışta; iş geliştirme kapasitesinin nereye odaklanması gerektiğini gösterir.',
    horizon: 'mid',
  },
  withdrawnTenders: {
    key: 'withdrawnTenders',
    philosophy: 'Yönetim kararıyla girilmeyen ihaleler — kazanma-oranı KPI\'sını etkilemesin diye ayrı izlenir; hangi fırsatların bilinçli olarak bırakıldığının kaydını tutar.',
    horizon: 'long',
  },
  bomHandoffs: {
    key: 'bomHandoffs',
    philosophy: 'Presales\'ten satınalmaya devredilen malzeme listeleri; devrin ne zaman ve ne kadar kapsamla yapıldığını izler, teklif-maliyet tutarlılığını doğrular.',
    horizon: 'operational',
  },
  invoicesDue: {
    key: 'invoicesDue',
    philosophy: 'Vadesi yaklaşan/geçmiş satış faturaları; tahsilat takibinin önceliğini ve gecikme riskini gösterir.',
    horizon: 'near',
  },
  milestonesDue: {
    key: 'milestonesDue',
    philosophy: 'Proje takviminde yaklaşan kilometre taşları; gecikme riskini erken görüp müşteri/ekip beklentisini yönetmenizi sağlar.',
    horizon: 'near',
  },
  purchaseRequests: {
    key: 'purchaseRequests',
    philosophy: 'Satınalma taleplerinin statü dağılımı; tedarik sürecinde nerede tıkanma olduğunu gösterir.',
    horizon: 'operational',
  },
  myOpportunities: {
    key: 'myOpportunities',
    philosophy: 'Size atanmış aktif fırsatlar; günlük odaklanmanız gereken satış işlerinin kişisel listesi.',
    horizon: 'operational',
  },
  myTasks: {
    key: 'myTasks',
    philosophy: 'Size atanmış bekleyen görevler ve okunmamış bildirimler; günlük iş listenizin özeti.',
    horizon: 'operational',
  },
  projects: {
    key: 'projects',
    philosophy: 'Aktif proje sayısı ve ortalama marj; uygulama aşamasındaki işlerin karlılık eğilimini gösterir.',
    horizon: 'mid',
  },
  contractDeadlines: {
    key: 'contractDeadlines',
    philosophy: 'İmza süreci devam eden sözleşmelerin vadesi; kaçırılan bir sözleşme vadesi ihale/iş kaybına yol açabilir — evrak/imza hazırlığının zamanlamasını yönetir.',
    horizon: 'near',
  },
  legalDeadlines: {
    key: 'legalDeadlines',
    philosophy: 'Açık hukuk dosyalarının yanıt/işlem vadesi; hukuki riskin zamanında ele alınıp alınmadığını gösterir.',
    horizon: 'near',
  },
  approvalBottlenecks: {
    key: 'approvalBottlenecks',
    philosophy: 'Onay zincirinde (Finans→İGB→GM→KSU) sırası gelmiş ama bekleyen aşamalar, role göre gruplanmış bekleme süresiyle; sürecin nerede tıkandığını gösterir.',
    horizon: 'operational',
  },
  topRisks: {
    key: 'topRisks',
    philosophy: 'Açık risk kaydındaki en yüksek skorlu (olasılık × etki) 5 kalem; kurumsal risk iştahının ve azaltma önceliğinin stratejik göstergesi.',
    horizon: 'long',
  },
  agentActivity: {
    key: 'agentActivity',
    philosophy: 'Bugün sanal agent\'ların aldığı otonom eylemler ve onay bekleyen (ratifikasyon) çalıştırmalar; otomasyonun nerede insan onayı beklediğini gösterir.',
    horizon: 'operational',
  },
  visitPerformance: {
    key: 'visitPerformance',
    philosophy: 'Planlanan ziyaretlerin ne kadarı gerçekleşiyor ve gerçekleşen ziyaretler ne oranda fırsata dönüşüyor — satış ekibinin saha etkinliğinin somut göstergesi.',
    horizon: 'mid',
  },
};

// Rol → varsayılan widget listesi + sıralama. Kullanıcı kişiselleştirmesi
// (Faz 3) yoksa bu varsayılana düşülür.
export const ROLE_DASHBOARD: Record<string, WK[]> = {
  GENERAL_MANAGER: ['kpiOverview', 'approvalBottlenecks', 'costApprovals', 'tenderDeadlines', 'contractDeadlines', 'guaranteeExpiries', 'legalDeadlines', 'financingGap', 'tenderPipeline', 'visitPerformance', 'topRisks', 'agentActivity', 'withdrawnTenders', 'bomHandoffs'],
  OPERATIONS_MGR: ['kpiOverview', 'tenderDeadlines', 'tenderPipeline', 'projects'],
  SALES_MGR: ['costApprovals', 'kpiOverview', 'tenderPipeline', 'visitPerformance', 'myTasks'],
  SALES_REP: ['myOpportunities', 'myTasks'],
  SALES_SUPPORT: ['tenderDeadlines', 'guaranteeRequests', 'tenderPipeline', 'myTasks'],
  ISAB_MGR: ['tenderDeadlines', 'tenderPipeline', 'guaranteeRequests', 'myTasks'],
  PRESALES_MGR: ['bomHandoffs', 'myTasks'],
  PRESALES_ENG: ['myOpportunities', 'myTasks'],
  TECHNICAL_SPEC: ['myTasks'],
  FINANCE_MGR: ['guaranteeRequests', 'guaranteeExpiries', 'invoicesDue', 'financingGap', 'costApprovals'],
  PROCUREMENT_MGR: ['purchaseRequests', 'myTasks'],
  PROJECT_MGR: ['projects', 'milestonesDue', 'myTasks'],
  KSU_MGR: ['contractDeadlines', 'approvalBottlenecks', 'myTasks'],
  LEGAL_MGR: ['legalDeadlines', 'myTasks'],
  IGPD_MGR: ['topRisks', 'kpiOverview', 'myTasks'],
  KGD_MGR: ['topRisks', 'myTasks'],
};

export const DEFAULT_WIDGETS: WK[] = ['myTasks', 'myOpportunities'];

export const ALL_WIDGET_KEYS: WK[] = Object.keys(WIDGET_META) as WK[];

// Görünen başlıklar — kişiselleştirme (Düzenle) panelinde kullanılır.
// Not: Dashboard.tsx'teki WCard `title` prop'ları ile aynı metin tutulmalı
// (kartların kendi render switch'i bilinçli olarak ayrı literal string tutuyor —
// düşük riskli, küçük bir tekrar).
export const WIDGET_TITLE: Record<WK, string> = {
  kpiOverview: 'Genel KPI',
  costApprovals: 'Bekleyen Maliyet Onayı',
  tenderDeadlines: 'İhale Vadeleri',
  guaranteeExpiries: 'Süresi Yaklaşan Teminat',
  guaranteeRequests: 'Teminat Talepleri',
  financingGap: 'Finansman / Nakit Akış',
  tenderPipeline: 'İhale Hattı',
  withdrawnTenders: 'İştirak Edilmeyen (Yönetim)',
  bomHandoffs: 'Devredilen BoM',
  invoicesDue: 'Fatura Vadeleri',
  milestonesDue: 'Yaklaşan Milestone',
  purchaseRequests: 'Satınalma Talepleri',
  myOpportunities: 'Fırsatlarım',
  myTasks: 'Görevlerim',
  projects: 'Projeler',
  contractDeadlines: 'Sözleşme Vadeleri',
  legalDeadlines: 'Hukuk Dosyası Vadeleri',
  approvalBottlenecks: 'Onay Zinciri Darboğazı',
  topRisks: 'Öncelikli Riskler',
  agentActivity: 'Sanal Agent Aktivitesi',
  visitPerformance: 'Ziyaret Performansı',
};

export interface UserDashboardLayout {
  widgets: { key: WK; enabled: boolean }[];
  order: WK[];
}

// Rolün geçerli varsayılanı: tenant GM'i bu rol için özel şablon tanımladıysa
// (roleTemplateOverride, Tenant.moduleSettings.dashboardRoleTemplates'ten gelir) o
// kullanılır, yoksa hardcode ROLE_DASHBOARD'a düşülür.
export function resolveRoleDefault(role: string | undefined, roleTemplateOverride?: WK[] | null): WK[] {
  if (roleTemplateOverride && roleTemplateOverride.length > 0) {
    return roleTemplateOverride.filter(k => ALL_WIDGET_KEYS.includes(k));
  }
  return ROLE_DASHBOARD[role || ''] || DEFAULT_WIDGETS;
}

// Kayıtlı kişiselleştirme varsa ondan, yoksa rol varsayılanından (tenant override
// öncelikli) widget listesini üretir.
export function resolveEffectiveWidgets(role: string | undefined, saved: UserDashboardLayout | null, roleTemplateOverride?: WK[] | null): WK[] {
  if (saved) {
    const enabledSet = new Set(saved.widgets.filter(w => w.enabled).map(w => w.key));
    return saved.order.filter(k => ALL_WIDGET_KEYS.includes(k) && enabledSet.has(k));
  }
  return resolveRoleDefault(role, roleTemplateOverride);
}

// Düzenle panelinin başlangıç durumu: tüm katalog widget'ları, kayıtlı sıra/seçim
// (varsa) + eksik olanlar sona eklenir (yeni eklenen kataloğa göre geriye uyumlu).
export function buildEditableLayout(role: string | undefined, saved: UserDashboardLayout | null, roleTemplateOverride?: WK[] | null): { key: WK; enabled: boolean }[] {
  const defaultOrder = resolveRoleDefault(role, roleTemplateOverride);
  if (saved) {
    const known = saved.order.filter(k => ALL_WIDGET_KEYS.includes(k));
    const seen = new Set(known);
    const rest = ALL_WIDGET_KEYS.filter(k => !seen.has(k));
    const enabledMap = new Map(saved.widgets.map(w => [w.key, w.enabled]));
    return [...known, ...rest].map(k => ({ key: k, enabled: enabledMap.get(k) ?? false }));
  }
  const rest = ALL_WIDGET_KEYS.filter(k => !defaultOrder.includes(k));
  return [...defaultOrder, ...rest].map(k => ({ key: k, enabled: defaultOrder.includes(k) }));
}

// Kartta .slice(0,N) ile kısaltılan gerçek bir liste olan widget'lar — sadece
// bunlar için "Detay" (drill-down) affordance'ı anlamlı. Aggregate/özet
// kartlar (kpiOverview, financingGap, tenderPipeline, purchaseRequests,
// projects, withdrawnTenders, myTasks) zaten tüm veriyi gösteriyor.
export const WIDGET_HAS_DETAIL: Partial<Record<WK, true>> = {
  costApprovals: true,
  tenderDeadlines: true,
  guaranteeExpiries: true,
  guaranteeRequests: true,
  bomHandoffs: true,
  invoicesDue: true,
  milestonesDue: true,
  myOpportunities: true,
  contractDeadlines: true,
  legalDeadlines: true,
  approvalBottlenecks: true,
  topRisks: true,
  visitPerformance: true,
};

// "Detay" panelinden ilgili modüle geçiş hedefi (Dashboard'daki go() ile aynı hedefler).
export const WIDGET_TARGET_TAB: Partial<Record<WK, string>> = {
  costApprovals: 'crm-cost',
  tenderDeadlines: 'sales-support',
  guaranteeExpiries: 'finance',
  guaranteeRequests: 'finance',
  financingGap: 'finance',
  tenderPipeline: 'sales-support',
  bomHandoffs: 'presales',
  invoicesDue: 'finance',
  milestonesDue: 'project-mgmt',
  purchaseRequests: 'procurement',
  projects: 'project-mgmt',
  myOpportunities: 'crm-opportunities',
  myTasks: 'todo',
  contractDeadlines: 'contract-workflow',
  legalDeadlines: 'contract-workflow',
  topRisks: 'corporate-governance',
  agentActivity: 'virtual-agents-test',
  visitPerformance: 'visit-plan',
};

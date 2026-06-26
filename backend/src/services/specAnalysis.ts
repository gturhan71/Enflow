// Enflow — Şartname/Sözleşme analizi (ortak servis)
// ─────────────────────────────────────────────────────────────────────────────
// İdari/teknik şartname + sözleşme metnini analiz edip "verilmesi gereken
// dökümanlar" listesi (+ görev/madde/özet) üretir. Tenant'ın yapılandırdığı YZ
// (istenilen sağlayıcı — Entegrasyonlar ekranı) varsa onu, yoksa deterministik
// mock fallback'i kullanır. Hem contractWorkflow hem tenders route'ları bu
// servisi kullanır (DRY).

import { chatJSON } from './aiClient';

export interface AnalyzedDoc {
  name: string;
  docType: string; // TAX|BANK|LEGAL|FIRM_CERT|SPEC|ADMIN|OTHER
  description: string;
  deadline_priority: string; // HIGH|MEDIUM|LOW
  estimated_days: number;
  notes: string;
}

export interface SpecAnalysis {
  documents: AnalyzedDoc[];
  tasks?: { order: number; title: string; description: string; category: string; priority: string; estimated_days: number }[];
  key_clauses?: { clause: string; impact: string; action_required: string }[];
  contract_summary?: {
    project_name?: string;
    tender_no?: string;
    type?: string;
    tax_obligations?: string[];
    key_deadlines?: string[];
    special_requirements?: string[];
    project_impacts?: string[];
  };
}

const PROMPT_HEADER = `Aşağıdaki sözleşme metni ve/veya idari/teknik şartnameyi analiz et.
Yanıtı YALNIZCA geçerli JSON olarak ver, açıklama veya markdown olmadan.

Beklenen format:
{
  "documents": [
    { "name": "Belge adı", "docType": "TAX|BANK|LEGAL|FIRM_CERT|SPEC|ADMIN|OTHER", "description": "Ne için gerekli, nasıl temin edilir", "deadline_priority": "HIGH|MEDIUM|LOW", "estimated_days": 3, "notes": "Varsa özel not" }
  ],
  "tasks": [
    { "order": 1, "title": "Yapılacak iş", "description": "Detay", "category": "TAX|LEGAL|ADMIN|TECHNICAL|OTHER", "priority": "HIGH|MEDIUM|LOW", "estimated_days": 2 }
  ],
  "key_clauses": [
    { "clause": "Madde başlığı", "impact": "Etki", "action_required": "Yapılması gereken" }
  ],
  "contract_summary": {
    "project_name": "Belgedeki resmi proje/iş adı",
    "tender_no": "Varsa İKN (örn 2024/123456) — yoksa null",
    "type": "Sözleşme türü (HIZMET/MAL ALIMI/YAPIM İŞİ)",
    "tax_obligations": ["Damga vergisi %0.948", "KDV %20"],
    "key_deadlines": ["Başlangıç: X gün"],
    "special_requirements": ["Özel şart 1"],
    "project_impacts": ["Proje yönetimini etkileyecek madde 1"]
  }
}

--- BELGE ---
`;

// Standart TR kamu-ihale evrak listesi (AI yokken deterministik fallback)
export function mockDocuments(): AnalyzedDoc[] {
  return [
    { name: 'Geçici Teminat Mektubu', docType: 'BANK', description: 'Teklif bedelinin %3\'ü oranında banka teminat mektubu', deadline_priority: 'HIGH', estimated_days: 3, notes: 'Bankadan alınacak, geçerlilik süresi şartnamede belirtilen tarihi karşılamalı' },
    { name: 'Vergi Borcu Yoktur Yazısı', docType: 'TAX', description: 'Vergi dairesinden güncel tarihli belge', deadline_priority: 'HIGH', estimated_days: 2, notes: 'İnteraktif vergi dairesinden online alınabilir' },
    { name: 'SGK Borcu Yoktur Yazısı', docType: 'FIRM_CERT', description: 'SGK\'dan güncel tarihli borcu yoktur belgesi', deadline_priority: 'HIGH', estimated_days: 2, notes: 'e-Devlet üzerinden alınabilir' },
    { name: 'Ticaret Odası Faaliyet Belgesi', docType: 'LEGAL', description: 'Son 6 ay içinde alınmış güncel faaliyet belgesi', deadline_priority: 'MEDIUM', estimated_days: 1, notes: 'Bağlı olunan ticaret odasından temin edilir' },
    { name: 'İmza Sirküleri', docType: 'LEGAL', description: 'Noterden onaylı güncel imza sirküleri', deadline_priority: 'MEDIUM', estimated_days: 1, notes: 'Mevcut sirküler güncel ise kullanılabilir' },
    { name: 'Ticaret Sicil Gazetesi', docType: 'LEGAL', description: 'Şirketin kuruluş ve son durumunu gösteren sicil gazeteleri', deadline_priority: 'MEDIUM', estimated_days: 1, notes: 'Mevcut nüsha geçerli olabilir' },
    { name: 'İş Deneyim Belgesi', docType: 'FIRM_CERT', description: 'Benzer iş bitirme/iş deneyim belgesi', deadline_priority: 'MEDIUM', estimated_days: 2, notes: 'Önceki sözleşmelerden temin edilir' },
    { name: 'Birim Fiyat Teklif Cetveli', docType: 'ADMIN', description: 'İdari şartname ekindeki cetvele göre doldurulacak teklif', deadline_priority: 'HIGH', estimated_days: 1, notes: 'Maliyet analizinden beslenir' },
  ];
}

function mockAnalysis(fallbackName?: string | null, fallbackNo?: string | null): SpecAnalysis {
  return {
    documents: mockDocuments(),
    tasks: [
      { order: 1, title: 'Geçici teminat mektubunu bankaya hazırlat', description: 'Teklif bedeli belirlendikten sonra %3 oranında geçici teminat mektubu temin et', category: 'LEGAL', priority: 'HIGH', estimated_days: 3 },
      { order: 2, title: 'Vergi ve SGK borcu yoktur belgelerini al', description: 'Güncel tarihli belgeleri temin et', category: 'TAX', priority: 'HIGH', estimated_days: 2 },
      { order: 3, title: 'Birim fiyat teklif cetvelini doldur', description: 'Maliyet analizine göre teklif cetvelini hazırla', category: 'ADMIN', priority: 'HIGH', estimated_days: 1 },
    ],
    key_clauses: [
      { clause: 'Geçici/Kesin Teminat', impact: 'Teminat mektuplarının geçerlilik süresi son teklif tarihini karşılamalı', action_required: 'Banka ile süreleri teyit et' },
      { clause: 'Yeterlik Kriterleri', impact: 'İş deneyim ve mali yeterlik şartları sağlanmalı', action_required: 'Belgeleri erkenden topla' },
    ],
    contract_summary: {
      project_name: fallbackName || undefined,
      tender_no: fallbackNo || undefined,
      type: 'MAL ALIMI / HİZMET',
      tax_obligations: ['Damga Vergisi %0.948', 'KDV %20'],
      key_deadlines: ['Son teklif tarihi şartnamede belirtildi'],
      special_requirements: ['Yerli malı / ISO sertifikaları gerekebilir'],
      project_impacts: ['Teknik şartname gereksinimleri kapsamı belirler'],
    },
  };
}

/**
 * Şartname/sözleşme metnini analiz eder; tenant YZ'si yapılandırılmamışsa ya da
 * hata olursa deterministik mock döner. Sağlayıcıdan bağımsız (bkz. aiClient).
 */
export async function analyzeSpec(
  inputText: string,
  opts: { tenantId: string; fallbackName?: string | null; fallbackNo?: string | null },
): Promise<{ analysis: SpecAnalysis; usedAI: boolean }> {
  const result = await chatJSON<SpecAnalysis>({
    tenantId: opts.tenantId,
    user: PROMPT_HEADER + inputText,
    maxTokens: 4096,
  });
  if (result) {
    if (!result.documents || result.documents.length === 0) result.documents = mockDocuments();
    return { analysis: result, usedAI: true };
  }
  return { analysis: mockAnalysis(opts.fallbackName, opts.fallbackNo), usedAI: false };
}

// Enflow — Presales şartname→ürün ayıklama (sağlayıcıdan bağımsız YZ)
// ─────────────────────────────────────────────────────────────────────────────
// Eskiden frontend client-side Gemini çağırıyordu (güvenlik ihlali + sağlayıcı
// kilidi). Artık metin ayıklama client'ta, analiz burada: tenant'ın yapılandırdığı
// YZ (Entegrasyonlar) varsa onu kullanır, yoksa anlamlı boş sonuç döner.

import { Router, Request, Response } from 'express';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { chatJSON, isAIConfigured } from '../services/aiClient';
import { logActivity } from '../services/activityLog';

const router: Router = Router();
router.use(tenantMiddleware);

interface SpecExtractResult {
  title: string;
  summary: string;
  specDetails: string;
  extractedProducts: { pn: string; description: string; quantity: number }[];
}

const PROMPT = `Aşağıdaki teknik şartname metnini analiz et ve YALNIZCA geçerli JSON döndür (markdown/açıklama yok).
Format:
{
  "title": "Şartname başlığı",
  "summary": "Kısa özet",
  "specDetails": "Teknik detayların özeti",
  "extractedProducts": [ { "pn": "Part Number", "description": "Açıklama", "quantity": 1 } ]
}

--- ŞARTNAME ---
`;

router.post('/spec-extract', asyncHandler(async (req: Request, res: Response) => {
  const { text } = req.body as { text?: string };
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Analiz için şartname metni gerekli.' });
  }

  const result = await chatJSON<SpecExtractResult>({
    tenantId: req.tenantId,
    user: PROMPT + text.slice(0, 30000),
    maxTokens: 4096,
  });

  await logActivity({
    tenantId: req.tenantId, userId: req.userId, action: 'PRESALES_SPEC_EXTRACT',
    entityType: 'OPPORTUNITY', entityId: String(req.body?.opportunityId || ''),
    details: { usedAI: Boolean(result), products: result?.extractedProducts?.length ?? 0 },
  });

  if (result) {
    return res.json({ usedAI: true, ...result });
  }
  // chatJSON hem "yapılandırılmamış" hem "yapılandırılmış ama çağrı başarısız oldu"
  // durumunda null döner (bkz. aiClient.ts — anahtar/hata detayı asla client'a
  // sızdırılmaz). İkisini burada ayırıp kullanıcıya doğru mesajı veriyoruz —
  // aksi halde yapılandırılmış bir tenant'a yanlışlıkla "yapılandırılmadı" denir.
  const configured = await isAIConfigured(req.tenantId);
  res.json({
    usedAI: false,
    title: '',
    summary: configured
      ? 'YZ entegrasyonu yapılandırılmış ama analiz çağrısı başarısız oldu — sağlayıcıya ulaşılamadı, API anahtarı/model adı geçersiz olabilir ya da sağlayıcı hesabında bakiye/kota sorunu olabilir. Ayarlar → Entegrasyonlar\'dan yapılandırmayı kontrol edin ya da birazdan tekrar deneyin.'
      : 'Yapay zeka entegrasyonu yapılandırılmadı. Ayarlar → Entegrasyonlar bölümünden bir YZ bağlayın ya da ürünleri elle ekleyin.',
    specDetails: '',
    extractedProducts: [],
  });
}));

// ─────────────────────────────────────────────────────────────────────────────
// Şartname ↔ Ürün Specsheet Uygunluk Karşılaştırması
// Teknik şartname + ürün başına bir/çok specsheet (rakip markalar) → her şartname
// maddesinin her aday tarafından karşılanıp karşılanmadığının matrisi + ürün
// başına "önerilen marka". YALNIZ tenant YZ'si yapılandırılmışsa çalışır —
// deterministik fallback YOK (AI olmadan uygunluk kıyası anlamsız). Sonuç
// istemcide xlsx'e dönüştürülür; sunucuda/DB'de iz tutulmaz (stateless).
// ─────────────────────────────────────────────────────────────────────────────

interface ComplianceCandidateIn { key?: string; label?: string; text?: string }
interface ComplianceGroupIn { key?: string; name?: string; requirements?: string[]; candidates?: ComplianceCandidateIn[] }

interface ComplianceCell {
  requirementKey: string;
  candidateKey: string;
  status: 'MEETS' | 'PARTIAL' | 'FAILS' | 'UNKNOWN';
  evidence: string;
  note: string;
}
interface ComplianceGroupResult {
  key: string;
  name: string;
  requirements: { key: string; text: string }[];
  candidates: { key: string; label: string }[];
  cells: ComplianceCell[];
  summary: { candidateKey: string; score: number; meets: number; partial: number; fails: number; unknown: number }[];
  recommendation: { candidateKey: string | null; rationale: string };
}

// AI'dan beklenen ham yanıt (madde/aday indeksleriyle — key eşlemesi sunucuda yapılır).
interface AiComplianceResponse {
  requirements?: { index: number; text: string }[];
  cells?: { requirement: number; candidate: number; status?: string; evidence?: string; note?: string }[];
  recommendation?: { candidate: number | null; rationale?: string };
}

const COMPLIANCE_PROMPT = `Sen bir teknik satın alma / ön satış (presales) uzmanısın. Aşağıda BİR teknik şartname ürünü için:
(A) şartname metni, (B) numaralı şartname maddeleri (boşsa şartname metninden SEN çıkar), (C) bir veya birden çok aday ürünün üretici teknik dökümanı (specsheet) var.
Her (madde × aday) için adayın specsheet'inin maddeyi karşılayıp karşılamadığını değerlendir.

YALNIZCA geçerli JSON döndür (markdown/açıklama YOK). Format:
{
  "requirements": [ { "index": 0, "text": "Madde metni (kısaltılmış)" } ],
  "cells": [
    { "requirement": 0, "candidate": 0, "status": "MEETS|PARTIAL|FAILS|UNKNOWN", "evidence": "Specsheet'ten kısa alıntı/sayfa — birden çok kaynak varsa ';' ile ayır", "note": "Kısa gerekçe" }
  ],
  "recommendation": { "candidate": 0, "rationale": "Neden bu aday önerildi" }
}
Kurallar:
- status: MEETS = tam karşılıyor, PARTIAL = kısmen/koşullu, FAILS = karşılamıyor, UNKNOWN = specsheet'te bilgi yok.
- Her madde için her adaya bir hücre üret. Uydurma; specsheet'te yoksa UNKNOWN de.
- "requirements" her zaman doldurulmalı (verilen maddeler varsa onları düzenli biçimde tekrarla, yoksa şartnameden çıkar).
- recommendation.candidate: en çok maddeyi karşılayan aday indeksi; hiçbiri uygun değilse null.
`;

router.post('/spec-compliance', asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as { opportunityId?: string; specText?: string; groups?: ComplianceGroupIn[] };
  const specText = (body.specText || '').trim();
  const groupsIn = Array.isArray(body.groups) ? body.groups : [];

  if (!specText) return res.status(400).json({ error: 'Şartname metni (specText) gerekli.' });
  if (groupsIn.length === 0) return res.status(400).json({ error: 'En az bir ürün grubu gerekli.' });
  const hasCandidate = groupsIn.some(g => (g.candidates || []).some(c => (c.text || '').trim()));
  if (!hasCandidate) return res.status(400).json({ error: 'En az bir specsheet metni gerekli.' });

  const configured = await isAIConfigured(req.tenantId);
  if (!configured) {
    return res.json({
      usedAI: false,
      groups: [],
      message: 'Yapay zeka entegrasyonu yapılandırılmadı. Bu özellik yalnızca Ayarlar → Entegrasyonlar bölümünden bir YZ API anahtarı tanımlandığında çalışır.',
    });
  }

  const SPEC_CAP = 15000;
  const CAND_CAP = 15000;
  const resultGroups: ComplianceGroupResult[] = [];
  let anyAI = false;
  let anyFailure = false;

  for (const g of groupsIn) {
    const gKey = String(g.key || `g${resultGroups.length}`);
    const gName = String(g.name || 'Ürün').trim() || 'Ürün';
    const candidatesIn = (g.candidates || []).filter(c => (c.text || '').trim());
    if (candidatesIn.length === 0) {
      resultGroups.push({ key: gKey, name: gName, requirements: [], candidates: [], cells: [], summary: [], recommendation: { candidateKey: null, rationale: 'Specsheet metni yok.' } });
      continue;
    }
    const candKeys = candidatesIn.map((c, i) => String(c.key || `c${i}`));
    const candLabels = candidatesIn.map((c, i) => String(c.label || `Aday ${i + 1}`).trim() || `Aday ${i + 1}`);
    const providedReqs = (g.requirements || []).map(r => String(r).trim()).filter(Boolean);

    const prompt =
      COMPLIANCE_PROMPT +
      `\n--- (A) ŞARTNAME (ürün: ${gName}) ---\n` + specText.slice(0, SPEC_CAP) +
      `\n\n--- (B) ŞARTNAME MADDELERİ ---\n` +
      (providedReqs.length ? providedReqs.map((r, i) => `${i}. ${r}`).join('\n') : '(verilmedi — şartname metninden çıkar)') +
      `\n\n--- (C) ADAY ÜRÜN SPECSHEET'LERİ ---\n` +
      candidatesIn.map((c, i) => `### Aday ${i} — ${candLabels[i]}\n${(c.text || '').slice(0, CAND_CAP)}`).join('\n\n');

    const ai = await chatJSON<AiComplianceResponse>({ tenantId: req.tenantId, user: prompt, maxTokens: 4096 });

    if (!ai) { anyFailure = true; continue; }
    anyAI = true;

    const reqTexts = (ai.requirements && ai.requirements.length
      ? [...ai.requirements].sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).map(r => String(r.text || '').trim()).filter(Boolean)
      : providedReqs);
    const requirements = reqTexts.map((t, i) => ({ key: `r${i}`, text: t }));
    const reqKeyByIndex = (idx: number) => requirements[idx]?.key;
    const candKeyByIndex = (idx: number) => candKeys[idx];

    const STATUSES = ['MEETS', 'PARTIAL', 'FAILS', 'UNKNOWN'] as const;
    const cells: ComplianceCell[] = [];
    for (const c of ai.cells || []) {
      const rKey = reqKeyByIndex(Number(c.requirement));
      const cKey = candKeyByIndex(Number(c.candidate));
      if (!rKey || !cKey) continue;
      const status = STATUSES.includes(c.status as typeof STATUSES[number]) ? (c.status as ComplianceCell['status']) : 'UNKNOWN';
      cells.push({ requirementKey: rKey, candidateKey: cKey, status, evidence: String(c.evidence || ''), note: String(c.note || '') });
    }
    // Eksik hücreleri UNKNOWN ile doldur (matris tam olsun).
    for (const r of requirements) {
      for (const ck of candKeys) {
        if (!cells.some(x => x.requirementKey === r.key && x.candidateKey === ck)) {
          cells.push({ requirementKey: r.key, candidateKey: ck, status: 'UNKNOWN', evidence: '', note: '' });
        }
      }
    }

    const summary = candKeys.map(ck => {
      const mine = cells.filter(x => x.candidateKey === ck);
      const meets = mine.filter(x => x.status === 'MEETS').length;
      const partial = mine.filter(x => x.status === 'PARTIAL').length;
      const fails = mine.filter(x => x.status === 'FAILS').length;
      const unknown = mine.filter(x => x.status === 'UNKNOWN').length;
      return { candidateKey: ck, score: meets + partial * 0.5, meets, partial, fails, unknown };
    });

    let recKey: string | null = null;
    const recIdx = ai.recommendation?.candidate;
    if (recIdx != null && candKeyByIndex(Number(recIdx))) {
      recKey = candKeyByIndex(Number(recIdx));
    } else if (summary.length) {
      recKey = [...summary].sort((a, b) => b.score - a.score)[0].candidateKey;
    }

    resultGroups.push({
      key: gKey,
      name: gName,
      requirements,
      candidates: candKeys.map((k, i) => ({ key: k, label: candLabels[i] })),
      cells,
      summary,
      recommendation: { candidateKey: recKey, rationale: String(ai.recommendation?.rationale || '') },
    });
  }

  await logActivity({
    tenantId: req.tenantId, userId: req.userId, action: 'PRESALES_SPEC_COMPLIANCE',
    entityType: 'OPPORTUNITY', entityId: String(body.opportunityId || ''),
    details: { usedAI: anyAI, groups: resultGroups.length },
  });

  if (anyAI) {
    return res.json({ usedAI: true, groups: resultGroups });
  }
  // Konfigüre ama tüm çağrılar başarısız.
  res.json({
    usedAI: false,
    groups: [],
    message: anyFailure
      ? 'YZ entegrasyonu yapılandırılmış ama karşılaştırma çağrısı başarısız oldu — sağlayıcıya ulaşılamadı, API anahtarı/model adı geçersiz olabilir ya da hesapta bakiye/kota sorunu olabilir. Ayarlar → Entegrasyonlar\'ı kontrol edin ya da birazdan tekrar deneyin.'
      : 'Karşılaştırma yapılamadı.',
  });
}));

export default router;

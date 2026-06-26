// Enflow — Presales şartname→ürün ayıklama (sağlayıcıdan bağımsız YZ)
// ─────────────────────────────────────────────────────────────────────────────
// Eskiden frontend client-side Gemini çağırıyordu (güvenlik ihlali + sağlayıcı
// kilidi). Artık metin ayıklama client'ta, analiz burada: tenant'ın yapılandırdığı
// YZ (Entegrasyonlar) varsa onu kullanır, yoksa anlamlı boş sonuç döner.

import { Router, Request, Response } from 'express';
import { asyncHandler, tenantMiddleware } from '../middleware';
import { chatJSON } from '../services/aiClient';
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
  // YZ yapılandırılmamış → boş ama tutarlı sonuç (UI kullanıcıyı yönlendirir)
  res.json({
    usedAI: false,
    title: '',
    summary: 'Yapay zeka entegrasyonu yapılandırılmadı. Ayarlar → Entegrasyonlar bölümünden bir YZ bağlayın ya da ürünleri elle ekleyin.',
    specDetails: '',
    extractedProducts: [],
  });
}));

export default router;

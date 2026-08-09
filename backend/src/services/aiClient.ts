// Enflow — Sağlayıcıdan bağımsız YZ istemcisi (provider-agnostic)
// ─────────────────────────────────────────────────────────────────────────────
// Hangi YZ'nin kullanıldığı önemsizdir: tenant kendi API key'ini "Entegrasyonlar"
// ekranından girer (moduleSettings.ai). Tek yol = OpenAI-uyumlu /chat/completions.
// OpenAI, Gemini (OpenAI-uyumlu uç), Anthropic (OpenAI-uyumlu uç), Mistral, Groq,
// OpenRouter, yerel Ollama/LM Studio… hepsi bu sözleşmeyi sunar.
//
// Anahtar ASLA loglanmaz, client'a echo edilmez. Yapılandırma yoksa null döner →
// çağıran deterministik mock'a düşer.

import { prisma } from '../prismaClient';
import { decryptForTenant } from './tenantEncryption';

export interface TenantAIConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  label?: string;
}

/** moduleSettings.ai → config; yoksa env fallback (dev); o da yoksa null. */
export async function getTenantAIConfig(tenantId: string): Promise<TenantAIConfig | null> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  let ms: Record<string, unknown> = {};
  try {
    ms = JSON.parse(tenant?.moduleSettings || '{}');
  } catch {
    ms = {};
  }
  const ai = (ms.ai as Partial<TenantAIConfig> | undefined) || undefined;
  if (ai?.baseUrl && ai?.apiKey && ai?.model) {
    // apiKey DB'de şifreli saklanır (bkz. tenantEncryption.ts) — kullanmadan önce çözülür.
    const apiKey = await decryptForTenant(tenantId, ai.apiKey);
    if (apiKey) return { baseUrl: ai.baseUrl, apiKey, model: ai.model, label: ai.label };
  }
  // Dev fallback (opsiyonel): ortam değişkeni
  const envBase = process.env.AI_BASE_URL;
  const envKey = process.env.AI_API_KEY;
  const envModel = process.env.AI_MODEL;
  if (envBase && envKey && envModel) {
    return { baseUrl: envBase, apiKey: envKey, model: envModel, label: 'env' };
  }
  return null;
}

export async function isAIConfigured(tenantId: string): Promise<boolean> {
  return (await getTenantAIConfig(tenantId)) !== null;
}

function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, '') + path;
}

/**
 * SSRF azaltımı: YZ baseUrl yalnız http(s) olabilir ve bulut metadata / link-local
 * adreslerine gidemez. (Yerel LLM — localhost/özel ağ — kasıtlı olarak serbesttir;
 * CLAUDE.md'de Ollama/LM Studio desteklenir.) Uygun değilse hata fırlatır.
 */
export function assertSafeAiUrl(rawUrl: string): void {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error('Geçersiz YZ baseUrl.');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('YZ baseUrl yalnız http/https olabilir.');
  }
  const host = u.hostname.toLowerCase();
  // Bulut sağlayıcı metadata uçları ve link-local aralığı (SSRF'de en riskli hedef).
  if (host === '169.254.169.254' || host === 'metadata.google.internal' || host.startsWith('169.254.')) {
    throw new Error('Bu ana bilgisayar adresine izin verilmiyor.');
  }
}

/**
 * Tenant YZ'sine OpenAI-uyumlu chat isteği gönderir ve JSON yanıt bekler.
 * Yapılandırma yoksa veya hata olursa null döner (çağıran mock'a düşer).
 */
export async function chatJSON<T = Record<string, unknown>>(opts: {
  tenantId: string;
  system?: string;
  user: string;
  maxTokens?: number;
}): Promise<T | null> {
  const cfg = await getTenantAIConfig(opts.tenantId);
  if (!cfg) return null;

  try {
    assertSafeAiUrl(cfg.baseUrl);
    const messages: { role: string; content: string }[] = [];
    if (opts.system) messages.push({ role: 'system', content: opts.system });
    messages.push({ role: 'user', content: opts.user });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60_000);
    let res: Response;
    try {
      res = await fetch(joinUrl(cfg.baseUrl, '/chat/completions'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          max_tokens: opts.maxTokens ?? 4096,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) return null;
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) return null;
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

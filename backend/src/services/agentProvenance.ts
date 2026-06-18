// ── Agent Provenance (Sanal Agent Köken Etiketi) ─────────────────────────────
// "Bu işlem XXX agentı tarafından yapılmıştır" izlenebilirliği için kanonik
// aktör etiketi. Bir sanal agent bir varlığı değiştirdiğinde (onay aşaması,
// görev, fatura vb.) o işlemin aktör kimliği bu biçimi kullanır; böylece bir
// sonraki adım işlemin kim/hangi agent tarafından yapıldığını BİLİR, GÖRÜR ve
// (ratifikasyon/itiraz ile) KONTROL EDER.
//
// Biçim: 'AGENT:<pluginKey>'   örn. 'AGENT:AGENT_TENDER'
// Eski (legacy) 'VIRTUAL_AGENT' düz etiketi geriye uyumlu olarak tanınır.

import { getPlugin } from './pluginCatalog';

export const AGENT_ACTOR_PREFIX = 'AGENT:';
export const LEGACY_AGENT_ACTOR = 'VIRTUAL_AGENT';

/** Bir agent eklentisi için kanonik aktör kimliği üretir. */
export function agentActorId(pluginKey: string): string {
  return `${AGENT_ACTOR_PREFIX}${pluginKey}`;
}

/** Verilen aktör kimliği bir sanal agent'a mı ait? (yeni biçim veya legacy) */
export function isAgentActor(actorId?: string | null): boolean {
  if (!actorId) return false;
  return actorId.startsWith(AGENT_ACTOR_PREFIX) || actorId === LEGACY_AGENT_ACTOR;
}

/** Aktör kimliğinden pluginKey çözer; legacy etiket için null pluginKey döner. */
export function parseAgentActor(actorId?: string | null): { pluginKey: string | null } | null {
  if (!actorId) return null;
  if (actorId.startsWith(AGENT_ACTOR_PREFIX)) {
    return { pluginKey: actorId.slice(AGENT_ACTOR_PREFIX.length) || null };
  }
  if (actorId === LEGACY_AGENT_ACTOR) {
    return { pluginKey: null };
  }
  return null;
}

/** İnsan/agent ayrımı için aktör tipi ('HUMAN' | 'AGENT'). */
export function actorType(actorId?: string | null): 'HUMAN' | 'AGENT' {
  return isAgentActor(actorId) ? 'AGENT' : 'HUMAN';
}

/** UI/log için okunur agent adı. pluginKey çözülemezse genel etiket. */
export function agentDisplayLabel(actorId?: string | null): string {
  const parsed = parseAgentActor(actorId);
  if (!parsed) return 'Sanal Agent';
  if (parsed.pluginKey) {
    return getPlugin(parsed.pluginKey)?.name ?? `Sanal Agent (${parsed.pluginKey})`;
  }
  return 'Sanal Agent';
}

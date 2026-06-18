// ── Agent Provenance (frontend aynası) ───────────────────────────────────────
// Backend `agentProvenance.ts` ile aynı kanonik etiket biçimi: 'AGENT:<pluginKey>'.
// "Bu işlem XXX agentı tarafından yapılmıştır" rozetini çözmek için yardımcılar.

export const AGENT_ACTOR_PREFIX = 'AGENT:';
export const LEGACY_AGENT_ACTOR = 'VIRTUAL_AGENT';

// pluginKey → satış/UI adı (backend PLUGIN_CATALOG ile hizalı)
export const AGENT_PLUGIN_LABELS: Record<string, string> = {
  AGENT_TENDER: 'Sanal İhale Asistanı',
  AGENT_PROJECT: 'Sanal Proje Asistanı',
  AGENT_FINANCE: 'Sanal Finans Asistanı',
  AGENT_LEGAL: 'Sanal Hukuk Asistanı',
  AGENT_CRM: 'Sanal CRM Asistanı',
  AGENT_PRESALES: 'Sanal Presales Asistanı',
  AGENT_PROCUREMENT: 'Sanal Satınalma Asistanı',
};

export function isAgentActor(actorId?: string | null): boolean {
  if (!actorId) return false;
  return actorId.startsWith(AGENT_ACTOR_PREFIX) || actorId === LEGACY_AGENT_ACTOR;
}

export function parseAgentActor(actorId?: string | null): { pluginKey: string | null } | null {
  if (!actorId) return null;
  if (actorId.startsWith(AGENT_ACTOR_PREFIX)) {
    return { pluginKey: actorId.slice(AGENT_ACTOR_PREFIX.length) || null };
  }
  if (actorId === LEGACY_AGENT_ACTOR) return { pluginKey: null };
  return null;
}

/** Okunur agent adı; aktör bir agent değilse null. */
export function agentDisplayLabel(actorId?: string | null): string | null {
  const parsed = parseAgentActor(actorId);
  if (!parsed) return null;
  if (parsed.pluginKey) {
    return AGENT_PLUGIN_LABELS[parsed.pluginKey] ?? `Sanal Agent (${parsed.pluginKey})`;
  }
  return 'Sanal Agent';
}

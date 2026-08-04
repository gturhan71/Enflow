// ── Faz 8: Sanal Agent Eklentileri (plugin/entitlement) ──────────────────────
export interface PluginDefinition {
  key: string;
  name: string;
  category: 'VIRTUAL_AGENT';
  description: string;
  unitKey?: string;
  role?: string;
  defaultMode?: 'ADVISORY' | 'AUTONOMOUS';
  allowedModes?: ('ADVISORY' | 'AUTONOMOUS')[];
  entityType?: string;
  priceNote?: string;
  status: 'AVAILABLE' | 'COMING_SOON';
  hasHandler?: boolean;
}
export interface PluginEntitlement {
  id: string;
  tenantId: string;
  pluginKey: string;
  status: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'DISABLED';
  licenseKey?: string | null;
  mode: 'ADVISORY' | 'AUTONOMOUS';
  config?: string | null;
  activatedById?: string | null;
  activatedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface EntitlementWithCatalog {
  plugin: PluginDefinition;
  entitlement: PluginEntitlement | null;
  active: boolean;
}
export interface AgentRun {
  id: string;
  tenantId: string;
  pluginKey: string;
  unitKey: string;
  entityType: string;
  entityId: string;
  mode: 'ADVISORY' | 'AUTONOMOUS';
  status: 'PENDING_RATIFICATION' | 'RATIFIED' | 'REJECTED';
  rationale?: string | null;
  outputJson?: string | null;
  triggeredById?: string | null;
  handoffTaskId?: string | null;
  actionTaken?: string | null;
  ratifiedById?: string | null;
  ratifiedAt?: string | null;
  ratifyNote?: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface ActivityLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: string | null;
  userId: string;
  actorType?: 'HUMAN' | 'AGENT' | null;
  agentRunId?: string | null;
  tenantId: string;
  timestamp: string;
}

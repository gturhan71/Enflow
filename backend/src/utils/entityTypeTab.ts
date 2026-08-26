// Enflow — `Notification.relatedModule` için domain-adı → gerçek sekme id'si
// eşlemesi. `Header.tsx`'teki `handleNotificationClick`, `relatedModule`'ü
// HİÇBİR ÇEVİRİ olmadan doğrudan `activeTab`'a yazıyor (TodoTask'ın aksine —
// bkz. `src/modules/todo/helpers.ts` `taskTargetTab()`/`MODULE_TARGET`, o zaten
// doğru çalışıyor). Bu yüzden `Notification.relatedModule`'e YALNIZ App.tsx'te
// gerçekten var olan bir `activeTab` sekme id'si yazılmalı — domain-stili
// isimler (`'OPPORTUNITY'`, `'PROJECT'` vb.) burada eşlenip çevrilir.
//
// Eşlemede bulunamayan bir tür (ör. 'GENERAL') kasıtlı olarak `undefined`
// döner — çağıran taraf `relatedModule`'ü hiç set etmemeli (no-op, kırık bir
// sekmeye gitmekten daha güvenli).
export const ENTITY_TYPE_TAB: Record<string, string> = {
  OPPORTUNITY: 'crm-opportunities',
  PROPOSAL: 'crm-proposals',
  PROJECT: 'project-mgmt',
  PROCUREMENT: 'procurement',
  PURCHASE_REQUEST: 'procurement',
  DELIVERY: 'procurement',
  CONTRACT: 'contract-workflow',
  CONTRACT_WORKFLOW_SIGNING: 'contract-workflow',
  LEGAL: 'contract-workflow',
  TENDER: 'sales-support',
};

export function entityTypeToTab(entityType?: string | null): string | undefined {
  return entityType ? ENTITY_TYPE_TAB[entityType] : undefined;
}

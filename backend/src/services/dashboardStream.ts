import { EventEmitter } from 'events';

// Dashboard'ın "anlık" güncellenmesi için basit, tek-process in-memory pub/sub
// (SQLite/dev ölçeğine uygun — Redis gerekmiyor). SSE mesajı tam veri taşımaz,
// sadece "bir şey değişti" sinyali verir; frontend bunu alınca mevcut REST
// çağrısıyla (GET /reports/dashboard) yeniden çeker — tek doğruluk kaynağı REST'te kalır.
const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export function pingDashboard(tenantId: string): void {
  emitter.emit(tenantId, { type: 'refresh', at: Date.now() });
}

export function subscribeDashboard(tenantId: string, listener: (payload: { type: string; at: number }) => void): () => void {
  emitter.on(tenantId, listener);
  return () => emitter.off(tenantId, listener);
}

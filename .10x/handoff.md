# Handoff → Architect
Strateji/kapsam onaylı (cto/ + product-manager/ prod-runtime-pg-pipeline.md). Faz 2: ADR-001 (derlenmiş runtime + OS-native servis + graceful shutdown), ADR-002 (provider-başına migration klasörü + config-tabanlı şema seçimi).
Yeni kısıtlar: src/scripts altındaki auditRoles/syncRolePermissions/backfill-profitability-view-permission governance/ import ediyor → build'e alınamaz (rootDir). reports.ts SSE uzun bağlantı tutuyor → shutdown'da closeAllConnections gerekli.

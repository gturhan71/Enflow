# Handoff → CTO/PM (Faz 1) sonra Architect (Faz 2)
Spec onaylanınca: Faz 1 kısa (strateji/kapsam spec'te net) → Faz 2'de ADR'ler:
ADR-001 derlenmiş runtime + OS-native servis; ADR-002 provider-başına migration klasörü + config-tabanlı şema seçimi.
Kritik bulgular: PG kurulumu bugün upgrade edilemiyor (kirli ağaç + sqlite migration + DDL'siz rol); index.ts'te graceful shutdown yok;
apply-postgres-rls idempotent; dist/ src/ ile aynı derinlikte → __dirname yolları güvenli.

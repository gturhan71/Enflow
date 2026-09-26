// DATABASE_URL şemasına göre Prisma şema + migration klasörünü seçer (ADR-002).
// prisma.config.ts (CLI) bunu kullanır; saf fonksiyon → birim testli.
// Postgres: prisma/postgres/schema.prisma + prisma/migrations-postgres
// Diğer (SQLite `file:` veya boş): kanonik prisma/schema.prisma + prisma/migrations
export interface PrismaPaths {
  provider: 'postgresql' | 'sqlite';
  schema: string;
  migrationsPath: string;
}

export function resolvePrismaPaths(databaseUrl?: string): PrismaPaths {
  if (databaseUrl && /^postgres(ql)?:\/\//i.test(databaseUrl.trim())) {
    return { provider: 'postgresql', schema: 'prisma/postgres/schema.prisma', migrationsPath: 'prisma/migrations-postgres' };
  }
  return { provider: 'sqlite', schema: 'prisma/schema.prisma', migrationsPath: 'prisma/migrations' };
}

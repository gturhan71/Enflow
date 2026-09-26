import { describe, it, expect } from 'vitest';
import { resolvePrismaPaths } from '../../config/prismaPaths';

describe('resolvePrismaPaths', () => {
  it.each(['postgresql://u:p@h:5432/db', 'postgres://u@h/db', '  POSTGRESQL://x/y'])('%s → postgres', (url) => {
    expect(resolvePrismaPaths(url)).toMatchObject({ provider: 'postgresql', schema: 'prisma/postgres/schema.prisma', migrationsPath: 'prisma/migrations-postgres' });
  });
  it.each(['file:./dev.db', '', undefined])('%s → sqlite', (url) => {
    expect(resolvePrismaPaths(url)).toMatchObject({ provider: 'sqlite', schema: 'prisma/schema.prisma', migrationsPath: 'prisma/migrations' });
  });
});

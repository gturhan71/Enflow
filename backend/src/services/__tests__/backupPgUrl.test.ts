import { describe, it, expect } from 'vitest';
import { pgConnEnv } from '../backupService';

describe('pgConnEnv', () => {
  it('URL parçalanır; parola yalnız env\'de, Prisma-özel parametre düşer', () => {
    expect(pgConnEnv('postgresql://mig%40x:p%3Ass%2F@db.local:6543/enflow?schema=public&sslmode=require')).toEqual({
      PGHOST: 'db.local', PGPORT: '6543', PGUSER: 'mig@x', PGPASSWORD: 'p:ss/', PGDATABASE: 'enflow', PGSSLMODE: 'require',
    });
  });
  it('varsayılan port 5432', () => {
    expect(pgConnEnv('postgresql://u:p@h/db').PGPORT).toBe('5432');
  });
});

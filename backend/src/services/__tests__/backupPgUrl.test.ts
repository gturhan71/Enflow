import { describe, it, expect } from 'vitest';
import { toLibpqUrl } from '../backupService';

describe('toLibpqUrl', () => {
  it('Prisma-özel schema parametresini ayıklar', () => {
    expect(toLibpqUrl('postgresql://u:p@h:5432/db?schema=public')).toBe('postgresql://u:p@h:5432/db');
  });
  it('libpq parametrelerini korur', () => {
    expect(toLibpqUrl('postgresql://u:p@h/db?schema=public&sslmode=require&connection_limit=5')).toBe('postgresql://u:p@h/db?sslmode=require');
  });
  it('parametresiz URL aynı kalır', () => {
    expect(toLibpqUrl('postgresql://u:p@h/db')).toBe('postgresql://u:p@h/db');
  });
});

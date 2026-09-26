import { describe, it, expect } from 'vitest';
import { checkDb } from '../../routes/health';

describe('checkDb', () => {
  it('ping başarılıysa true', async () => {
    expect(await checkDb(async () => 1, 100)).toBe(true);
  });
  it('ping hata verirse false', async () => {
    expect(await checkDb(async () => { throw new Error('down'); }, 100)).toBe(false);
  });
  it('ping süre aşımına uğrarsa false', async () => {
    expect(await checkDb(() => new Promise(() => {}), 20)).toBe(false);
  });
});

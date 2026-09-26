import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { insecureSecretFiles } from '../deploymentGuard';

const dirs: string[] = [];
function tmpFile(mode: number): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-'));
  dirs.push(d);
  const f = path.join(d, '.env');
  fs.writeFileSync(f, 'X=1\n');
  fs.chmodSync(f, mode);
  return f;
}
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

describe.skipIf(process.platform === 'win32')('insecureSecretFiles', () => {
  it('0644 ve 0640 dosyayı işaretler', () => {
    const a = tmpFile(0o644), b = tmpFile(0o640);
    expect(insecureSecretFiles([a, b])).toEqual([{ file: a, mode: '644' }, { file: b, mode: '640' }]);
  });
  it('0600 dosya temiz; olmayan dosya sessizce atlanır', () => {
    expect(insecureSecretFiles([tmpFile(0o600), '/yok/.env'])).toEqual([]);
  });
  it('win32 platformunda her zaman boş', () => {
    expect(insecureSecretFiles([tmpFile(0o644)], 'win32')).toEqual([]);
  });
});

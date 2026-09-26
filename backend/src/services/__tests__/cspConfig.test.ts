import { describe, it, expect } from 'vitest';
import { cspMode, cspDirectives, helmetCsp } from '../../config/csp';

describe('CSP yapılandırması', () => {
  it('varsayılan enforce; report-only/off kabul, çöp → enforce', () => {
    expect(cspMode({})).toBe('enforce');
    expect(cspMode({ CSP_MODE: 'Report-Only' })).toBe('report-only');
    expect(cspMode({ CSP_MODE: 'off' })).toBe('off');
    expect(cspMode({ CSP_MODE: 'yanlis' })).toBe('enforce');
  });
  it('script-src YALNIZ self (satır içi/eval yok), object-src none, frame-ancestors none', () => {
    const d = cspDirectives({});
    expect(d['script-src']).toEqual(["'self'"]);
    expect(d['object-src']).toEqual(["'none'"]);
    expect(d['frame-ancestors']).toEqual(["'none'"]);
    expect(d['script-src'].join(' ')).not.toMatch(/unsafe/);
  });
  it('HTTP on-prem için upgrade-insecure-requests yok; rapor uçu tanımlı', () => {
    const d = cspDirectives({});
    expect('upgrade-insecure-requests' in d).toBe(false);
    expect(d['report-uri']).toEqual(['/api/csp-report']);
  });
  it('ekstra origin\'ler env\'den eklenir', () => {
    const d = cspDirectives({ CSP_EXTRA_CONNECT: 'https://a.example, https://b.example', CSP_EXTRA_IMG: 'https://img.example' });
    expect(d['connect-src']).toEqual(expect.arrayContaining(["'self'", 'https://a.example', 'https://b.example']));
    expect(d['img-src']).toContain('https://img.example');
  });
  it('helmetCsp: off → false; report-only → reportOnly:true', () => {
    expect(helmetCsp({ CSP_MODE: 'off' })).toBe(false);
    expect(helmetCsp({ CSP_MODE: 'report-only' })).toMatchObject({ reportOnly: true, useDefaults: false });
    expect(helmetCsp({})).toMatchObject({ reportOnly: false });
  });
});

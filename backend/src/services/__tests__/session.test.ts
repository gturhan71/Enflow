import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { parseCookies, getRequestToken, csrfViolation, cookieSecure, tokenRemainingSeconds, SESSION_COOKIE } from '../session';

const req = (headers: Record<string, string>, method = 'POST') => ({ method, headers }) as never;
const ALLOWED = ['http://localhost:3000'];

describe('parseCookies', () => {
  it('birden çok çerezi ayrıştırır, kodlamayı çözer, ilk değer kazanır', () => {
    expect(parseCookies('a=1; enflow_session=abc%3D; a=2')).toEqual({ a: '1', enflow_session: 'abc=' });
  });
  it('boş / bozuk başlık güvenli', () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies('=x; kötü; y=%E0%A4%A')).toEqual({});
  });
});

describe('getRequestToken', () => {
  it('Bearer önceliklidir', () => {
    expect(getRequestToken(req({ authorization: 'Bearer T1', cookie: `${SESSION_COOKIE}=T2` }))).toEqual({ token: 'T1', via: 'bearer' });
  });
  it('yalnız çerez → cookie', () => {
    expect(getRequestToken(req({ cookie: `x=1; ${SESSION_COOKIE}=T2` }))).toEqual({ token: 'T2', via: 'cookie' });
  });
  it('hiçbiri → undefined; boş Bearer çereze düşer', () => {
    expect(getRequestToken(req({}))).toBeUndefined();
    expect(getRequestToken(req({ authorization: 'Bearer  ', cookie: `${SESSION_COOKIE}=T2` }))?.via).toBe('cookie');
  });
});

describe('csrfViolation (yalnız çerezle gelen, durum değiştiren istekler)', () => {
  const ok = { 'x-enflow-csrf': '1', host: 'app.local:3002', origin: 'http://app.local:3002' };
  it('Bearer istekleri denetlenmez (tarayıcı otomatik eklemez)', () => {
    expect(csrfViolation(req({}), 'bearer', ALLOWED)).toBeNull();
  });
  it('GET/HEAD/OPTIONS denetlenmez', () => {
    expect(csrfViolation(req({}, 'GET'), 'cookie', ALLOWED)).toBeNull();
  });
  it('özel başlık yoksa reddeder', () => {
    expect(csrfViolation(req({ host: 'a', origin: 'http://a' }), 'cookie', ALLOWED)).toMatch(/X-Enflow-CSRF/);
  });
  it('başlık + aynı-host Origin → kabul', () => {
    expect(csrfViolation(req(ok), 'cookie', ALLOWED)).toBeNull();
  });
  it('başlık + izinli listedeki Origin (vite/proxy) → kabul', () => {
    expect(csrfViolation(req({ 'x-enflow-csrf': '1', host: 'localhost:3002', origin: 'http://localhost:3000' }), 'cookie', ALLOWED)).toBeNull();
  });
  it('yabancı Origin → reddeder (başlık olsa bile)', () => {
    expect(csrfViolation(req({ ...ok, origin: 'https://evil.example' }), 'cookie', ALLOWED)).toMatch(/Origin/);
  });
  it('Sec-Fetch-Site: cross-site ve opak Origin → reddeder', () => {
    expect(csrfViolation(req({ ...ok, 'sec-fetch-site': 'cross-site' }), 'cookie', ALLOWED)).toMatch(/çapraz-site/);
    expect(csrfViolation(req({ ...ok, origin: 'null' }), 'cookie', ALLOWED)).toMatch(/opak/);
  });
  it('Origin yoksa (tarayıcı dışı istemci) başlık yeterli', () => {
    expect(csrfViolation(req({ 'x-enflow-csrf': '1', host: 'a' }), 'cookie', ALLOWED)).toBeNull();
  });
});

describe('cookieSecure / tokenRemainingSeconds', () => {
  it('COOKIE_SECURE zorlaması ve auto', () => {
    const prev = process.env.COOKIE_SECURE;
    try {
      process.env.COOKIE_SECURE = 'true'; expect(cookieSecure({ secure: false } as never)).toBe(true);
      process.env.COOKIE_SECURE = 'false'; expect(cookieSecure({ secure: true } as never)).toBe(false);
      delete process.env.COOKIE_SECURE; expect(cookieSecure({ secure: true } as never)).toBe(true);
      expect(cookieSecure({ secure: false } as never)).toBe(false);
    } finally { if (prev === undefined) delete process.env.COOKIE_SECURE; else process.env.COOKIE_SECURE = prev; }
  });
  it('Max-Age JWT exp\'inden türetilir', () => {
    const t = jwt.sign({ a: 1 }, 'k', { expiresIn: 3600 });
    expect(tokenRemainingSeconds(t)).toBeGreaterThan(3590);
    expect(tokenRemainingSeconds(t)).toBeLessThanOrEqual(3600);
  });
});

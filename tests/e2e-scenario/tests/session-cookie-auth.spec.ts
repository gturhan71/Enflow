import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createIsolatedTestDb, destroyTestDb } from '../helpers/testDb';
import { startBackend, type RunningBackend } from '../helpers/backendProcess';

// Senaryo: SESSION-COOKIE-AUTH (P0-3). JWT artık tarayıcıda localStorage'da DEĞİL, httpOnly çerezde:
// XSS token'ı okuyamaz. Oracle: çerez yalnızca doğru CSRF savunmasıyla durum değiştirebilir; Bearer
// (API istemcileri/testler) eskisi gibi çalışır; yanıt başlıklarında sıkı CSP vardır.
describe('SESSION-COOKIE-AUTH', () => {
  const PORT = 3107;
  let dbHandle: { absPath: string; databaseUrl: string };
  let backend: RunningBackend;
  let base: string;
  const admin = { name: 'Cookie GM', email: 'cookie-gm@e2e.test', password: 'test1234' };
  let cookie = '';        // "enflow_session=<jwt>" (yalnız çerez testleri için)
  let bearer = '';        // aynı kullanıcı, API istemcisi olarak

  const api = (path: string, init: RequestInit & { headers?: Record<string, string> } = {}) =>
    fetch(`${base}/api${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) } });
  const sessionCookieFrom = (res: Response) => (res.headers.getSetCookie?.() ?? []).find((c) => c.startsWith('enflow_session=')) ?? '';

  beforeAll(async () => {
    dbHandle = createIsolatedTestDb('session-cookie-auth');
    backend = await startBackend({ databaseUrl: dbHandle.databaseUrl, port: PORT });
    base = backend.baseUrl;
  });
  afterAll(async () => {
    await backend?.stop();
    if (dbHandle?.absPath) destroyTestDb(dbHandle.absPath);
  });

  it('ilk kurulum (web istemcisi): çerez set edilir, gövdede token YOK; çerez httpOnly + SameSite=Lax', async () => {
    const res = await api('/setup/init', { method: 'POST', headers: { 'X-Enflow-Client': 'web' }, body: JSON.stringify({ company: { name: 'Cookie Co' }, admin }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.token).toBeUndefined();
    const sc = sessionCookieFrom(res);
    expect(sc).toMatch(/HttpOnly/i);
    expect(sc).toMatch(/SameSite=Lax/i);
    expect(sc).toMatch(/Path=\//);
    expect(sc).not.toMatch(/Secure/i); // http test ortamı (COOKIE_SECURE=auto → yalnız HTTPS'te)
    cookie = sc.split(';')[0];
  });

  it('login: API istemcisi gövdede token alır (geriye uyumlu); web istemcisi ALMAZ ama çerez alır', async () => {
    const plain = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: admin.email, password: admin.password }) });
    const pb = await plain.json();
    expect(typeof pb.token).toBe('string');
    bearer = pb.token;
    const web = await api('/auth/login', { method: 'POST', headers: { 'X-Enflow-Client': 'web' }, body: JSON.stringify({ email: admin.email, password: admin.password }) });
    const wb = await web.json();
    expect(wb.token).toBeUndefined();
    expect(wb.user.password).toBeUndefined();
    expect(sessionCookieFrom(web)).toMatch(/^enflow_session=/);
  });

  it('yalnız çerezle (Authorization yok) okuma çalışır; GET /auth/session kullanıcıyı verir, parolasız', async () => {
    expect((await api('/customers', { headers: { Cookie: cookie } })).status).toBe(200);
    const s = await api('/auth/session', { headers: { Cookie: cookie } });
    expect(s.status).toBe(200);
    const sb = await s.json();
    expect(sb.user.email).toBe(admin.email);
    expect(sb.user.password).toBeUndefined();
    expect(sb.user.tenant.dekWrapped).toBeUndefined();
    // oturum yok / kurcalanmış → 200 { user: null } (401 değil: konsolda gereksiz kırmızı hata düşmesin)
    const none = await api('/auth/session');
    expect(none.status).toBe(200);
    expect((await none.json()).user).toBeNull();
  });

  it('çerezle durum değiştirme: CSRF başlığı yok → 403; başlıkla → 2xx', async () => {
    const noHeader = await api('/customers', { method: 'POST', headers: { Cookie: cookie }, body: JSON.stringify({ name: 'CSRF Yok' }) });
    expect(noHeader.status).toBe(403);
    expect((await noHeader.json()).error).toMatch(/CSRF/);
    const withHeader = await api('/customers', { method: 'POST', headers: { Cookie: cookie, 'X-Enflow-CSRF': '1' }, body: JSON.stringify({ name: 'CSRF Var' }) });
    expect([200, 201]).toContain(withHeader.status);
  });

  it('yabancı Origin ya da cross-site → 403 (başlık olsa bile); aynı-host Origin kabul', async () => {
    const h = { Cookie: cookie, 'X-Enflow-CSRF': '1' };
    const evil = await api('/customers', { method: 'POST', headers: { ...h, Origin: 'https://evil.example' }, body: JSON.stringify({ name: 'X' }) });
    expect(evil.status).toBe(403);
    const cross = await api('/customers', { method: 'POST', headers: { ...h, 'Sec-Fetch-Site': 'cross-site' }, body: JSON.stringify({ name: 'X' }) });
    expect(cross.status).toBe(403);
    const same = await api('/customers', { method: 'POST', headers: { ...h, Origin: base }, body: JSON.stringify({ name: 'Aynı Origin' }) });
    expect([200, 201]).toContain(same.status);
  });

  it('Bearer ile durum değiştirme CSRF başlığı İSTEMEZ (API istemcileri/testler bozulmaz)', async () => {
    const r = await api('/customers', { method: 'POST', headers: { Authorization: `Bearer ${bearer}` }, body: JSON.stringify({ name: 'Bearer Müşteri' }) });
    expect([200, 201]).toContain(r.status);
  });

  it('kurcalanmış çerez → 401', async () => {
    const bad = cookie.slice(0, -3) + 'AAA';
    expect((await api('/customers', { headers: { Cookie: bad } })).status).toBe(401);
  });

  it('logout: çerez temizlenir (Max-Age=0/geçmiş Expires); CSRF başlığı yoksa 403', async () => {
    expect((await api('/auth/logout', { method: 'POST', headers: { Cookie: cookie } })).status).toBe(403);
    const out = await api('/auth/logout', { method: 'POST', headers: { Cookie: cookie, 'X-Enflow-CSRF': '1' } });
    expect(out.status).toBe(200);
    expect(sessionCookieFrom(out)).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/);
  });

  it('sıkı CSP başlığı: script-src yalnız self, frame-ancestors none, rapor uçu; /api/csp-report 204', async () => {
    const res = await api('/health');
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toMatch(/script-src 'self'(;|$)/);
    expect(csp).not.toMatch(/script-src[^;]*unsafe/);
    expect(csp).toMatch(/frame-ancestors 'none'/);
    expect(csp).toMatch(/object-src 'none'/);
    expect(csp).toMatch(/report-uri \/api\/csp-report/);
    const rep = await api('/csp-report', { method: 'POST', headers: { 'Content-Type': 'application/csp-report' }, body: JSON.stringify({ 'csp-report': { 'violated-directive': 'script-src', 'blocked-uri': 'inline' } }) });
    expect(rep.status).toBe(204);
  });
});

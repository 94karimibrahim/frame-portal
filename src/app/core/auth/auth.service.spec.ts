import type { MockedObject } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiResponse, AuthResult } from '../models';
import { AuthService } from './auth.service';
import { DeviceService } from './device.service';
import { TokenStore } from './token-store.service';

/** Builds a minimal JWT (`header.payload.sig`) whose payload carries the given claims. */
function jwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'none' })}.${b64(claims)}.sig`;
}

function envelope<T>(data: T): ApiResponse<T> {
  return { data, success: true, message: null, correlationId: null };
}

function authResult(accessToken: string, refreshToken = 'r1'): AuthResult {
  return {
    accessToken,
    refreshToken,
    refreshTokenExpiresAt: '2099-01-01T00:00:00Z',
    userId: 'u1',
    email: 'user@example.com',
    fullName: 'Test User',
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let tokens: MockedObject<TokenStore>;
  let refreshToken: string | null;
  let cookieSessionHint: boolean;

  const API = '/api';

  beforeEach(() => {
    refreshToken = null;
    cookieSessionHint = false;
    tokens = {
      setTokens: vi.fn().mockName('TokenStore.setTokens'),
      setAccessToken: vi.fn().mockName('TokenStore.setAccessToken'),
      clear: vi.fn().mockName('TokenStore.clear'),
      getRefreshToken: vi.fn().mockName('TokenStore.getRefreshToken'),
      hasRefreshToken: vi.fn().mockName('TokenStore.hasRefreshToken'),
      hasSession: vi.fn().mockName('TokenStore.hasSession'),
    } as unknown as MockedObject<TokenStore>;
    tokens.getRefreshToken.mockImplementation(() => refreshToken);
    tokens.hasRefreshToken.mockImplementation(() => refreshToken !== null);
    tokens.hasSession.mockImplementation(() => refreshToken !== null || cookieSessionHint);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AuthService,
        { provide: TokenStore, useValue: tokens },
        { provide: DeviceService, useValue: { getDeviceId: () => 'device-1' } },
      ],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('establishes identity, stores tokens, and loads permissions on login', () => {
    const token = jwt({ tenant_id: 't1' });
    service.login({ email: 'user@example.com', password: 'secret12' }).subscribe();

    httpMock.expectOne(`${API}/auth/login`).flush(envelope(authResult(token)));
    httpMock.expectOne(`${API}/permissions/mine`).flush(envelope(['users.list']));

    expect(tokens.setTokens).toHaveBeenCalledWith(token, 'r1');
    expect(service.isAuthenticated()).toBe(true);
    expect(service.identity()?.email).toBe('user@example.com');
    expect(service.identity()?.tenantId).toBe('t1');
    expect(service.hasPermission('users.list')).toBe(true);
    expect(service.hasPermission('users.delete')).toBe(false);
  });

  it('treats a SuperAdmin as holding every permission', () => {
    service.login({ email: 'root@example.com', password: 'secret12' }).subscribe();

    httpMock
      .expectOne(`${API}/auth/login`)
      .flush(envelope(authResult(jwt({ role: 'SuperAdmin' }))));
    httpMock.expectOne(`${API}/permissions/mine`).flush(envelope([]));

    expect(service.isSuperAdmin()).toBe(true);
    expect(service.hasPermission('anything.at.all')).toBe(true);
    expect(service.hasAll(['a.b', 'c.d'])).toBe(true);
  });

  it('clearSession wipes tokens, identity and permissions', () => {
    service.login({ email: 'user@example.com', password: 'secret12' }).subscribe();
    httpMock.expectOne(`${API}/auth/login`).flush(envelope(authResult(jwt({}))));
    httpMock.expectOne(`${API}/permissions/mine`).flush(envelope(['users.list']));
    expect(service.isAuthenticated()).toBe(true);

    service.clearSession();

    expect(tokens.clear).toHaveBeenCalled();
    expect(service.isAuthenticated()).toBe(false);
    expect(service.hasPermission('users.list')).toBe(false);
  });

  it('refresh() errors (without a network call) when no refresh token is held', () => {
    refreshToken = null;
    let errored = false;
    service.refresh().subscribe({ error: () => (errored = true) });

    expect(errored).toBe(true);
    httpMock.expectNone(`${API}/auth/refresh`);
  });

  it('single-flights concurrent refresh() calls into one rotation', () => {
    refreshToken = 'r0';
    const results: string[] = [];
    // Two overlapping callers (e.g. the interceptor's 401 retry and the bootstrap session restore).
    service.refresh().subscribe((r) => results.push(r.accessToken));
    service.refresh().subscribe((r) => results.push(r.accessToken));

    // Exactly one POST despite two subscribers, so the (single-use) refresh token is never replayed.
    const req = httpMock.expectOne(`${API}/auth/refresh`);
    expect(req.request.body).toEqual({ refreshToken: 'r0' });
    req.flush(envelope(authResult(jwt({}))));

    expect(results.length).toBe(2);
    expect(tokens.setTokens).toHaveBeenCalledTimes(1);

    // Once settled, the in-flight sharing is released so a later refresh issues a fresh request.
    service.refresh().subscribe();
    httpMock.expectOne(`${API}/auth/refresh`).flush(envelope(authResult(jwt({}))));
  });

  it('restoreSession() resolves false and clears the session when the rotation fails', () => {
    refreshToken = 'r-dead';
    let restored: boolean | undefined;
    service.restoreSession().subscribe((ok) => (restored = ok));

    // The stored refresh token is expired/revoked â€” the backend rejects the rotation.
    httpMock
      .expectOne(`${API}/auth/refresh`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    // Never errors (bootstrap awaits it bare), and the dead token is dropped so the
    // next reload doesn't replay it.
    expect(restored).toBe(false);
    expect(tokens.clear).toHaveBeenCalled();
    expect(service.isAuthenticated()).toBe(false);
  });

  // ── Cookie mode: the refresh token rides an httpOnly cookie; JS holds no token, only a hint ────

  it('refresh() in cookie mode posts an empty body token (the cookie carries the real one)', () => {
    refreshToken = null;
    cookieSessionHint = true;
    service.refresh().subscribe();

    const req = httpMock.expectOne(`${API}/auth/refresh`);
    expect(req.request.body).toEqual({ refreshToken: '' });
    // Cookie mode responses redact the body token; the store receives the empty marker.
    req.flush(envelope(authResult(jwt({}), '')));

    expect(tokens.setTokens).toHaveBeenCalledWith(expect.any(String), '');
  });

  it('restoreSession() attempts a cookie restore when only the session hint exists', () => {
    refreshToken = null;
    cookieSessionHint = true;
    let restored: boolean | undefined;
    service.restoreSession().subscribe((ok) => (restored = ok));

    httpMock.expectOne(`${API}/auth/refresh`).flush(envelope(authResult(jwt({}), '')));
    httpMock.expectOne(`${API}/permissions/mine`).flush(envelope(['users.list']));

    expect(restored).toBe(true);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('restoreSession() clears a stale hint when the cookie is dead', () => {
    refreshToken = null;
    cookieSessionHint = true;
    let restored: boolean | undefined;
    service.restoreSession().subscribe((ok) => (restored = ok));

    httpMock
      .expectOne(`${API}/auth/refresh`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(restored).toBe(false);
    expect(tokens.clear).toHaveBeenCalled();
  });
});

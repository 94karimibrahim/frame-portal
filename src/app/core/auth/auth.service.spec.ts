import { provideHttpClient, withXhr } from '@angular/common/http';
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

function authResult(accessToken: string): AuthResult {
  return {
    accessToken,
    refreshToken: 'r1',
    refreshTokenExpiresAt: '2099-01-01T00:00:00Z',
    userId: 'u1',
    email: 'user@example.com',
    fullName: 'Test User',
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  let tokens: jasmine.SpyObj<TokenStore>;
  let refreshToken: string | null;

  const API = '/api';

  beforeEach(() => {
    refreshToken = null;
    tokens = jasmine.createSpyObj<TokenStore>('TokenStore', [
      'setTokens',
      'setAccessToken',
      'clear',
      'getRefreshToken',
      'hasRefreshToken',
    ]);
    tokens.getRefreshToken.and.callFake(() => refreshToken);
    tokens.hasRefreshToken.and.callFake(() => refreshToken !== null);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr()),
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
    expect(service.isAuthenticated()).toBeTrue();
    expect(service.identity()?.email).toBe('user@example.com');
    expect(service.identity()?.tenantId).toBe('t1');
    expect(service.hasPermission('users.list')).toBeTrue();
    expect(service.hasPermission('users.delete')).toBeFalse();
  });

  it('treats a SuperAdmin as holding every permission', () => {
    service.login({ email: 'root@example.com', password: 'secret12' }).subscribe();

    httpMock
      .expectOne(`${API}/auth/login`)
      .flush(envelope(authResult(jwt({ role: 'SuperAdmin' }))));
    httpMock.expectOne(`${API}/permissions/mine`).flush(envelope([]));

    expect(service.isSuperAdmin()).toBeTrue();
    expect(service.hasPermission('anything.at.all')).toBeTrue();
    expect(service.hasAll(['a.b', 'c.d'])).toBeTrue();
  });

  it('clearSession wipes tokens, identity and permissions', () => {
    service.login({ email: 'user@example.com', password: 'secret12' }).subscribe();
    httpMock.expectOne(`${API}/auth/login`).flush(envelope(authResult(jwt({}))));
    httpMock.expectOne(`${API}/permissions/mine`).flush(envelope(['users.list']));
    expect(service.isAuthenticated()).toBeTrue();

    service.clearSession();

    expect(tokens.clear).toHaveBeenCalled();
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.hasPermission('users.list')).toBeFalse();
  });

  it('refresh() errors (without a network call) when no refresh token is held', () => {
    refreshToken = null;
    let errored = false;
    service.refresh().subscribe({ error: () => (errored = true) });

    expect(errored).toBeTrue();
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

    // The stored refresh token is expired/revoked — the backend rejects the rotation.
    httpMock
      .expectOne(`${API}/auth/refresh`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    // Never errors (bootstrap awaits it bare), and the dead token is dropped so the
    // next reload doesn't replay it.
    expect(restored).toBeFalse();
    expect(tokens.clear).toHaveBeenCalled();
    expect(service.isAuthenticated()).toBeFalse();
  });
});

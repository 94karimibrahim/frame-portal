import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { TokenStore } from '../auth/token-store.service';
import { AuthResult } from '../models';
import { refreshInterceptor } from './refresh.interceptor';

const authResult: AuthResult = {
  accessToken: 'a2',
  refreshToken: 'r2',
  refreshTokenExpiresAt: '2099-01-01T00:00:00Z',
  userId: 'u1',
  email: 'user@example.com',
  fullName: 'Test User',
};

/**
 * Covers the single-flight 401 refresh: one rotation shared across concurrent failures, a transparent
 * retry of the original request, and — when refresh itself fails — session clear + redirect to login.
 */
describe('refreshInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: jasmine.SpyObj<AuthService>;
  let router: { navigate: jasmine.Spy };
  let hasRefreshToken: boolean;

  function configure(refresh: Observable<AuthResult>): void {
    hasRefreshToken = true;
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['refresh', 'clearSession']);
    auth.refresh.and.returnValue(refresh);
    router = { navigate: jasmine.createSpy('navigate').and.resolveTo(true) };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([refreshInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: TokenStore, useValue: { hasRefreshToken: () => hasRefreshToken } },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => httpMock.verify());

  it('refreshes once on a 401, then retries the original request', () => {
    configure(of(authResult));
    let ok: unknown;
    http.get('/api/data').subscribe((r) => (ok = r));

    httpMock.expectOne('/api/data').flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('/api/data').flush({ value: 42 });

    expect(auth.refresh).toHaveBeenCalledTimes(1);
    expect(ok).toEqual({ value: 42 });
  });

  it('clears the session and redirects to login when refresh fails', () => {
    configure(throwError(() => new Error('refresh expired')));
    let errored = false;
    http.get('/api/data').subscribe({ error: () => (errored = true) });

    httpMock.expectOne('/api/data').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(errored).toBeTrue();
    expect(auth.clearSession).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { reason: 'session-expired' },
    });
  });

  it('does not refresh on a 401 from an /auth/ endpoint (genuine credential error)', () => {
    configure(of(authResult));
    let errored = false;
    http.post('/api/auth/login', {}).subscribe({ error: () => (errored = true) });

    httpMock.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.refresh).not.toHaveBeenCalled();
    expect(errored).toBeTrue();
  });

  it('does not refresh when no refresh token is held', () => {
    configure(of(authResult));
    hasRefreshToken = false;
    let errored = false;
    http.get('/api/data').subscribe({ error: () => (errored = true) });

    httpMock.expectOne('/api/data').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.refresh).not.toHaveBeenCalled();
    expect(errored).toBeTrue();
  });

  it('shares a single refresh across concurrent 401s (single-flight)', () => {
    const gate = new Subject<AuthResult>();
    configure(gate.asObservable());

    http.get('/api/a').subscribe();
    http.get('/api/b').subscribe();

    // Both in-flight requests fail before the refresh resolves.
    httpMock.expectOne('/api/a').flush(null, { status: 401, statusText: 'Unauthorized' });
    httpMock.expectOne('/api/b').flush(null, { status: 401, statusText: 'Unauthorized' });

    // Exactly one rotation despite two failures.
    expect(auth.refresh).toHaveBeenCalledTimes(1);

    // Resolve the shared refresh; both originals retry.
    gate.next(authResult);
    gate.complete();

    httpMock.expectOne('/api/a').flush({});
    httpMock.expectOne('/api/b').flush({});
    expect(auth.refresh).toHaveBeenCalledTimes(1);
  });
});

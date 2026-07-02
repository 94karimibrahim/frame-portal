import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LocaleService } from '../i18n/locale.service';
import { TokenStore } from '../auth/token-store.service';
import { TenantService } from '../tenant/tenant.service';
import { authTenantInterceptor } from './auth-tenant.interceptor';

/**
 * Pins the template's cross-tenant-isolation guarantee (FRONTEND_PLAN Â§5): `X-Tenant` is sent **only** on
 * anonymous requests; an authenticated request carries `Authorization` and **never** `X-Tenant`, so a
 * normal user can never override the tenant baked into their token.
 */
describe('authTenantInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let token: string | null;

  function configure(accessToken: string | null): void {
    token = accessToken;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authTenantInterceptor])),
        provideHttpClientTesting(),
        { provide: TokenStore, useValue: { getAccessToken: () => token } },
        { provide: TenantService, useValue: { slug: () => 'acme' } },
        { provide: LocaleService, useValue: { acceptLanguage: () => 'ar' } },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(() => httpMock.verify());

  it('omits X-Tenant and attaches the bearer token for authenticated requests', () => {
    configure('access-token');
    http.get('/api/users').subscribe();

    const req = httpMock.expectOne('/api/users');
    expect(req.request.headers.get('Authorization')).toBe('Bearer access-token');
    expect(req.request.headers.has('X-Tenant')).toBe(false);
    expect(req.request.headers.get('Accept-Language')).toBe('ar');
    req.flush({});
  });

  it('sends X-Tenant (not Authorization) for anonymous requests', () => {
    configure(null);
    http.post('/api/auth/login', {}).subscribe();

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.headers.get('X-Tenant')).toBe('acme');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('leaves non-API requests (assets/fonts) untouched', () => {
    configure('access-token');
    http.get('/assets/logo.svg').subscribe();

    const req = httpMock.expectOne('/assets/logo.svg');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.headers.has('X-Tenant')).toBe(false);
    expect(req.request.headers.has('Accept-Language')).toBe(false);
    req.flush('');
  });
});

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { TokenStore } from '../auth/token-store.service';
import { TenantService } from '../tenant/tenant.service';
import { LocaleService } from '../i18n/locale.service';
import { TenantMiddlewareHeader } from '../tenant/tenant.constants';

/** True for requests targeting the Frame API (so we never attach auth headers to assets/fonts). */
function isApiRequest(url: string): boolean {
  return url.startsWith(environment.apiBaseUrl) || url.startsWith('/api');
}

/**
 * Attaches, for API requests only:
 * - `Accept-Language` (active culture) — always.
 * - `Authorization: Bearer` — when an access token is held.
 * - `X-Tenant` — **only for anonymous requests** (no access token), set to the pre-login tenant slug.
 *   Authenticated requests deliberately omit it so the backend derives the tenant from the JWT and a
 *   normal user can never override it (cross-tenant isolation, FRONTEND_PLAN §5).
 */
export const authTenantInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequest(req.url)) {
    return next(req);
  }

  const tokens = inject(TokenStore);
  const tenant = inject(TenantService);
  const locale = inject(LocaleService);

  const setHeaders: Record<string, string> = {
    'Accept-Language': locale.acceptLanguage(),
  };

  const accessToken = tokens.getAccessToken();
  if (accessToken) {
    setHeaders['Authorization'] = `Bearer ${accessToken}`;
  } else {
    setHeaders[TenantMiddlewareHeader] = tenant.slug();
  }

  return next(req.clone({ setHeaders }));
};

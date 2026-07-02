import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

/**
 * Sends credentials (the httpOnly refresh cookie) on auth endpoints only. The cookie is path-scoped
 * to `/api/auth` server-side, so this is belt-and-braces: token-issuing calls can receive the
 * Set-Cookie, `/auth/refresh` can present it, and `/auth/logout` can accept its deletion — while
 * ordinary API calls stay credential-free. Under the fetch backend this maps to
 * `credentials: 'include'`; the backend's CORS policy pairs it with explicit origins +
 * `AllowCredentials()`.
 */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) =>
  req.url.startsWith(`${environment.apiBaseUrl}/auth/`)
    ? next(req.clone({ withCredentials: true }))
    : next(req);

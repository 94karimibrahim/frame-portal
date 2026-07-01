import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { TokenStore } from '../auth/token-store.service';

/** Marks a request already retried after a refresh, so a second 401 can't loop. Client-only (not a header). */
const RETRIED = new HttpContextToken<boolean>(() => false);

/**
 * Auth endpoints whose 401 is a genuine credential error, not an expired access token. Prefix-matched
 * against the API base so an unrelated endpoint that merely *contains* `/auth/` (e.g. a future
 * `/users/{id}/auth-history`) still gets the transparent refresh-and-retry.
 */
function isAuthEndpoint(req: HttpRequest<unknown>): boolean {
  return req.url.startsWith(`${environment.apiBaseUrl}/auth/`);
}

/**
 * On a 401 from a normal API call, transparently rotate the token and retry the original request — the
 * downstream auth interceptor re-attaches the fresh token. The rotation is single-flighted inside
 * {@link AuthService.refresh} (shared with the bootstrap session restore), so concurrent 401s rotate the
 * token exactly once. If refresh itself fails (expired or reused refresh token → the backend revokes the
 * family), clear the session and bounce to login.
 */
export const refreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const tokens = inject(TokenStore);
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: unknown) => {
      const is401 = err instanceof HttpErrorResponse && err.status === 401;
      const canRefresh =
        is401 && !isAuthEndpoint(req) && tokens.hasRefreshToken() && !req.context.get(RETRIED);

      if (!canRefresh) {
        return throwError(() => err);
      }

      return auth.refresh().pipe(
        switchMap(() => next(req.clone({ context: req.context.set(RETRIED, true) }))),
        catchError(() => {
          auth.clearSession();
          void router.navigate(['/auth/login'], {
            queryParams: { reason: 'session-expired' },
          });
          return throwError(() => err);
        }),
      );
    }),
  );
};

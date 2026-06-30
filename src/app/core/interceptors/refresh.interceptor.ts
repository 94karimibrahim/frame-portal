import {
  HttpContextToken,
  HttpErrorResponse,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, shareReplay, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { TokenStore } from '../auth/token-store.service';
import { AuthResult } from '../models';

/** Marks a request already retried after a refresh, so a second 401 can't loop. Client-only (not a header). */
const RETRIED = new HttpContextToken<boolean>(() => false);

/**
 * Single-flight refresh: shared across all concurrent 401s, so the token is rotated exactly once even
 * when several requests fail together. Module-scoped because functional interceptors are singletons.
 */
let inFlightRefresh: Observable<AuthResult> | null = null;

/** Auth endpoints whose 401 is a genuine credential error, not an expired access token. */
function isAuthEndpoint(req: HttpRequest<unknown>): boolean {
  return req.url.includes('/auth/');
}

/**
 * On a 401 from a normal API call, transparently rotate the token (once, shared) and retry the original
 * request — the downstream auth interceptor re-attaches the fresh token. If refresh itself fails (expired
 * or reused refresh token → the backend revokes the family), clear the session and bounce to login.
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

      if (!inFlightRefresh) {
        inFlightRefresh = auth.refresh().pipe(
          finalize(() => (inFlightRefresh = null)),
          shareReplay(1),
        );
      }

      return inFlightRefresh.pipe(
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

import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

/**
 * `canMatch` auth guard: lets the route (and its lazy chunk) load only for an authenticated session.
 * Session restoration runs at bootstrap (APP_INITIALIZER), so by the time this runs the auth state is
 * settled. An unauthenticated user is redirected to login with a `returnUrl`.
 */
export const authGuard: CanMatchFn = (_route, segments) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  const returnUrl = '/' + segments.map((s) => s.path).join('/');
  return router.createUrlTree(['/auth/login'], { queryParams: { returnUrl } });
};

/** Inverse guard for public auth pages: an already-authenticated user is sent to the dashboard. */
export const guestGuard: CanMatchFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.createUrlTree(['/']) : true;
};

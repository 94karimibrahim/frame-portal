import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

/**
 * Builds a `canMatch` guard that requires the user to hold **any** of the given permission codes
 * (super-admin always passes). Authenticated-but-unauthorized users get the 403 page; unauthenticated
 * users are sent to login. The server still enforces the permission on every call — this only avoids
 * loading a feature the user can't use.
 *
 * @example { path: 'users', canMatch: [authGuard, hasAnyPermission([Permissions.users.list])], ... }
 */
export function hasAnyPermission(codes: readonly string[]): CanMatchFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/auth/login']);
    }
    return auth.hasAny(codes) ? true : router.createUrlTree(['/forbidden']);
  };
}

import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';

/**
 * Holds the **pre-login** tenant slug used for the `X-Tenant` header on anonymous requests (login,
 * register, public reads). This is the single guard that makes cross-tenant override impossible for a
 * normal user:
 *
 * - **Anonymous** request → the interceptor sends `X-Tenant = slug()` (the tenant being signed into).
 * - **Authenticated** request → the interceptor sends **no** `X-Tenant`; the backend derives the tenant
 *   from the JWT. A normal user therefore can never name a different tenant, and a super-admin changes
 *   tenant only via `POST /auth/switch-tenant` (which re-issues a token), not via this header.
 *
 * Persisted to `sessionStorage` so a reload on the login page keeps the chosen tenant.
 */
@Injectable({ providedIn: 'root' })
export class TenantService {
  private static readonly KEY = 'frame.tenant';

  private readonly _slug = signal<string>(this.read());
  readonly slug = this._slug.asReadonly();

  /** Sets the tenant slug to sign into (from a login-page tenant selector or a deep link). */
  setSlug(slug: string): void {
    const normalized = slug.trim().toLowerCase();
    this._slug.set(normalized);
    try {
      sessionStorage.setItem(TenantService.KEY, normalized);
    } catch {
      // Non-fatal; the in-memory signal still drives the header this session.
    }
  }

  private read(): string {
    try {
      return sessionStorage.getItem(TenantService.KEY) ?? environment.defaultTenantSlug;
    } catch {
      return environment.defaultTenantSlug;
    }
  }
}

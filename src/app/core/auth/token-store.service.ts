import { Injectable } from '@angular/core';

/**
 * The single place tokens are held. Two modes, decided per response by what the backend sends:
 *
 * - **Cookie mode** (backend `Auth:RefreshCookie:Enabled`, the SPA default): the response body's
 *   `refreshToken` is empty because the real one rides an httpOnly, Secure, SameSite=Strict cookie
 *   scoped to `/api/auth` — JS never sees it. Only the access token is held (in memory), plus a
 *   non-sensitive `localStorage` hint that a cookie session exists, so a later bootstrap knows a
 *   restore attempt is worth one `/auth/refresh` round-trip.
 * - **Legacy body mode** (non-cookie backends): access token in memory; refresh token in memory +
 *   a `sessionStorage` mirror so a reload within the tab can recover the session (per-tab, cleared
 *   when the tab closes). The mirror is removed on logout.
 *
 * The access token is never persisted in either mode, so it cannot be read from disk/storage.
 */
@Injectable({ providedIn: 'root' })
export class TokenStore {
  private static readonly REFRESH_KEY = 'frame.rt';
  private static readonly SESSION_HINT_KEY = 'frame.session';

  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  constructor() {
    // Recover a refresh token left by a prior page load in this tab (access tokens are never persisted).
    this.refreshToken = this.readSession();
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  /**
   * Stores a freshly issued token pair (after login / refresh rotation). An empty `refreshToken`
   * means the backend runs in cookie mode — nothing to hold; leave the session hint instead.
   */
  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    if (refreshToken) {
      this.refreshToken = refreshToken;
      this.writeSession(refreshToken);
      return;
    }
    this.refreshToken = null;
    this.tryStorage(() => sessionStorage.removeItem(TokenStore.REFRESH_KEY));
    // localStorage (not sessionStorage): the cookie outlives the tab, so any new tab may restore.
    this.tryStorage(() => localStorage.setItem(TokenStore.SESSION_HINT_KEY, '1'));
  }

  /** Replaces only the access token (e.g. after super-admin tenant switch). */
  setAccessToken(accessToken: string): void {
    this.accessToken = accessToken;
  }

  /** Wipes all token state from memory and both storage mirrors (logout / auth failure). */
  clear(): void {
    this.accessToken = null;
    this.refreshToken = null;
    this.tryStorage(() => sessionStorage.removeItem(TokenStore.REFRESH_KEY));
    this.tryStorage(() => localStorage.removeItem(TokenStore.SESSION_HINT_KEY));
  }

  /** True when a refresh token exists in JS (legacy body mode only). */
  hasRefreshToken(): boolean {
    return !!this.refreshToken;
  }

  /**
   * True when a session may be restorable after a reload: a body-mode refresh token survived, or a
   * cookie-mode session left its hint. A stale hint (revoked cookie) just costs one failed refresh
   * at bootstrap, which clears it.
   */
  hasSession(): boolean {
    if (this.hasRefreshToken()) {
      return true;
    }
    try {
      return localStorage.getItem(TokenStore.SESSION_HINT_KEY) === '1';
    } catch {
      return false;
    }
  }

  private readSession(): string | null {
    try {
      return sessionStorage.getItem(TokenStore.REFRESH_KEY);
    } catch {
      return null;
    }
  }

  private writeSession(refreshToken: string): void {
    this.tryStorage(() => sessionStorage.setItem(TokenStore.REFRESH_KEY, refreshToken));
  }

  /** Storage may be unavailable (private mode / disabled); in-memory state is authoritative anyway. */
  private tryStorage(op: () => void): void {
    try {
      op();
    } catch {
      // Non-fatal by design.
    }
  }
}

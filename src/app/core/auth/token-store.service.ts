import { Injectable } from '@angular/core';

/**
 * The single place tokens are held — the one file to change if/when the backend gains
 * `AllowCredentials` + an httpOnly refresh cookie (then the refresh token leaves the JS entirely).
 *
 * Approved strategy (see FRONTEND_PLAN §20):
 * - **Access token: in memory only.** Never persisted, so it cannot be read from disk/storage.
 * - **Refresh token: in memory + a `sessionStorage` mirror** so a full page reload can recover the
 *   session within the same tab. `sessionStorage` (not `localStorage`) is per-tab and cleared when the
 *   tab closes, narrowing exposure. The mirror is removed on logout.
 *
 * Rationale for not using a cookie today: the API returns both tokens in the response body and its CORS
 * policy does not set `AllowCredentials`, so a cross-origin httpOnly cookie is not currently accepted.
 */
@Injectable({ providedIn: 'root' })
export class TokenStore {
  private static readonly REFRESH_KEY = 'frame.rt';

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

  /** Stores a freshly issued token pair (after login / refresh rotation). */
  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    this.writeSession(refreshToken);
  }

  /** Replaces only the access token (e.g. after super-admin tenant switch). */
  setAccessToken(accessToken: string): void {
    this.accessToken = accessToken;
  }

  /** Wipes all token state from memory and the session mirror (logout / auth failure). */
  clear(): void {
    this.accessToken = null;
    this.refreshToken = null;
    try {
      sessionStorage.removeItem(TokenStore.REFRESH_KEY);
    } catch {
      // Storage may be unavailable (private mode / disabled); in-memory clear already happened.
    }
  }

  /** True when a refresh token exists, so the app can attempt to restore a session after reload. */
  hasRefreshToken(): boolean {
    return !!this.refreshToken;
  }

  private readSession(): string | null {
    try {
      return sessionStorage.getItem(TokenStore.REFRESH_KEY);
    } catch {
      return null;
    }
  }

  private writeSession(refreshToken: string): void {
    try {
      sessionStorage.setItem(TokenStore.REFRESH_KEY, refreshToken);
    } catch {
      // Non-fatal: the in-memory copy still works for this page lifetime.
    }
  }
}

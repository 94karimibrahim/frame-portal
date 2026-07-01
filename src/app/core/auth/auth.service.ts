import { HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  Observable,
  catchError,
  finalize,
  map,
  of,
  shareReplay,
  switchMap,
  tap,
  throwError,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiResponse,
  AuthResult,
  LoginRequest,
  LoginTwoFactorRequest,
  RegisterRequest,
  SocialLoginRequest,
  SwitchTenantResult,
} from '../models';
import { ApiClient } from '../http/api-client.service';
import { decodeJwt } from './jwt.util';
import { SUPER_ADMIN_ROLE } from './permissions';
import { TokenStore } from './token-store.service';
import { DeviceService } from './device.service';

/**
 * Whether to send the `X-Device-Id` header on login. Kept `false` because the backend CORS policy does
 * not yet allow that header (FRONTEND_PLAN Q1); enabling it without the CORS change breaks the login
 * preflight. Flip to `true` once `X-Device-Id` is added to `Cors:AllowedHeaders`.
 */
const SEND_DEVICE_ID = false;

/** The signed-in user's identity, assembled from `AuthResult` + JWT claims (there is no `/users/me`). */
export interface Identity {
  userId: string;
  email: string;
  fullName: string;
  tenantId: string | null;
  roles: string[];
  isSuperAdmin: boolean;
}

/**
 * Owns authentication state and flows. Identity and the effective permission set are signals the whole
 * app reads (menu/route/element gating). The server stays authoritative — these only drive what the UI
 * shows. Tokens live in {@link TokenStore}; this service never persists them itself.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClient);
  private readonly http = inject(HttpClient);
  private readonly tokens = inject(TokenStore);
  private readonly devices = inject(DeviceService);

  private readonly _identity = signal<Identity | null>(null);
  private readonly _permissions = signal<ReadonlySet<string>>(new Set());

  /**
   * Single-flight token rotation, shared across every caller (the refresh interceptor's concurrent 401s,
   * the bootstrap {@link restoreSession}, an HMR re-bootstrap). The backend rotates and revokes the old
   * refresh token on use, so two overlapping rotations of the same token would replay a spent one and trip
   * server-side reuse-detection — which revokes the whole token family and logs the user out. Sharing one
   * in-flight rotation here guarantees the token is rotated exactly once.
   */
  private inFlightRefresh: Observable<AuthResult> | null = null;

  readonly identity = this._identity.asReadonly();
  readonly isAuthenticated = computed(() => this._identity() !== null);
  readonly isSuperAdmin = computed(() => this._identity()?.isSuperAdmin ?? false);
  /** Effective permission codes for display gating; super-admin is treated as holding all. */
  readonly permissions = computed(() => this._permissions());

  /** True if the user holds the permission (super-admin bypasses, mirroring the backend). */
  hasPermission(code: string): boolean {
    return this.isSuperAdmin() || this._permissions().has(code);
  }

  hasAny(codes: readonly string[]): boolean {
    return (
      codes.length === 0 || this.isSuperAdmin() || codes.some((c) => this._permissions().has(c))
    );
  }

  hasAll(codes: readonly string[]): boolean {
    return this.isSuperAdmin() || codes.every((c) => this._permissions().has(c));
  }

  // ----- Establishment flows -----

  login(request: LoginRequest): Observable<AuthResult> {
    return this.postAuth('/auth/login', request).pipe(switchMap((r) => this.establish(r)));
  }

  loginTwoFactor(request: LoginTwoFactorRequest): Observable<AuthResult> {
    return this.postAuth('/auth/login/2fa', request).pipe(switchMap((r) => this.establish(r)));
  }

  socialLogin(request: SocialLoginRequest): Observable<AuthResult> {
    return this.api
      .post<AuthResult>('/auth/social-login', request)
      .pipe(switchMap((r) => this.establish(r)));
  }

  /**
   * Rotates the token pair using the stored refresh token. Used by the refresh interceptor + reload.
   * Single-flighted (see {@link inFlightRefresh}): concurrent callers share one rotation, so a stale
   * refresh token is never replayed.
   */
  refresh(): Observable<AuthResult> {
    if (this.inFlightRefresh) {
      return this.inFlightRefresh;
    }
    const refreshToken = this.tokens.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('No refresh token'));
    }
    this.inFlightRefresh = this.api.post<AuthResult>('/auth/refresh', { refreshToken }).pipe(
      tap((r) => {
        this.tokens.setTokens(r.accessToken, r.refreshToken);
        this._identity.set(this.buildIdentity(r));
      }),
      finalize(() => (this.inFlightRefresh = null)),
      shareReplay(1),
    );
    return this.inFlightRefresh;
  }

  /**
   * Restores a session after a full page reload: if a refresh token survived in the tab, rotate it for a
   * fresh access token and reload permissions. Returns `false` (never errors) when no session can be
   * restored, so the app simply shows the login page.
   */
  restoreSession(): Observable<boolean> {
    if (!this.tokens.hasRefreshToken()) {
      return of(false);
    }
    return this.refresh().pipe(
      switchMap(() => this.loadPermissions()),
      map(() => true),
      // Any failure (expired/reused refresh) => clean slate: clear the dead refresh token so later
      // reloads don't replay it, and resolve false so bootstrap simply shows the login page.
      catchError(() => {
        this.clearSession();
        return of(false);
      }),
    );
  }

  /** Super-admin only: re-issue an access token scoped to another tenant, then reload permissions. */
  switchTenant(targetTenantId: string): Observable<void> {
    return this.api.post<SwitchTenantResult>('/auth/switch-tenant', { targetTenantId }).pipe(
      tap((r) => {
        this.tokens.setAccessToken(r.accessToken);
        const claims = decodeJwt(r.accessToken);
        const current = this._identity();
        if (current && claims) {
          this._identity.set({
            ...current,
            tenantId: claims.tenantId,
            roles: claims.roles,
            isSuperAdmin: claims.roles.includes(SUPER_ADMIN_ROLE),
          });
        }
      }),
      switchMap(() => this.loadPermissions()),
      map(() => undefined),
    );
  }

  logout(): Observable<void> {
    // Best-effort server revoke; clear local state regardless of the outcome.
    return this.api.post<void>('/auth/logout').pipe(
      map(() => undefined),
      tap({ next: () => this.clearSession(), error: () => this.clearSession() }),
    );
  }

  /** Clears all in-memory auth state (called on logout, refresh failure, or session revocation 401). */
  clearSession(): void {
    this.tokens.clear();
    this._identity.set(null);
    this._permissions.set(new Set());
  }

  // ----- Anonymous account flows (no session established) -----

  register(request: RegisterRequest): Observable<string> {
    return this.api.post<string>('/auth/register', request);
  }

  forgotPassword(email: string): Observable<void> {
    return this.api.post<void>('/auth/forgot-password', { email }).pipe(map(() => undefined));
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.api
      .post<void>('/auth/reset-password', { token, newPassword })
      .pipe(map(() => undefined));
  }

  confirmEmail(token: string): Observable<void> {
    return this.api.post<void>('/auth/confirm-email', { token }).pipe(map(() => undefined));
  }

  sendEmailConfirmation(email: string): Observable<void> {
    return this.api
      .post<void>('/auth/send-email-confirmation', { email })
      .pipe(map(() => undefined));
  }

  requestAccountUnlock(email: string): Observable<void> {
    return this.api
      .post<void>('/auth/request-account-unlock', { email })
      .pipe(map(() => undefined));
  }

  unlockAccount(token: string): Observable<void> {
    return this.api.post<void>('/auth/unlock-account', { token }).pipe(map(() => undefined));
  }

  // ----- Internals -----

  private loadPermissions(): Observable<string[]> {
    return this.api
      .get<string[]>('/permissions/mine')
      .pipe(tap((codes) => this._permissions.set(new Set(codes))));
  }

  private establish(result: AuthResult): Observable<AuthResult> {
    this.tokens.setTokens(result.accessToken, result.refreshToken);
    this._identity.set(this.buildIdentity(result));
    return this.loadPermissions().pipe(map(() => result));
  }

  private buildIdentity(result: AuthResult): Identity {
    const claims = decodeJwt(result.accessToken);
    const roles = claims?.roles ?? [];
    return {
      userId: result.userId,
      email: result.email,
      fullName: result.fullName,
      tenantId: claims?.tenantId ?? null,
      roles,
      isSuperAdmin: roles.includes(SUPER_ADMIN_ROLE),
    };
  }

  /**
   * Login/2FA share the body POST but optionally carry the device-id header. Bypasses {@link ApiClient}
   * only to attach that header; still returns the unwrapped payload.
   */
  private postAuth(path: string, body: unknown): Observable<AuthResult> {
    let headers = new HttpHeaders();
    if (SEND_DEVICE_ID) {
      headers = headers.set('X-Device-Id', this.devices.getDeviceId());
    }
    return this.http
      .post<ApiResponse<AuthResult>>(`${environment.apiBaseUrl}${path}`, body, { headers })
      .pipe(map((res) => res.data));
  }
}

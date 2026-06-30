/**
 * Minimal, dependency-free JWT payload decoding. The SPA only *reads* claims for UX (identity, roles,
 * tenant, expiry) — it never trusts them for authorization decisions, which the server always re-checks.
 * Signature is intentionally not verified client-side (the server does that on every request).
 */

/** Claim names emitted by the backend `TokenService` (see `AppClaimTypes` / standard claim URIs). */
export interface JwtClaims {
  /** User id (`ClaimTypes.NameIdentifier`). */
  sub: string | null;
  email: string | null;
  tenantId: string | null;
  sessionId: string | null;
  roles: string[];
  /** Expiry (epoch seconds), when present. */
  exp: number | null;
}

const NAME_ID = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier';
const EMAIL = 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress';
const ROLE = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

function base64UrlDecode(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  // decodeURIComponent/escape handles UTF-8 payloads correctly.
  return decodeURIComponent(
    Array.prototype.map
      .call(
        atob(padded + pad),
        (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2),
      )
      .join(''),
  );
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string');
  }
  return typeof value === 'string' ? [value] : [];
}

/** Decodes a JWT's payload into the claims the SPA cares about, or `null` if it can't be parsed. */
export function decodeJwt(token: string): JwtClaims | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const raw = JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>;
    const sub = (raw[NAME_ID] ?? raw['nameid'] ?? raw['sub']) as string | undefined;
    const email = (raw[EMAIL] ?? raw['email']) as string | undefined;
    const roles = asArray(raw[ROLE] ?? raw['role'] ?? raw['roles']);
    return {
      sub: sub ?? null,
      email: email ?? null,
      tenantId: (raw['tenant_id'] as string | undefined) ?? null,
      sessionId: (raw['sid'] as string | undefined) ?? null,
      roles,
      exp: typeof raw['exp'] === 'number' ? (raw['exp'] as number) : null,
    };
  } catch {
    return null;
  }
}

/** True when the token is missing or past its `exp` (with a small skew), so the SPA can pre-empt a refresh. */
export function isJwtExpired(claims: JwtClaims | null, skewSeconds = 10): boolean {
  if (!claims?.exp) {
    return true;
  }
  return Date.now() / 1000 >= claims.exp - skewSeconds;
}

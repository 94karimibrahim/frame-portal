import type { Environment } from './environment.types';

/**
 * Development environment. The dev server runs on :5173 and proxies `/api` to the backend
 * (HTTP-only on :49154) via `proxy.conf.json`, so the SPA stays **same-origin** in dev too — no CORS
 * needed, and dev mirrors prod (which also serves `/api` same-origin behind a reverse proxy).
 * Seeded login: tenant `default`, `admin@frame.local` / `ChangeMe!123`.
 *
 * To exercise social login locally, paste a provider's public client id below and configure the
 * matching redirect URI + client secret on the backend (`SocialAuth:*`).
 */
export const environment: Environment = {
  production: false,
  // Same-origin: the dev server proxies this to http://localhost:49154 (see proxy.conf.json).
  apiBaseUrl: '/api',
  defaultTenantSlug: 'default',
  socialRedirectUri: 'http://localhost:5173/auth/social/callback',
  social: {
    google: {
      clientId: '',
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      scope: 'openid email profile',
    },
    microsoft: {
      clientId: '',
      authorizeUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      scope: 'openid email profile',
    },
    github: {
      clientId: '',
      authorizeUrl: 'https://github.com/login/oauth/authorize',
      scope: 'read:user user:email',
    },
  },
};

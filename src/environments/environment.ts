/**
 * Production environment (the default; `environment.development.ts` replaces it for `ng serve`).
 * The {@link Environment} shape lives in `environment.types.ts` so the dev file can import it safely
 * despite angular.json's file-replacement (see that file's note).
 */
import type { Environment } from './environment.types';

export const environment: Environment = {
  production: true,
  // Same-origin by default: the SPA is served behind a reverse proxy that routes /api to the backend.
  apiBaseUrl: '/api',
  defaultTenantSlug: 'default',
  socialRedirectUri: '/auth/social/callback',
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

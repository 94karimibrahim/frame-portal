/**
 * Shared shape for the environment objects. Kept in its own file (not `environment.ts`) because
 * angular.json's `fileReplacements` swaps `environment.ts` for `environment.development.ts` at build time;
 * if the type lived in `environment.ts`, the dev file would import it from a module that — post-swap — no
 * longer exports it. Importing the type from here keeps both environments type-safe under every config.
 *
 * No secrets ever live in an environment object — only public configuration. OAuth client IDs are public
 * by design; the corresponding client secrets stay on the backend, which performs the code exchange.
 */
export interface SocialProviderConfig {
  /** The public OAuth client id (empty disables the provider button). */
  readonly clientId: string;
  /** The provider's authorization endpoint. */
  readonly authorizeUrl: string;
  /** The OAuth scopes to request. */
  readonly scope: string;
}

export interface Environment {
  readonly production: boolean;
  /** Absolute or relative base URL of the Frame API, including the `/api` segment. */
  readonly apiBaseUrl: string;
  /** Tenant slug sent as `X-Tenant` for anonymous/pre-login requests. */
  readonly defaultTenantSlug: string;
  /** Where the OAuth provider redirects back to after authorization. */
  readonly socialRedirectUri: string;
  readonly social: Readonly<Record<'google' | 'microsoft' | 'github', SocialProviderConfig>>;
}

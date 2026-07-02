# Frame Portal — Web Client

A production Angular SPA for the Frame backend: multi-tenant identity & access management
(users, roles, permissions, departments, tenant administration, and a self-service security
center) with runtime English↔Arabic localization and full light/dark × LTR/RTL theming.

- **Stack:** Angular 22 (standalone components, signals, typed reactive forms, lazy routes via
  `canMatch`), Tailwind CSS (TailAdmin tokens), Angular CDK, TanStack Table, Transloco, Vitest.
- **No NgModules.** Every component is standalone; state is signals + feature services.

See [`FRONTEND_PLAN.md`](./FRONTEND_PLAN.md) for the full backend inventory, architecture decisions,
and the verified API contract this client is built against.

## Using this as a template

This repo is a **complete reference app** (a multi-tenant IAM admin). The `core/`, `shared/`, `layout/`,
and `features/auth` code is reusable infrastructure (the skeleton); the Manage/Administration features
are demo domain you replace with your own. To strip the demo down to a skeleton and scaffold new
features, see **[`docs/USING-AS-A-TEMPLATE.md`](./docs/USING-AS-A-TEMPLATE.md)**. Quick start:

```bash
npm run new:feature -- reports   # generates an idiomatic feature + prints the wiring to paste
```

## Prerequisites

- Node 22.22+ and npm (Angular 22's floor; `.nvmrc` pins the major).
- The Frame API running locally. By default the dev build points at `http://localhost:49154/api`
  (see `src/environments/environment.development.ts`); `:4200` and `:5173` are allowed CORS origins.
- Seeded login (local): tenant `default`, `admin@frame.local` / `ChangeMe!123`.

## Common commands

```bash
npm install            # install dependencies
npm start              # ng serve  → http://localhost:4200  (dev environment, watch)
npm run build          # production build → dist/frame-portal (AOT, hashed, budget-checked)
npm run lint           # ESLint (angular-eslint, strict) + Prettier rules
npm test               # Vitest unit tests (watch)
npm run test:ci        # Vitest unit tests, single run
npm run test:coverage  # single run + coverage; the thresholds in angular.json are the regression gate
```

Unit tests run on **Vitest** (Angular's `unit-test` builder) in jsdom — no browser or `CHROME_BIN`
setup needed. Coverage floors live in the `test` target of `angular.json` (`coverageThresholds`);
the builder fails the run when a floor is missed. Ratchet them upward as coverage grows.

## Project structure

```
src/app/
  core/         # singletons: auth, http (ApiClient), interceptors, guards, models, tenant, i18n, theme, notifications
  shared/       # the UI kit (modal, confirm-dialog, data-table, badge, pagination, spinner, empty-state, toast),
                # the *appHasPermission directive, and ServerFormBase
  features/     # lazy, one folder per area: auth, dashboard, departments, users, roles, permissions,
                # account (profile/preferences), security, admin (tenants/ip-filters/password-policy)
  layout/       # app shell: sidebar, topbar, theme/language toggles
```

Every feature route is **lazy** (`loadComponent`/`loadChildren`) and guarded by `canMatch`
(`authGuard` + `hasAnyPermission(...)`), so a user never downloads a chunk they can't open.

## Architecture conventions

- **HTTP:** feature services call the typed `ApiClient`, which prefixes `environment.apiBaseUrl` and
  unwraps the `{ data, success, … }` response envelope. Three functional interceptors handle, in order:
  auth + tenant headers, single-flight token refresh on `401`, and error → `AppError` mapping.
- **Forms:** reactive forms extend `ServerFormBase`, which maps the server's `ValidationProblemDetails`
  codes back onto the matching controls and resolves stable error codes through Transloco.
- **Grids:** all server-paged tables use the shared `app-data-table` (TanStack Table, headless,
  Tailwind-styled) with the `app-pagination` control; custom cells render via `flexRenderComponent`.
- **Permission gating:** the UI mirrors the backend permission set from `GET /api/permissions/mine`.
  Routes use `hasAnyPermission`, elements use `*appHasPermission`, and `SuperAdmin` bypasses both —
  **the server remains the source of truth; the UI only hides what it would reject anyway.**

## Design system, theming & RTL

- Tailwind with TailAdmin design tokens; dark mode via the `dark` class on `<html>` (`ThemeService`,
  light/dark/system).
- Localization is runtime (Transloco, `en` + `ar`) with no reload. `LocaleService` owns the active
  culture and sets `dir`/`lang` on `<html>`; Arabic is RTL.
- **Use Tailwind logical properties only** (`ps-/pe-`, `ms-/me-`, `start-/end-`, `rtl:`/`ltr:` variants)
  so a single `dir` flip drives all four quadrants (light-LTR, light-RTL, dark-LTR, dark-RTL). An
  automated RTL check lives in `core/i18n/locale.service.spec.ts`.
- Shared UI components are keyboard-navigable and ARIA-correct; the modal traps focus (CDK a11y).

## Security model

- **Tokens:** the access token lives **in memory**; the refresh token sits behind a single `TokenStore`
  abstraction (in-memory + a `sessionStorage` mirror for reload survival — never `localStorage`). Swapping
  to an httpOnly cookie later is a one-file change once the backend enables `AllowCredentials` + `Set-Cookie`.
- **Refresh:** a single-flight interceptor rotates the token pair on `401`; refresh failure / session
  revocation triggers auto-logout and a redirect to login.
- **Tenant isolation:** a normal user's `X-Tenant` header may never differ from their token tenant
  (enforced in the interceptor); cross-tenant switching is SuperAdmin-only via `auth/switch-tenant`.
- **Reveal-once secrets** (API keys, 2FA backup codes) are shown exactly once and must be copied before dismiss.
- **XSS:** rely on Angular's sanitization; no `bypassSecurityTrust*` and no untrusted `innerHTML`.
- No secrets in the client — only public config in `src/environments/*`.

### Roadmap: httpOnly-cookie refresh (Phase 2)

The one residual token-theft surface today is the refresh token in `sessionStorage` — readable by any
successful XSS payload (the strict CSP above is the compensating control). Closing it is a deliberately
small, isolated change, all behind `TokenStore` (`core/auth/token-store.service.ts`):

1. Backend: on login/refresh, set the refresh token as an `HttpOnly; Secure; SameSite` cookie (instead of
   in the JSON body) and enable `AllowCredentials` on CORS / read it from the cookie on `/auth/refresh`.
2. Client: send credentialed requests (`withCredentials: true`) and **stop** persisting the refresh token —
   `TokenStore` keeps only the in-memory access token; `restoreSession()` calls `/auth/refresh` (the
   browser attaches the cookie) on reload. No component or interceptor outside `TokenStore` changes.

The access token already lives in memory only, so after this the JS holds nothing an XSS could exfiltrate
for long-lived reuse.

## Deployment & security headers

Serve the built static app (`dist/frame-portal/browser`) behind a reverse proxy that also routes `/api`
to the backend (so the SPA stays same-origin and needs no CORS in prod). A ready-to-adapt config —
SPA fallback, `/api` proxy, asset caching, and the headers below — is in
[`deploy/nginx.conf.sample`](./deploy/nginx.conf.sample).

CSP is enforced via **HTTP response headers** (not a `<meta>` tag, which can't express `frame-ancestors`).
The directive below is tuned to exactly what this app needs and is verified against the production build:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Notes on the CSP:

- `script-src 'self'` — the AOT build ships no inline scripts and no `eval`.
- `font-src 'self'` — the Outfit font is **self-hosted** (`@fontsource/outfit`, imported in
  `styles.css` and bundled/hashed by the build), so no third-party origin is contacted at all.
- `style-src … 'unsafe-inline'` — required only because Angular inlines critical CSS as a `<style>` tag.
  To drop it, set `optimization.styles.inlineCritical: false` in `angular.json` (trades a small
  first-paint win for the stricter policy).
- `img-src 'self' data:` — the 2FA authenticator QR is rendered as a `data:` image URI.
- `connect-src 'self'` — assumes a same-origin `/api`. If the API is on another origin, add that origin.

> The backend remains responsible for HTTPS termination, CORS (restrictive allow-list), CSRF posture
> (bearer tokens, not cookies, today), and rate limiting — this client is built to match those.

## Build configuration note

`angular.json` replaces `environment.ts` with `environment.development.ts` for the dev build. The shared
`Environment` type therefore lives in `src/environments/environment.types.ts` (a file that is **not**
replaced) so both environments stay type-safe under every configuration.

# Frame Portal — Web Client

A production Angular SPA for the Frame backend: multi-tenant identity & access management
(users, roles, permissions, departments, tenant administration, and a self-service security
center) with runtime English↔Arabic localization and full light/dark × LTR/RTL theming.

- **Stack:** Angular 20 (standalone components, signals, typed reactive forms, lazy routes via
  `canMatch`), Tailwind CSS (TailAdmin tokens), Angular CDK, TanStack Table, Transloco, Jasmine/Karma.
- **No NgModules.** Every component is standalone; state is signals + feature services.

See [`FRONTEND_PLAN.md`](./FRONTEND_PLAN.md) for the full backend inventory, architecture decisions,
and the verified API contract this client is built against.

## Prerequisites

- Node 20+ and npm.
- The Frame API running locally. By default the dev build points at `http://localhost:49154/api`
  (see `src/environments/environment.development.ts`); `:4200` and `:5173` are allowed CORS origins.
- Seeded login (local): tenant `default`, `admin@frame.local` / `ChangeMe!123`.

## Common commands

```bash
npm install            # install dependencies
npm start              # ng serve  → http://localhost:4200  (dev environment, watch)
npm run build          # production build → dist/frame-portal (AOT, hashed, budget-checked)
npm run lint           # ESLint (angular-eslint, strict) + Prettier rules
npm test               # Karma unit tests (interactive)
```

### Running tests headless (no Chrome on this box)

Karma drives Microsoft Edge (Chromium) via `karma-chrome-launcher`. Point `CHROME_BIN` at Edge and use
the no-sandbox headless launcher:

```powershell
$env:CHROME_BIN = (Get-Command msedge).Source
npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox
```

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

## Build configuration note

`angular.json` replaces `environment.ts` with `environment.development.ts` for the dev build. The shared
`Environment` type therefore lives in `src/environments/environment.types.ts` (a file that is **not**
replaced) so both environments stay type-safe under every configuration.

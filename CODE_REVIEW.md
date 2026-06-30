# Frame Portal — Deep Code Review (Starter-Template Readiness)

**Reviewed:** `client/` Angular SPA · **Date:** 2026-06-30 · **Angular:** 20.1 (standalone, signals)
**Method:** full static analysis + `ng lint`, production `ng build`, and `npm audit` executed against the tree.

---

## Executive Summary

This is an **exceptionally well-engineered codebase** — comfortably in the top few percent of Angular projects I have reviewed. It uses the modern Angular 20 idiom end-to-end (standalone components, signals, functional guards/interceptors, `inject()`, typed reactive forms, lazy `canMatch` routes), and the author has clearly internalized both Angular and web-security fundamentals. Lint passes with **zero** warnings, there are **zero** `TODO`/`FIXME`/`eslint-disable` markers in the entire `src` tree, every component uses `OnPush`, and the production build succeeds.

The security model in particular is more thoughtful than most production apps: access token in memory only, refresh token behind a single swappable abstraction, tenant isolation enforced in the HTTP interceptor, single-flight token refresh, no `innerHTML`/`bypassSecurityTrust*`, and a documented strict CSP that the build is engineered to satisfy.

The gaps are almost entirely **breadth-of-coverage** issues rather than correctness defects: thin automated test coverage, no client CI/pre-commit hooks, dev-tooling npm advisories, a slightly-over-budget initial bundle, and a few orphaned scaffold files. None are architectural. With the Critical/High items below addressed, this is an excellent starter template.

### Overall Health Scorecard

| Dimension | Grade | Notes |
|---|---|---|
| 1. Structure & Organization | **A** | Clean core/shared/features/layout; one orphaned-scaffold cleanup |
| 2. Security | **A** | Best-in-class for a token-in-JS SPA; only residual is the sessionStorage refresh token |
| 3. Code Quality & Best Practices | **A** | 100% OnPush, signals, strict TS, lint clean, no `any` |
| 4. Performance | **A−** | Lazy everything; initial bundle 10 kB over the warning budget |
| 5. Testing | **C** | Strong where present, but ~13 specs for ~95 units; no e2e; no coverage gate |
| 6. Config & Tooling | **B+** | Excellent configs; missing CI, git hooks, dev proxy; dev-dep advisories |
| 7. Documentation | **A** | Outstanding README + inline "why" comments + FRONTEND_PLAN |
| 8. Scalability | **A−** | Clear boundaries; signal-based state scales; i18n already in place |

**Verdict: Ready to become a template after a short, well-defined punch-list (below). Not blocked by any architectural rework.**

---

## 1. Project Structure & Organization — A

**Strong.** The layout matches the modern Angular guidance (the v20 standalone evolution of the classic style guide):

```
src/app/
  core/      # singletons: auth, http, interceptors, guards, models, tenant, i18n, theme, notifications, command-palette
  shared/    # UI kit (modal, data-table, badge, pagination…), directives, forms base, util
  features/  # one lazy folder per area: auth, dashboard, users, roles, permissions, departments, account, security, admin
  layout/    # app shell: sidebar, topbar, breadcrumb, route-progress
```

- **No NgModules** — every component is `standalone`, which is the correct choice for v20 and removes a whole class of circular-dependency problems. There are no `NgModule`s to form cycles.
- Feature encapsulation is clean: each feature owns its `*.routes.ts`, services, dialogs, and cell components (e.g. `features/users/cells/*`). Cross-feature imports go only "downward" into `shared`/`core`.
- Naming is consistent and idiomatic: `*.component.ts`, `*.service.ts`, `*.guard.ts`, kebab-case selectors with the `app` prefix (enforced by ESLint), `PascalCase` classes, `camelCase` members.
- Models are centralized in `core/models/*` with a barrel `index.ts`.

### Findings

| ID | Sev | Finding |
|---|---|---|
| **S-1** | Low | **Orphaned scaffold files.** `src/app/app.html` (342 lines) and `src/app/app.css` (empty) are dead — the root `App` component (`app.ts`) uses an **inline** template (`<router-outlet/><app-toast-container/>`) and no `styleUrl`. `app.html` still contains the default Angular welcome page, including external links to Twitter/YouTube/GitHub. Delete both files. |
| **S-2** | Info | `.prettierignore` lists `src/assets/i18n`, but translations actually live in `public/i18n` and there is no `src/assets`. Harmless but stale — update to `public/i18n` (or remove the line). |

---

## 2. Security Assessment — A

This is the standout dimension. Evidence reviewed: `token-store.service.ts`, `auth.service.ts`, the three interceptors, both guards, `jwt.util.ts`, `index.html`, the environment files.

**What's done right:**
- **XSS:** No `innerHTML`, no `bypassSecurityTrust*`, no `DomSanitizer`, no `eval`/`document.write` anywhere in `src`. The app relies on Angular's contextual auto-escaping. Confirmed by grep across the tree.
- **External links:** All `target="_blank"` links carry `rel="noopener"` — but they only exist in the **dead** `app.html` (see S-1), so they vanish on cleanup. (Note: they use `noopener` but not `noreferrer`; moot once deleted.)
- **Token handling (`token-store.service.ts`):** Access token is **in-memory only** (never persisted). Refresh token is in-memory + a `sessionStorage` mirror (per-tab, cleared on tab close) — explicitly *not* `localStorage`. All storage access is `try/catch`-guarded for private-mode. The file is intentionally the single swap-point for moving to an httpOnly cookie.
- **Tenant isolation (`auth-tenant.interceptor.ts`):** The `X-Tenant` header is attached **only for anonymous requests**; authenticated requests omit it so the backend derives the tenant from the JWT and a normal user can never override it. This matches the documented cross-tenant-bypass concern and is exactly right.
- **Token refresh (`refresh.interceptor.ts`):** Single-flight (`shareReplay(1)` + module-scoped in-flight observable) so concurrent 401s rotate the token exactly once; a `RETRIED` `HttpContextToken` prevents infinite loops; refresh failure clears the session and redirects to login with `reason=session-expired`. Auth endpoints are excluded so a genuine credential 401 isn't mistaken for an expired access token.
- **Client never trusts the JWT** (`jwt.util.ts`): claims are decoded for UX only; signature is deliberately not verified client-side; the server re-checks on every request. Guards and the `*appHasPermission` directive are explicitly "display gating only."
- **No secrets in the client:** environment objects hold only public config; OAuth **client IDs** are public by design and the comment in `environment.types.ts` documents that secrets stay on the backend. Confirmed empty `clientId`s in committed envs.
- **CSP:** `index.html` documents a header-enforced strict CSP and the app is built to satisfy it (no inline scripts; UI is Tailwind utility classes, no component-inline styles needing `unsafe-inline`).
- **Source maps:** the production config does not enable `sourceMap`, so prod ships without maps (only the dev config sets `sourceMap: true`). Good.

### Findings

| ID | Sev | Finding |
|---|---|---|
| **SEC-1** | Medium (residual/accepted) | **Refresh token in `sessionStorage` is readable by any XSS payload.** This is the one residual token-theft surface and is consciously accepted in the code comments pending a backend change. For a *template*, make the httpOnly-cookie path a first-class, documented "Phase 2" task (it's already a one-file change in `TokenStore`). Until then, the strict CSP is the primary compensating control — so committing the CSP header config (see SEC-2) matters. |
| **SEC-2** | Low | **CSP lives only in prose.** `index.html` references "the exact directive string and an nginx example" in the README, but the README's Security section doesn't actually include the directive string, and there's no committed `nginx`/headers sample. Commit the real CSP header (and a `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors` set) so a template consumer inherits it. |
| **SEC-3** | Info | HTTPS/CSRF/CORS are correctly the backend's responsibility and the client is built to match (same-origin `/api` in prod via reverse proxy; bearer tokens, not cookies, so no CSRF surface today). Worth a one-paragraph "backend must enforce" note in the README for template users. |

---

## 3. Code Quality & Angular Best Practices — A

- **`ng lint` → "All files pass linting."** ESLint flat config extends `eslint:recommended` + `typescript-eslint` recommended **and stylistic** + `angular-eslint` recommended + **template a11y**. Prettier is wired (`format`/`format:check` scripts).
- **Change detection:** `ChangeDetectionStrategy.OnPush` on **every** component (73/73). Zone change detection runs with `eventCoalescing: true`.
- **Typing:** `strict: true` plus `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, and Angular `strictTemplates`/`strictInjectionParameters`/`typeCheckHostBindings`. **No `any`** found anywhere — unknowns are typed `unknown` and narrowed (e.g. the error interceptor).
- **Subscriptions / leaks:** Long-lived streams (router events, search boxes) use `takeUntilDestroyed()`. The remaining `.subscribe()` calls are one-shot HTTP requests that complete on their own — no leak. Search boxes use `debounceTime(300) + distinctUntilChanged()`.
- **DI:** Singletons are `providedIn: 'root'`; `core.providers.ts` is a single clean composition root with a well-reasoned interceptor order (error → refresh → auth, documented).
- **Abstractions:** `ApiClient` (envelope unwrap + base URL), `ServerFormBase` (maps `ValidationProblemDetails` codes onto controls, code-first i18n), and the toast `NotificationService` (with hover-pause/resume bookkeeping) are all clean, well-documented, and reusable.

### Findings

| ID | Sev | Finding |
|---|---|---|
| **Q-1** | Low (optional) | A couple of feature pages are large (`users-page.component.ts` ~950 lines, `roles-page.component.ts` ~500). They're well-organized, but for a *template* consider demonstrating extraction of a page's data/orchestration into a small per-page facade/store service, so consumers copy that pattern for their own large pages. |
| **Q-2** | Info | The `*appHasPermission` directive re-implements structural rendering by hand with an `effect`. Correct and reactive, but Angular 20's `@if`/signal-driven templates can often replace it; keep the directive (it's ergonomic), just note it as a deliberate choice. |

---

## 4. Performance & Optimization — A−

- **Lazy loading:** Every feature route is lazy (`loadComponent`/`loadChildren`) behind `canMatch`, so a user never downloads a chunk for a feature they can't open. The build confirms granular per-feature chunks (`users-routes`, `security-page-component`, `auth-routes`, etc.).
- **Preloading:** `withPreloading(PreloadAllModules)` warms lazy chunks after first paint — a reasonable choice at this size, and the comment already flags revisiting with a network-aware strategy as it grows.
- **Scrolling:** `withInMemoryScrolling` restores scroll on navigation.
- **No heavy main-thread work / no abusive `setInterval`.** The only timers are toast auto-dismiss (`setTimeout`) and they're cleaned up.
- **Bundle:** initial **460.29 kB raw / 127 kB transfer (gzip)**; largest lazy chunk `users-routes` 112 kB raw / 25 kB transfer. Healthy for an app of this scope.

### Findings

| ID | Sev | Finding |
|---|---|---|
| **P-1** | Low | **Initial bundle exceeds the configured warning budget by 10.29 kB** (460.29 kB vs 450 kB `maximumWarning`; error threshold 750 kB not hit, build is green). Either (a) trim ~10 kB from the initial graph, or (b) consciously raise `maximumWarning` to ~500 kB. Don't let a perpetually-yellow build become normalized. Quick wins: confirm `qrcode` (an `allowedCommonJsDependency`) is only imported in the lazy 2FA chunk, and that TanStack Table isn't pulled into the initial graph. |
| **P-2** | Info | Assets: only `favicon.ico` + i18n JSON are shipped; no raster images to optimize. If template consumers add images, add `loading="lazy"` guidance to the README. |

---

## 5. Testing Strategy — C  *(largest gap)*

- **Present and good-quality:** 13 spec files — `guards.spec`, `locale.service.spec`, `login.component.spec`, `data-table.component.spec`, `pagination.component.spec`, `has-permission.directive.spec`, `department.service.spec`, plus pure-logic specs (`delegation-grouping`, `permission-grouping`, `ip-filter.util`, `user-status.util`, `initials.util`). The pure-logic and util tests are exactly what you'd want.
- **Gap:** ~13 specs against **71 components + 24 services**. The security-critical units — `auth.service`, `token-store.service`, and especially the **three interceptors** (refresh single-flight, tenant-header isolation, error mapping) — have **no direct tests**, despite being the highest-risk, highest-reuse code in a template.
- **No e2e** (Cypress/Playwright) at all.
- **No coverage gate:** `karma.conf.js` includes `karma-coverage` but no `check`/threshold is enforced, and there's no client CI to run `test:ci`.

### Findings

| ID | Sev | Finding |
|---|---|---|
| **T-1** | High | Add unit tests for the **interceptors** and **`auth.service`/`token-store`** — they encode the template's security guarantees (refresh-once, tenant isolation, session clearing on refresh failure, error normalization). These are the tests future projects will rely on as a safety net when they modify auth. |
| **T-2** | Medium | Adopt a **coverage threshold** in `karma.conf.js` (e.g. statements/branches ≥ 80% for `core/`), and wire `npm run test:ci` into CI (see C-1). |
| **T-3** | Medium | Add a minimal **Playwright** smoke suite (login → dashboard → one CRUD flow → logout). For a template, one working e2e example is worth more than dozens of shallow unit tests. |

---

## 6. Configuration & Tooling — B+

- **`angular.json`:** Uses the modern `@angular/build:application` builder. Production has `outputHashing: all`, budgets, AOT/optimization (default), and `extractLicenses` (default on in prod). `fileReplacements` swaps the environment for dev. `allowedCommonJsDependencies: ['qrcode']` is correctly declared. Dev serve on `:5173`.
- **`package.json`:** Angular 20.1 across the board — current. Clean script set including `format`/`format:check`. `private: true`. No obviously unused or misplaced deps; everything in `dependencies` is runtime-used (`@tanstack/angular-table`, `qrcode`, `transloco`, `cdk`), build/test tooling correctly in `devDependencies`.
- **`.gitignore`:** Proper — ignores `dist`, `node_modules`, `.angular/cache`, `coverage`, IDE files. Environment files are committed **on purpose** (they hold only public config), which is correct here.
- **`.editorconfig`, `.prettierignore`, `.postcssrc.json`, `.vscode/extensions.json`** all present and sensible.

### Findings

| ID | Sev | Finding |
|---|---|---|
| **C-1** | High | **No CI for the client** (no `.github` under `client/`). Add a workflow running `npm ci → lint → format:check → test:ci → build` on PRs. This is the single biggest lever to keep a *template* healthy over time. |
| **C-2** | Medium | **`npm audit`: 6 advisories (3 high, 3 low)** — all in **dev tooling** (`esbuild`, `vite`, `piscina`, `launch-editor`), none shipped in the production bundle. The high ones (esbuild dev-server arbitrary file read on Windows, vite `fs.deny` bypass, piscina prototype-pollution) only affect the local dev server. Run `npm audit fix` and re-test; track upstream. Document in the README that these are dev-only so template consumers don't panic. |
| **C-3** | Medium | **No pre-commit hooks.** Prettier + ESLint are configured but nothing enforces them locally. Add **husky + lint-staged** to run `eslint --fix` + `prettier --write` on staged files, so the "lint clean" state can't regress. |
| **C-4** | Low | **No dev proxy.** Dev points at an absolute `http://localhost:49154/api` and relies on backend CORS. A committed `proxy.conf.json` (so the SPA calls same-origin `/api` in dev too) is the more conventional, CORS-free setup and makes dev mirror prod. Optional but template-friendly. |

---

## 7. Documentation & Onboarding — A

- **`README.md`** is genuinely excellent: stack, prerequisites, seeded login, headless-test instructions, project structure, architecture conventions (HTTP/forms/grids/permission-gating), design-system/RTL rules, a full **Security model** section, and the environment file-replacement note.
- **`FRONTEND_PLAN.md`** (33 KB) captures the backend inventory, architecture decisions, and the verified API contract — strong design provenance.
- **Inline comments are "why," not "what"** — interceptor ordering, tenant-isolation rationale, token strategy, the `SEND_DEVICE_ID`/CORS coupling, the environment-type-file reasoning. This is exactly the level a template needs.

### Findings

| ID | Sev | Finding |
|---|---|---|
| **D-1** | Low | Add the actual **CSP directive string + sample reverse-proxy (nginx) config** the README/`index.html` reference (ties to SEC-2). |
| **D-2** | Low | Add a short **"Using this as a template"** section: how to strip the demo IAM features down to the skeleton (shell + auth + UI kit + one example feature), and the conventions to follow when adding a feature. |

---

## 8. Scalability & Future-Readiness — A−

- **State management:** Signals + feature services (no NgRx). This is the right default at this scale; boundaries are clean and the choice is documented. If global cross-feature state grows, the signal-store pattern extends naturally — no rewrite needed.
- **Feature boundaries** are crisp; adding a feature is "add a folder + a lazy route + a permission" with no edits to existing features.
- **i18n** is already runtime (Transloco en/ar) with RTL — most teams bolt this on painfully later; here it's foundational.
- **Hardcoded values** are appropriately extracted: `Permissions` constants, `tenant.constants.ts`, per-page `PAGE_SIZE`, environment config. No scattered magic strings of concern.

### Findings

| ID | Sev | Finding |
|---|---|---|
| **F-1** | Medium | **It's a reference *app*, not yet a *skeleton*.** Every feature is concrete Frame-IAM domain. To be a true starter, provide a documented "remove-the-demo" path (or a `feature-template/` example folder) so a new project starts from the shell + UI kit + auth, not from someone else's domain. Pairs with D-2. |

---

## Priority-Sorted Issue List

### 🔴 Critical
*None.* No security holes, no broken builds, no architectural defects.

### 🟠 High
1. **T-1 — Test the interceptors + auth/token services.** These are the template's security contract and are currently untested.
2. **C-1 — Add client CI** (`lint → format:check → test:ci → build` on PRs).

### 🟡 Medium
3. **C-2 — `npm audit fix`** (dev-only highs; resolve + document).
4. **C-3 — husky + lint-staged** pre-commit enforcement.
5. **T-2 — Coverage threshold** on `core/` + run in CI.
6. **T-3 — One Playwright e2e smoke flow.**
7. **SEC-1 — Make the httpOnly-cookie refresh path a documented Phase-2** with the residual sessionStorage risk called out.
8. **F-1 — Provide a "skeleton/strip-the-demo" path** to make it a real template.

### 🟢 Low
9. **S-1 — Delete orphaned `app.html` + `app.css`.**
10. **P-1 — Resolve the 10 kB bundle-budget overage** (trim or bump consciously).
11. **SEC-2 / D-1 — Commit the real CSP + security headers + nginx sample.**
12. **C-4 — Add `proxy.conf.json` for dev.**
13. **S-2 — Fix the stale `.prettierignore` path.**
14. **D-2 — "Using this as a template" README section.**

---

## Checklist — Turn This Into the Ideal Starter Template

```
[ ] Delete src/app/app.html and src/app/app.css (dead scaffold)            (S-1)
[ ] Fix .prettierignore: src/assets/i18n -> public/i18n                     (S-2)
[ ] Unit-test the 3 interceptors (refresh single-flight, tenant header,    (T-1)
    error mapping) + auth.service + token-store
[ ] Add coverage threshold to karma.conf.js (core/ >= 80%)                  (T-2)
[ ] Add one Playwright e2e: login -> dashboard -> CRUD -> logout            (T-3)
[ ] Add client CI: npm ci, lint, format:check, test:ci, build              (C-1)
[ ] npm audit fix; document dev-only advisories in README                  (C-2)
[ ] Add husky + lint-staged (eslint --fix + prettier on staged)            (C-3)
[ ] Add proxy.conf.json; point dev env at same-origin /api                 (C-4)
[ ] Resolve initial-bundle budget overage (trim ~10 kB or raise to ~500kB) (P-1)
[ ] Commit CSP directive string + security headers + nginx sample          (SEC-2/D-1)
[ ] Document httpOnly-cookie refresh as Phase 2 + residual XSS note         (SEC-1)
[ ] Add README "Using this as a template" + strip-the-demo guide           (D-2/F-1)
```

---

## Specific Fixes (snippets)

### S-1 — Remove dead scaffold
```bash
git rm src/app/app.html src/app/app.css
# Verified: app.ts uses an inline template and no styleUrl; nothing references these files.
```

### C-3 — husky + lint-staged
```jsonc
// package.json
{
  "scripts": { "prepare": "husky" },
  "lint-staged": {
    "src/**/*.{ts,html}": ["eslint --fix", "prettier --write"],
    "src/**/*.css": ["prettier --write"]
  }
}
```
```bash
npm i -D husky lint-staged && npx husky init
echo "npx lint-staged" > .husky/pre-commit
```

### C-1 — Minimal client CI (`.github/workflows/client-ci.yml`)
```yaml
name: client-ci
on:
  pull_request: { paths: ['client/**'] }
jobs:
  build:
    runs-on: ubuntu-latest
    defaults: { run: { working-directory: client } }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm, cache-dependency-path: client/package-lock.json }
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check
      - run: npm run test:ci
      - run: npm run build
```

### T-1 — Interceptor test sketch (tenant isolation)
```ts
it('omits X-Tenant for authenticated requests', () => {
  tokenStore.setTokens('access', 'refresh');
  http.get('/api/users').subscribe();
  const req = httpMock.expectOne('/api/users');
  expect(req.request.headers.has('X-Tenant')).toBeFalse();
  expect(req.request.headers.get('Authorization')).toBe('Bearer access');
});

it('sends X-Tenant only for anonymous requests', () => {
  http.get('/api/auth/login').subscribe();
  const req = httpMock.expectOne('/api/auth/login');
  expect(req.request.headers.get('X-Tenant')).toBe('default');
});
```

### C-4 — `proxy.conf.json` (dev)
```jsonc
{ "/api": { "target": "http://localhost:49154", "secure": false, "changeOrigin": true } }
```
```jsonc
// angular.json serve.development.options
"proxyConfig": "proxy.conf.json"
// then set environment.development.apiBaseUrl back to "/api" so dev mirrors prod
```

---

## Revised Folder Structure

**No restructuring needed** — the current structure is correct. The only change is **deletion**:

```
src/app/
  app.ts                 # keep (inline-template root)
  app.config.ts          # keep
  app.routes.ts          # keep
  app.spec.ts            # keep
  app.html   ← DELETE    # dead Angular scaffold
  app.css    ← DELETE    # empty/dead
  core/ shared/ features/ layout/   # all correct as-is
```

---

## Final Verdict

**This project is ready to serve as a starter template once the High items are cleared.** Architecturally it is already a model Angular 20 application — arguably stronger than most teams' production apps — and there is **nothing to refactor**. The work that remains is about making the template *durable and copyable*: a test safety-net around the security-critical core, CI + pre-commit gates so the pristine lint/format state can't rot, a dev-tooling `audit fix`, and documentation that helps the next team start from the skeleton rather than the demo.

**Non-negotiables before blessing it as the official template:**
1. Tests for the interceptors + auth/token services (T-1).
2. Client CI running lint/format/test/build (C-1).
3. `npm audit fix` for the dev-tooling highs (C-2).
4. Delete the orphaned scaffold (S-1).

Everything else on the list is high-value polish that can follow.

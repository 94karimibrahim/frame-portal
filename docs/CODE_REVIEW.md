# Frame Portal — Deep Code Review (Starter-Template Readiness)

**Reviewed:** entire repo · **Date:** 2026-07-02 (supersedes the 2026-06-30 review) · **Angular:** 20.3 (standalone, signals)
**Method:** full static analysis plus live tooling runs — `ng lint`, `prettier --check`, production `ng build`,
`ng test --code-coverage` (Edge headless), `npx playwright test`, `npm audit`, `npm outdated`.

---

## Executive Summary

The 2026-06-30 review's entire punch list has verifiably landed (CI, husky + lint-staged, dev proxy, committed
CSP + nginx sample, Playwright smoke, coverage gate, template-stripping docs, interceptor/auth/token tests,
scaffold cleanup). This pass re-verified the tree, reviewed the users drawer→pages refactor and the
`AuthService` single-flight refresh move, and found a short list of new defects — **all of which were fixed
during the review** (see "Fixed in this pass"). What remains is process work (commit the tree, pick a version
policy) and optional polish.

This is one of the strongest Angular codebases we maintain: modern Angular 20 idiom end-to-end, a security
model better than most production apps, and green tooling across the board.

### Overall Health Scorecard

| Dimension | Grade | Notes |
|---|---|---|
| 1. Structure & Organization | **A** | core/shared/features/layout; standalone + lazy `canMatch` routes |
| 2. Security | **A** | Token-in-memory model, tenant isolation, strict committed CSP; nginx header pitfall fixed |
| 3. Code Quality & Best Practices | **A** | 100% OnPush, zero `any`, lint/format clean, signals throughout |
| 4. Performance | **A** | 460 kB raw / 128 kB transfer initial, under budget; everything lazy |
| 5. Testing | **B+** | 76 unit tests incl. security core + both new user pages; 5 e2e incl. a mocked-API CRUD flow; coverage gate in CI |
| 6. Config & Tooling | **A−** | CI, hooks, proxy, Dependabot; version currency needs a policy (M-3) |
| 7. Documentation | **A** | README + FRONTEND_PLAN + USING-AS-A-TEMPLATE + why-comments |
| 8. Scalability | **A−** | Crisp boundaries; users-page facade extraction still optional (L-3) |

**Verdict: ready to bless as the official starter template once the working tree is committed (H-2) and a
version-currency decision is made (M-3).**

---

## Verified tooling results (2026-07-02)

| Check | Result |
|---|---|
| `ng lint` (now includes `e2e/`) | ✅ All files pass |
| `prettier --check` (now includes `e2e/`, `tools/`) | ✅ All files formatted |
| `ng build` (production) | ✅ 460.31 kB raw / 127.6 kB transfer initial vs 550 kB budget |
| `ng test` (Edge headless) | ✅ **76/76**, coverage 63.2% stmts / 58.1% branches / 52.6% funcs / 64.0% lines |
| Coverage gate (`tools/check-coverage.mjs`) | ✅ Floors re-seated to 60/60/50/55 — see note below |
| `npx playwright test` | ✅ **5/5** (auth smoke + mocked-API users CRUD flow) |
| `npm audit --omit=dev` | ✅ 0 production vulnerabilities (4 low, dev-tooling only) |
| `npm outdated` | ⚠️ Angular 21.2 / Tailwind 4 / TS 6 majors available — see M-3 |

> **Coverage-gate note:** the new users-page specs pulled the whole users feature into the instrumented set,
> growing the denominator from 618 to 922 statements. Absolute covered statements went **up** (431 → 583);
> the percentage went down. Floors were re-seated just under the new measured values, per the gate's ratchet
> design. Raise them as feature coverage grows.

---

## Fixed in this pass (2026-07-01 → 02)

| ID | Sev | Fix |
|---|---|---|
| **H-1** | High | `deploy/nginx.conf.sample`: the static-assets `location` added its own `add_header` (Cache-Control), which — per nginx inheritance rules — silently **dropped every server-level security header** (CSP/HSTS/nosniff) on asset responses. HSTS + nosniff are now repeated in that location, with a comment explaining the pitfall. |
| **M-1** | Medium | `AuthService.restoreSession()` claimed "never errors" but had no `catchError` (the old `switchMap((ok) => of(ok))` was a no-op), and a failed restore left the **dead refresh token in `sessionStorage`**, replaying a revoked token on every reload. Now catches, calls `clearSession()`, resolves `false`; the compensating `.catch` in `core.providers.ts` was removed; covered by a new spec. |
| **M-2** | Medium | `users-page`: `distinctUntilChanged()` ran **after** `merge()` of the three per-column filters, so typing the same text in a different filter box was deduped and never triggered a reload. The operator now runs per-control before the merge. (`roles`/`tenants` pages use a single control — unaffected.) |
| **M-4** | Medium | Added `user-details-page.component.spec.ts` + `user-form-page.component.spec.ts` (14 tests: load/deep-link failure, system/self guarding, unlock, create/edit payloads, disabled email, server-error binding, unsaved-changes) and `e2e/users.crud.spec.ts` — a fully `page.route()`-mocked login → list → details → edit → save flow that documents the template's pattern for backend-free e2e of authenticated surfaces. |
| **L-1** | Low | Removed the dead `ApiClient.baseUrl` static (its comment claimed interceptors used it; none did). |
| **L-2** | Low | `refresh.interceptor` `isAuthEndpoint` tightened from `url.includes('/auth/')` to a prefix match on `${apiBaseUrl}/auth/`, so future endpoints merely containing `/auth/` still get refresh-and-retry. |
| **L-4** | Low | `ng lint` now covers `e2e/**/*.ts`; Prettier + lint-staged now cover `e2e/` and `tools/*.mjs`. |
| **L-5** | Low | Outfit is now **self-hosted** (`@fontsource/outfit`, imported in `styles.css`, bundled + content-hashed). The Google Fonts `<link>`s are gone from `index.html`, and the CSP in the README + nginx sample dropped the `fonts.googleapis.com` / `fonts.gstatic.com` origins — the app now contacts no third-party origin at all. `style-src 'unsafe-inline'` remains only for Angular's critical-CSS inlining (documented toggle). |
| **Misc** | Low | Post-review polish: `user-form-page` now pairs `unsavedChangesGuard` with the `beforeunload` prompt (the pattern the other two guarded pages already had; +1 spec); Node baseline pinned (`engines: node >=20` + `.nvmrc`); `npm audit fix` resolved the esbuild dev-server advisory (remaining 3 lows are the `@babel/core` chain inside `@angular/build` — upstream-only, resolved by the Angular 21 update). |

---

## Open items

### 🟠 High

**H-2 — Commit the working tree.** The users drawer→pages refactor, the `AuthService` single-flight move, the
`isLockedOut` model addition, and this review's fixes all live uncommitted. Before committing, **confirm the
backend ships `isLockedOut` on the user list DTO** (and `lockoutEnd` on the detail DTO) — if it doesn't yet,
make `isLockedOut` optional with a safe default, otherwise every row renders `undefined` and the Unlock
action never appears. Suggested split: one commit for the auth single-flight + interceptor/restore fixes, one
for the users pages refactor + i18n, one for the review fixes/tests/tooling.

### 🟡 Medium

**M-3 — Version-currency policy.** Angular latest stable is **21.2** (this app: 20.3); Tailwind 4 and TS 6 are
out; `@angular/animations` is deprecated/frozen upstream (one consumer: `shared/animations.ts` +
`provideAnimations()`). A template that lags a major means every new app starts a major behind. Decide: run
`ng update @angular/core@21 @angular/cli@21` on a branch now, or pin 20.x with a scheduled quarterly
`ng update` (Dependabot, as configured, will **not** propose majors). Treat Tailwind 4 as its own task; plan
the animations migration to native CSS.

### 🟢 Low / Optional

- **L-3 —** ~~`users-page.component.ts` (~980 lines) works fine but is the flagship example; extracting a small
  page facade/store (filters + paging + optimistic mutations) would give template consumers the pattern for
  their own large pages.~~ **Done 2026-07-02:** `users-page.store.ts` (component-provided, signals) now owns
  the query state, paged data, and optimistic mutations, with 13 unit specs of its own (incl. an M-2
  regression test); the component keeps dialogs/selection/navigation/CSV. Coverage floors ratcheted to
  63/64/54/56. A vestigial `deleting` signal (never set) was removed along the way.
- **L-6 —** *Accepted residual:* refresh token in `sessionStorage` until the backend enables the
  httpOnly-cookie flow (README "Roadmap: Phase 2"). Revisit when backend CORS `AllowCredentials` lands —
  and remember cookie auth reintroduces CSRF requirements.

---

## Checklist

```
[x] Fix nginx add_header inheritance (security headers on asset responses)      (H-1)
[x] restoreSession: catchError → clearSession + false; drop bootstrap .catch    (M-1)
[x] Per-control distinctUntilChanged before merge() in users-page filters       (M-2)
[x] Specs for user-details-page + user-form-page; mocked-API Playwright CRUD    (M-4)
[x] Remove dead ApiClient.baseUrl                                               (L-1)
[x] Prefix-match isAuthEndpoint against apiBaseUrl                              (L-2)
[x] Lint/format scope: e2e/ + tools/                                            (L-4)
[x] Self-host Outfit (@fontsource); drop Google origins from the CSP            (L-5)
[ ] Confirm backend isLockedOut/lockoutEnd contract, then commit the tree       (H-2)
[x] Decide + execute the Angular 21 / version-currency policy                   (M-3) — see addendum
[x] Optional: users-page facade                                                 (L-3) — users-page.store.ts
[ ] Phase 2 (backend-gated): httpOnly-cookie refresh + CSRF posture             (L-6)
```

---

## Addendum — 2026-07-02: M-3 executed (Angular 21 upgrade)

`ng update @angular/core@21 @angular/cli@21 @angular/cdk@21` ran on branch `upgrade/angular-21`:
Angular 21.2.17 / CLI+build 21.2.18 / CDK 21.2.14 / TS 5.9.3. Every migration schematic reported
"no changes made" (the codebase was already v21-idiomatic); neither optional migration applied
(no `getCurrentNavigation` usage; already on `@angular/build:application`). One new v21 extended
diagnostic (NG8021, redundant `prefetch on idle` in the dashboard `@defer`) was fixed.

Re-verified on 21: lint ✅ · build ✅ 471.28 kB raw / 129.95 kB transfer (budget 550 kB) ·
unit **77/77** ✅ with coverage gate passing (63.4/58.8/52.8/64.2 vs 60/55/50/60 floors) ·
Playwright **5/5** ✅ · `npm audit --omit=dev` 0 vulnerabilities. Note: the 3 low dev-only
`@babel/core` advisories were **not** cleared by v21 as hoped — still upstream-only, accepted.

Still open from M-3's orbit: nothing — the quarterly `ng update` policy is written down
(USING-AS-A-TEMPLATE.md §6) and Tailwind 4 landed (below).

**2026-07-02, Tailwind 4:** upgraded 3.4.19 → 4.3.2 with `npx @tailwindcss/upgrade` on
`upgrade/tailwind-4`. `tailwind.config.js` is gone — the TailAdmin tokens are now the `@theme` block in
`src/styles.css`; the dark class variant is a `@custom-variant`; component classes converted to
`@utility`; 18 inline templates rewritten for v4 renames; `@tailwindcss/postcss` replaces
`tailwindcss`+`autoprefixer` in `.postcssrc.json`. The tool added a v3-compat default-border-color
layer (gray-200); a follow-up audit found every border/divide in the app already declares an explicit
color (the two colorless-looking spots get theirs via `[class]` bindings), so the layer was removed —
verified by build/tests/e2e plus before/after screenshots. Verified: lint + Prettier ✅,
build ✅ (387.60 kB raw / 103.77 kB transfer), 77/77 unit + gate ✅, 5/5 Playwright ✅, plus a manual
rendered screenshot check of the login page in light **and** dark (an initial "dark inputs render
light" scare was a probe artifact — the screenshot raced `.form-input`'s 150 ms background
transition).

**2026-07-02, later still:** the app is **zoneless** — `provideZonelessChangeDetection()` replaces
`provideZoneChangeDetection` (the codebase was already 100% OnPush + signals). `zone.js` is out of the
build polyfills and out of `dependencies`; it remains a devDependency (bumped to 0.16.2, absorbing the
open Dependabot bump) only as a **test** polyfill because the auth/interceptor specs use
`fakeAsync`/`tick` — prod-parity for zoneless is covered by the Playwright suite, which runs against the
real bundle. Initial bundle dropped 412.62 → 375.01 kB raw (114.25 → 102.30 kB transfer; the polyfills
chunk is gone). Re-verified: lint ✅, build ✅ (no warnings), 77/77 unit + coverage gate ✅,
5/5 Playwright ✅.

**2026-07-02, later:** the `@angular/animations` → native CSS migration is done. Route transitions
now use the Router's `withViewTransitions()` (scoped to the shell content via `view-transition-name`);
the toast and list-item enter/leave animations use the native `animate.enter`/`animate.leave` bindings
with CSS keyframes in `styles.css`; reduced-motion is handled once by the global
`prefers-reduced-motion` block (the `[@.disabled]`/`prefersReducedMotion()` plumbing is gone);
`shared/animations.ts` is deleted and `@angular/animations` uninstalled. Initial bundle dropped
471.28 → 412.62 kB raw (129.95 → 114.25 kB transfer). Re-verified: lint ✅, build ✅ (no warnings),
77/77 unit + coverage gate ✅, 5/5 Playwright ✅.

## Addendum — 2026-07-02: Angular 22 (the policy's first exercise)

`ng update @angular/core@22 @angular/cli@22 @angular/cdk@22 angular-eslint@22` ran on
`upgrade/angular-22` — the first upgrade done under the §6 policy, one day after writing it. Now on
Angular 22.0.5 / CDK 22.0.3 / angular-eslint 22.0.0 / **TypeScript 6.0.3** (required by v22, so it
rides the framework train). Notes for the next upgrader:

- **Node floor is real:** CLI 22 requires Node ≥ 22.22.3. This machine moved 22.18 → 22.23.1 (winget),
  and the template's baseline rose with it: `engines` ≥ 22.22, `.nvmrc` 22, README, and both CI jobs
  (Node 20 → 22 — CI would have hard-failed otherwise). The raised baseline also unblocked
  **lint-staged 17** (declined as #8 when the floor was 20).
- **Migrations reviewed, not just accepted:** `withXhr()` pins the pre-v22 XHR transport (moving to the
  new fetch default is a future deliberate change); the `$safeNavigationMigration()` marker (template
  `?.` now yields `undefined`, not `null`) was resolved to an explicit `?? ''` in the dashboard; the
  migration's suppression of the now-default `nullishCoalescingNotNullable`/`optionalChainNotNullable`
  diagnostics was **removed** — the build is warning-free without it.
- **v22 `CanMatchFn` gained a third `currentSnapshot` parameter** — app code was unaffected but
  `guards.spec.ts` invokes the typed guards directly; seven callsites now pass a stub.
- Two `ng update` attempts failed on npm-cache integrity corruption; a fresh `npm_config_cache` dir
  fixed it.
- Optional v22 migrations deliberately **not** taken yet: Karma → Vitest unit-test builder (own task —
  worth it, Karma is sunsetting) and the `use-application-builder` no-op.

Verified on 22: lint + Prettier ✅ · build ✅ warning-free, 403.16 kB raw / **100.51 kB transfer**
(budget 550 kB) · **90/90** unit + coverage gate (65.3/58.3/56.8/66.1 vs 63/56/54/64 floors) ✅ ·
**5/5** Playwright ✅ · `npm audit --omit=dev` 0 vulnerabilities (3 dev-only lows persist upstream).

## Addendum — 2026-07-02: Karma → Vitest (and zone.js exits entirely)

The v22 optional migration, taken as its own task on `migrate/vitest`. The `test` target now runs
`@angular/build:unit-test` with `runner: vitest` in jsdom — no browser, no `CHROME_BIN` setup, and the
suite runs in ~6 s instead of a browser launch. Notes:

- **Official schematics did most of it:** `migrate-karma-to-vitest` (config) +
  `refactor-jasmine-vitest` (specs: `createSpyObj` → `vi.fn()` literals, `toBeTrue()` → `toBe(true)`,
  `.and.*` → `.mock*`, `jasmine.objectContaining` → `expect.objectContaining`). Two things needed
  hands: the spec refactorer **rewrote the Playwright smoke spec too** (its `.spec.ts` glob doesn't
  know e2e from unit; `toHaveClass` is valid Playwright — reverted), and its partial-mock literals
  don't satisfy `MockedObject<T>` (nine `as unknown as MockedObject<T>` casts added).
- **The store spec's `fakeAsync` tests became Vitest fake timers** (`--fake-async` pass), which meant
  nothing needed zone.js anymore: the zone test polyfills were removed, all 90 specs pass **zoneless —
  the same change-detection mode as production** — and `zone.js` was uninstalled. The dependency is
  now gone from the repository completely.
- **The custom coverage gate retired:** the builder's native `coverageThresholds` (in `angular.json`)
  fail the run when a floor is missed, so `tools/check-coverage.mjs` and the CI tee/gate plumbing were
  deleted. Floors carried over (63/56/54/64); v8 measures 66.4/58.4/56.9/66.5.
- Removed: `karma.conf.js` and nine Karma/Jasmine devDependencies. Added: `vitest`,
  `@vitest/coverage-v8`, `jsdom`.

Verified: lint + Prettier ✅ · prod build unchanged (403.16 kB / 100.51 kB, warning-free) ✅ ·
**90/90** Vitest with native coverage thresholds ✅ · **5/5** Playwright ✅.

## Addendum — 2026-07-02: eslint 10

The deferred lint-stack major, taken once its compatibility matrix aligned: typescript-eslint 8.62.1
and angular-eslint 22.0.0 both peer-accept eslint ^10, so this was a one-package bump. `ng lint`
passes with **zero rule changes**. One latent bug surfaced: `eslint.config.js` requires `@eslint/js`,
which had only ever been available as eslint 9's hoisted transitive dependency — eslint 10 no longer
provides it, so it is now a **direct devDependency** (`@eslint/js` 10.0.1, versioned independently of
eslint itself since 10.0). The Dependabot semver-major ignore for eslint stays — the next major is
manual again, together with whatever the typescript-eslint/angular-eslint matrix requires then.

## Final Verdict

**Ready, pending H-2.** Architecturally there is nothing to refactor; the security-critical core is tested;
CI enforces lint, formatting, tests, a coverage ratchet, and the production build; the e2e suite now covers
both the anonymous and the authenticated (mocked) surface. Commit the tree, decide the upgrade policy, and
bless it.

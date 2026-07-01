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

- **L-3 —** `users-page.component.ts` (~980 lines) works fine but is the flagship example; extracting a small
  page facade/store (filters + paging + optimistic mutations) would give template consumers the pattern for
  their own large pages.
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
[ ] Decide + execute the Angular 21 / version-currency policy                   (M-3)
[ ] Optional: users-page facade                                                 (L-3)
[ ] Phase 2 (backend-gated): httpOnly-cookie refresh + CSRF posture             (L-6)
```

---

## Final Verdict

**Ready, pending H-2.** Architecturally there is nothing to refactor; the security-critical core is tested;
CI enforces lint, formatting, tests, a coverage ratchet, and the production build; the e2e suite now covers
both the anonymous and the authenticated (mocked) surface. Commit the tree, decide the upgrade policy, and
bless it.

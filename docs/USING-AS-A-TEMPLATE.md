# Using Frame Portal as a starter template

This repo ships as a **complete reference app** (a multi-tenant IAM admin: users, roles, permissions,
departments, tenant administration, and a self-service security center). Most of it is **reusable
infrastructure**; a well-defined subset is **demo domain** you'll replace with your own features.

This guide tells you exactly what to keep, how to strip the demo down to a skeleton, and how to add a
new feature following the repo's conventions.

---

## 1. The two layers: keep vs. replace

| Area | Path | Verdict |
|---|---|---|
| HTTP, auth, guards, interceptors, models (transport), tenant, i18n, theme, notifications, command-palette | `src/app/core/**` | **Keep** — the engine |
| UI kit (modal, data-table, pagination, badge, …), directives, forms base, util, icons | `src/app/shared/**` | **Keep** |
| App shell, sidebar, topbar, breadcrumb, route progress, nav model | `src/app/layout/**` | **Keep** (trim `nav.model.ts`) |
| Full auth flow (login, register, forgot/reset, 2FA, confirm-email, unlock) | `src/app/features/auth/**` | **Keep** |
| 403 / 404 pages | `src/app/features/errors/**` | **Keep** |
| Dashboard landing page | `src/app/features/dashboard/**` | **Keep** (trim its quick-links) |
| Self-service account: profile, preferences | `src/app/features/account/{profile,preferences}*` | **Keep if** your backend has these endpoints |
| Self-service security center: 2FA, sessions, devices, API keys, social accounts | `src/app/features/security/**` | **Keep if** your backend has these endpoints |
| **Users, Roles, Permissions, Departments** | `src/app/features/{users,roles,permissions,departments}/**` | **Demo — replace** |
| **Tenant admin, IP filters, password policy** | `src/app/features/admin/**` | **Demo — replace** |
| **Delegations** | `src/app/features/account/delegation*`, `delegations-page*` | **Demo — replace** |

> Rule of thumb: everything in `core/`, `shared/`, `layout/`, and `features/auth` + `features/errors` is
> the skeleton. The Manage and Administration menu groups are the demo domain.

---

## 2. The six wiring points

Every feature is connected to the app at the same six places. To **remove** a feature, undo each; to
**add** one, fill each in.

1. **Route** — a lazy entry in `src/app/app.routes.ts` (`loadComponent`/`loadChildren` behind
   `canMatch: [hasAnyPermission([...])]`).
2. **Nav** — an item in `src/app/layout/nav.model.ts`. (The ⌘K command palette reads `NAV`, so it
   updates automatically — no separate edit.)
3. **Permissions** — the `Permissions.<module>` block in `src/app/core/auth/permissions.ts`.
4. **i18n** — the feature's key namespace plus its `nav.*` label in `public/i18n/en.json` **and**
   `public/i18n/ar.json`.
5. **Dashboard quick-link** — only for Manage/Admin features: a gated card in
   `src/app/features/dashboard/dashboard.component.ts`.
6. **Models** — the feature's DTOs in `src/app/core/models/*.ts` (`identity.models`, `admin.models`,
   `security.models`, `enums`). Leave the transport types in `api.models.ts` and the auth types
   (`AuthResult`, …) alone — the skeleton needs them.

---

## 3. Strip the demo down to a skeleton

Goal: shell + auth + UI kit + dashboard + (optionally) account/security, and nothing domain-specific.

### 3a. Delete the demo feature folders

```bash
git rm -r \
  src/app/features/users \
  src/app/features/roles \
  src/app/features/permissions \
  src/app/features/departments \
  src/app/features/admin
# Delegations (keep the rest of account/):
git rm src/app/features/account/delegation-form-dialog.component.ts \
       src/app/features/account/delegation-grouping.ts \
       src/app/features/account/delegation-grouping.spec.ts \
       src/app/features/account/delegation.service.ts \
       src/app/features/account/delegations-page.component.ts
```

(If your backend lacks the self-service security center, also `git rm -r src/app/features/security` and
its account siblings.)

### 3b. Remove their route entries

In `src/app/app.routes.ts`, delete the route objects for `users`, `roles`, `permissions`,
`departments`, the three `admin/*` routes, and `account/delegations`. Keep `dashboard`, the `account/*`
routes you're keeping, `forbidden`, and the `**` catch-all.

### 3c. Trim the nav

In `src/app/layout/nav.model.ts`, remove the `nav.manage` and `nav.administration` groups entirely (and
the `delegations` item from the `nav.account` group). The command palette follows automatically.

### 3d. Trim permissions & dashboard

- `src/app/core/auth/permissions.ts` — delete the `users`, `roles`, `permissions`, `tenants`, `apiKeys`,
  `sessions`, `departments`, `ipFilters`, `passwordPolicies` blocks you no longer reference. Keep
  `SUPER_ADMIN_ROLE`.
- `src/app/features/dashboard/dashboard.component.ts` — remove the `*appHasPermission` quick-link cards
  that point at deleted routes.

### 3e. Trim models & i18n

- `src/app/core/models/` — remove the per-feature DTOs (e.g. tenant/department/ip-filter types in
  `admin.models.ts`). Keep `api.models.ts` and the auth/identity types the skeleton imports.
- `public/i18n/en.json` **and** `ar.json` — delete the now-unused namespaces (`users`, `roles`,
  `permissions`, `admin`, `departments`, `delegations`, …) and the matching `nav.*` labels.

### 3f. Verify

```bash
npm run lint && npm run format:check && npm test && npm run build
```

The TypeScript compiler + `ng build` will flag any dangling import you missed — fix until green.

---

## 4. Add a new feature

Use the scaffolder, then complete the wiring it prints:

```bash
npm run new:feature -- reports
```

This creates `src/app/features/reports/` with an idiomatic service, an `OnPush` page component, and a
lazy `routes.ts`, then prints the exact route / nav / permission / i18n snippets to paste. Do those six
wiring edits (§2) and you're done. The generated code already follows the house style:

- **Service** calls the typed `ApiClient` (base URL + envelope unwrap handled for you).
- **Page** is a `standalone`, `ChangeDetectionStrategy.OnPush` component using signals and the shared UI
  kit (`app-page-header`, `app-card`, `app-spinner`, `app-empty-state`), with all text via Transloco.
- **Route** is lazy and meant to sit behind `canMatch: [hasAnyPermission([...])]`.

### Conventions to keep

- One folder per feature under `features/`; co-locate its service, page, dialogs, and custom cells.
- When a page grows past "form + list", extract its server state into a **component-provided page
  store** — see `features/users/users-page.store.ts` (query/filter/paging signals + optimistic
  mutations, unit-tested in isolation) next to the component that keeps only the UI concerns.
- Never call `HttpClient` directly from a component — go through a feature service → `ApiClient`.
- Gate routes with `hasAnyPermission([...])` and elements with `*appHasPermission`; **the server stays
  authoritative** — the UI only hides what it would reject anyway.
- No magic strings: permission codes live in `permissions.ts`, labels/messages in the i18n files.
- Reactive forms extend `ServerFormBase` so server `ValidationProblemDetails` codes map back onto fields.

---

## 5. Don't forget

- **Branding:** `index.html` `<title>`, `public/favicon.ico`, the Tailwind brand palette in the
  `@theme` block of `src/styles.css`, and the app name in `package.json` / `README.md`.
- **Environments:** point `apiBaseUrl` at your API and set your real OAuth client IDs in
  `src/environments/*` (secrets stay on the backend — see `environment.types.ts`).
- **Security headers:** ship the CSP from the README "Deployment & security headers" section /
  `deploy/nginx.conf.sample`.

---

## 6. Version-currency policy

A template that lags a major hands every new app tech debt on day one — so this repo tracks the
**latest stable Angular major** deliberately, not opportunistically.

- **Dependabot** (weekly, configured in `.github/dependabot.yml`) keeps minors/patches current, but it
  **never proposes majors**. Majors are a manual, scheduled job.
- **Quarterly** (or as soon as a new Angular major ships): run the update on a branch and let the
  migration schematics do the work —

  ```bash
  git switch -c upgrade/angular-<N>
  npx ng update @angular/core@<N> @angular/cli@<N> @angular/cdk@<N>
  npm run lint && npm run test:coverage && npm run e2e && npm run build
  ```

  Never hand-edit Angular versions in `package.json`: `ng update` runs the migration schematics;
  a hand bump silently skips them.
- **After every major**, skim the release notes for new extended diagnostics and deprecations — fix
  warnings the same day they appear (this repo builds warning-free; keep it that way).
- **Out-of-band bumps** (any week): security advisories from `npm audit` on production dependencies.
  Dev-only advisories with no upstream fix are recorded in `docs/CODE_REVIEW.md` instead of forced.
- **Not on the Angular train:** Tailwind, TypeScript, and tooling majors are their own tasks — do them
  separately from an Angular major so a regression has one suspect.

History: reviewed on 20.3 (2026-06-30), moved to 21.2 + zoneless + native-CSS animations (2026-07-02) —
see `docs/CODE_REVIEW.md` for the audit trail.

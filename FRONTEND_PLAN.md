# Frame Portal — Frontend Plan (Phase 1 + Phase 2)

> **Status:** Phase 1 (backend inventory) and Phase 2 (architecture & stack) — **awaiting approval before any app code is written.**
> Every fact below was verified against the **API-layer contracts** in `src/APIs/API` and the
> Application/Domain types they map to (commit `93380d7`), not the internal Application messages. Where the
> wire shape differs from internals it is called out.
>
> This is a **clean rebuild** at `frame/client`. A previous attempt lived in the sibling repo
> `D:\CodeByClaude\frame.portal` but was only the raw TailAdmin demo with orphaned, un-wired feature
> components; it is **not** being reused.

---

## 0. How to read this

- **Base URL:** all endpoints are under `/api`. Controllers route by convention `api/[controller]`
  (e.g. `AuthController` → `/api/auth`).
- **API version:** default **`1.0`**, assumed when unspecified. Routes are **unversioned** (no `/v1/` segment
  required). A version may optionally be supplied via the `api-version` query param or `X-Api-Version` header;
  the response always reports `api-supported-versions`. **The SPA will not send a version** and rely on the
  default — but unsupported-version handling yields `400`, not `401`.
- **Success envelope:** every 2xx body is wrapped:
  ```jsonc
  { "data": <payload>, "success": true, "message": null, "correlationId": "..." }
  ```
  The SPA's HTTP layer unwraps `.data` centrally.
- **Created (201):** same envelope; payload is usually the new `Guid` id; a `Location` header points to the
  resource (exposed via CORS).
- **No-content (204):** mutations that don't return a body (logout, deletes, updates).
- **Enums are integers on the wire** (e.g. `Gender: 0`, `SocialProvider: 0`). The SPA mirrors each enum.
- **Auth:** `Authorization: Bearer <accessToken>`. Global `AuthorizeFilter` makes **every** endpoint
  authenticated unless marked `[AllowAnonymous]`.

---

# PHASE 1 — BACKEND INVENTORY

## 1. Global request/response conventions

| Concern | Detail |
|---|---|
| Auth header | `Authorization: Bearer <JWT>` (HS256, 15-min access token) |
| Alt auth | `X-Api-Key: <raw key>` (machine clients; not used by the SPA) |
| Tenant header | `X-Tenant: <slug>` (see §5) |
| Idempotency | `Idempotency-Key: <client-uuid>` honoured on create endpoints (register, create user/role/dept/tenant/ipfilter/apikey) |
| Device id | `X-Device-Id: <stable id>` on login (trusted-device 2FA bypass) — **⚠ not in default CORS allowed headers; see §9.5** |
| Correlation | `X-Correlation-ID` echoed back (exposed) for support/debugging |
| Culture | `Accept-Language: ar` or `en` (anonymous); signed-in users use stored preference (see §8) |
| Success body | `ApiResponse<T>` envelope: `{ data, success, message, correlationId }` |
| Error body | RFC 7807 `ProblemDetails` / `ValidationProblemDetails` (see §7) |
| Rate-limit reject | `429` + `Retry-After` header (see §9.1) |
| Pagination query | `?pageNumber=1&pageSize=20&search=` (pageSize clamped server-side to ≤200) |
| Paged body | `PagedResult<T>`: `{ items[], pageNumber, pageSize, totalCount, totalPages, hasPreviousPage, hasNextPage }` |

## 2. Endpoint catalogue (by feature area)

Legend — **A** = `[AllowAnonymous]`, **🔒** = authenticated, **perm** = required dotted permission
(enforced in the MediatR pipeline; SuperAdmin bypasses all). Self-service endpoints marked **(self)** need
only a valid session, no named permission.

### 2.1 Auth — `/api/auth` *(rate-limited: 10 req / 5 min per partition)*

| Verb | Route | Access | Request | Response (`data`) |
|---|---|---|---|---|
| POST | `/register` | A | `{firstName,lastName,email,password,phoneNumber?}` | `Guid` (201, Location `/api/users/{id}`) |
| POST | `/login` | A | `{email,password}` (+`X-Device-Id`) | `AuthResultDto` · **403 `Auth.TwoFactorRequired`** when 2FA needed |
| POST | `/login/2fa` | A | `{email,password,code}` | `AuthResultDto` |
| POST | `/refresh` | A | `{refreshToken}` | `AuthResultDto` (rotated pair) |
| POST | `/logout` | 🔒 | — | 204 (revokes current session) |
| POST | `/forgot-password` | A | `{email}` | 204 (always) |
| POST | `/reset-password` | A | `{token,newPassword}` | 204 |
| POST | `/confirm-email` | A | `{token}` | 204 |
| POST | `/send-email-confirmation` | A | `{email}` | 204 (always) |
| POST | `/social-login` | A | `{provider:int,code,redirectUri?}` | `AuthResultDto` |
| POST | `/switch-tenant` | 🔒 **SuperAdmin** | `{targetTenantId}` | `SwitchTenantResultDto` `{accessToken}` |
| POST | `/request-account-unlock` | A | `{email}` | 204 (always) |
| POST | `/unlock-account` | A | `{token}` | 204 |

`AuthResultDto` = `{ accessToken, refreshToken, refreshTokenExpiresAt, userId, email, fullName }`.

### 2.2 Two-Factor — `/api/twofactor` *(all 🔒 self)*

| Verb | Route | Request | Response |
|---|---|---|---|
| GET | `/status` | — | `TwoFactorStatusDto {enabled,setupPending,remainingBackupCodes}` |
| POST | `/enable` | — | `TwoFactorSetupDto {sharedKey, authenticatorUri}` |
| POST | `/verify` | `{code}` | `BackupCodesDto {codes[]}` ⚠ shown once — activates 2FA |
| POST | `/disable` | `{code}` | 204 |
| POST | `/backup-codes` | `{code}` | `BackupCodesDto {codes[]}` ⚠ shown once |

### 2.3 Sessions — `/api/sessions` *(🔒 self)*

| Verb | Route | Response |
|---|---|---|
| GET | `/` | `SessionDto[]` |
| DELETE | `/{id}` | 204 (revoke one) |
| DELETE | `/` | 204 (revoke all) |

### 2.4 Devices — `/api/devices` *(🔒 self)*

| Verb | Route | Notes |
|---|---|---|
| GET | `/` | `DeviceDto[]` |
| POST | `/{id}/trust?trustDays=` | mark trusted (satisfies 2FA from that device) |
| POST | `/{id}/revoke` | remove trust |

### 2.5 API Keys — `/api/apikeys` *(🔒)*

| Verb | Route | Perm | Response |
|---|---|---|---|
| GET | `/` | `apikeys.list` | `ApiKeyDto[]` |
| POST | `/` | `apikeys.create` | `ApiKeyCreatedDto {id,apiKey,prefix}` ⚠ secret once |
| POST | `/{id}/rotate` | `apikeys.update` | `ApiKeyCreatedDto` ⚠ secret once |
| DELETE | `/{id}` | `apikeys.delete` | 204 |

Create body: `{name, scopes[], expiresAt?, ipBindings?[]}`.

### 2.6 Social Accounts — `/api/socialaccounts` *(🔒 self)*

| Verb | Route | Body | Response |
|---|---|---|---|
| GET | `/` | — | `SocialAccountDto[]` |
| POST | `/` | `{provider:int,providerAccountId,displayName?,email?,pictureUrl?}` | `Guid` (201) |
| DELETE | `/{id}` | — | 204 |

### 2.7 Users — `/api/users` *(🔒)*

| Verb | Route | Perm | Req / Resp |
|---|---|---|---|
| GET | `/` | `users.list` | query `{pageNumber,pageSize,search?}` → `PagedResult<UserListItemDto>` (output-cached) |
| GET | `/{id}` | `users.view` | → `UserDto` |
| GET | `/{id}/roles` | `roles.view` | → `RoleListItemDto[]` |
| POST | `/` | `users.create` | `{firstName,lastName,email,password,phoneNumber?}` → `Guid` |
| PUT | `/{id}` | `users.update` | `UpdateUserRequest` (profile fields, see DTO §11) → 204 |
| DELETE | `/{id}` | `users.delete` | → 204 (soft delete) |
| POST | `/{id}/unlock` | `users.update` | → 204 |

> **No `/users/me`.** A user's own identity comes from `AuthResultDto` + JWT claims. Fetching the full
> `UserDto` for self requires `users.view`, which a normal user may lack → profile screen is built from the
> in-memory identity + Preferences (see §10, Open Question Q3).

### 2.8 Roles — `/api/roles` *(🔒)*

| Verb | Route | Perm | Req / Resp |
|---|---|---|---|
| GET | `/` | `roles.list` | query paged → `PagedResult<RoleListItemDto>` (cached) |
| GET | `/mine` | (self) | → `RoleListItemDto[]` (caller's roles) |
| GET | `/{id}` | `roles.view` | → `RoleDto` (incl. `permissionCodes[]`) |
| POST | `/` | `roles.create` | `CreateRoleRequest` → `Guid` |
| PUT | `/{id}` | `roles.update` | `UpdateRoleRequest` → 204 |
| DELETE | `/{id}` | `roles.delete` | → 204 (system roles blocked) |
| POST | `/{roleId}/users/{userId}` | `roles.assign` | → 204 |
| DELETE | `/{roleId}/users/{userId}` | `roles.assign` | → 204 |

Role create/update carry: `name, description?, hierarchy, permissionCodes[]?, displayOrder, color?, parentRoleId?, translations[]?`.

### 2.9 Permissions — `/api/permissions` *(🔒)*

| Verb | Route | Perm | Resp |
|---|---|---|---|
| GET | `/` | `permissions.list` | query `{module?}` → `PermissionDto[]` (catalogue) |
| GET | `/mine` | (self) | → `string[]` ⭐ **caller's effective permission codes** |

### 2.10 Departments — `/api/departments` *(🔒)* + public mirror

| Verb | Route | Perm | Req / Resp |
|---|---|---|---|
| GET | `/tree` | `departments.view` | → `DepartmentTreeNodeDto[]` (nested, raw translations) |
| POST | `/` | `departments.create` | `{name,parentId?,sortOrder,description?,translations[]?}` → `Guid` |
| PUT | `/{id}` | `departments.update` | same shape → 204 |
| DELETE | `/{id}` | `departments.delete` | → 204 |
| GET | `/api/public/departments/tree` | **A** | → `LocalizedDepartmentTreeNodeDto[]` (culture-resolved, no translations map) |

### 2.11 Tenants — `/api/tenants` *(🔒 cross-tenant admin)*

| Verb | Route | Perm | Req / Resp |
|---|---|---|---|
| GET | `/` | `tenants.list` | paged → `PagedResult<TenantListItemDto>` (cached) |
| GET | `/{id}` | `tenants.view` | → `TenantDto` |
| POST | `/` | `tenants.create` | `{name,slug,subscriptionTier,features[]?,defaultCulture?}` → `Guid` |
| PUT | `/{id}` | `tenants.update` | `{name,subscriptionTier,defaultCulture?}` → 204 |
| DELETE | `/{id}` | `tenants.delete` | → 204 |

### 2.12 Tenant security — IP filters, password policy, delegations

| Verb | Route | Perm | Notes |
|---|---|---|---|
| GET | `/api/ipfilters` | `ipfilters.list` | → `IpFilterDto[]` |
| POST | `/api/ipfilters` | `ipfilters.create` | `{ipAddressOrCidr,type:int,description?}` → `Guid` |
| DELETE | `/api/ipfilters/{id}` | `ipfilters.delete` | 204 |
| GET | `/api/passwordpolicies` | `passwordpolicies.view` | → `PasswordPolicyDto` |
| PUT | `/api/passwordpolicies` | `passwordpolicies.upsert` | full policy → 204 |
| GET | `/api/delegations` | (self) | → `DelegationDto[]` |
| POST | `/api/delegations` | (self) | `{delegatedToId,permissionSet[],startsAt,expiresAt}` → `Guid` |
| DELETE | `/api/delegations/{id}` | (self) | 204 |

### 2.13 Preferences — `/api/preferences` *(🔒 self)*

| Verb | Route | Resp |
|---|---|---|
| GET | `/` | `PreferencesDto` (language, theme, timezone, 16 toggle/numeric fields) |
| PUT | `/` | `UpdatePreferencesRequest` → 204 |

### 2.14 Misc / infra

| Verb | Route | Access | Resp |
|---|---|---|---|
| GET | `/api/localization/cultures` | **A** | `{cultures:["en","ar"], default:"en"}` |
| GET | `/api/greeting` | **A** | `"Welcome to Frame."` (liveness) |
| GET | `/health`, `/health/ready` etc. | A | health checks (mapped, not under `/api`) |

## 3. Feature inventory (confirmed present in code)

✅ Authentication (register / login / refresh / logout / forgot+reset password / confirm+resend email /
account unlock) · ✅ **2FA (TOTP) + backup codes** + trusted-device bypass · ✅ Sessions/devices management ·
✅ **Social login** (Google/Microsoft/GitHub/Facebook/Apple — enum) + linked-account management ·
✅ **API keys** (scoped, IP-bound, rotate/revoke, reveal-once) · ✅ Users CRUD + unlock + role assignment ·
✅ **Roles** (hierarchy, parent, color, permission codes, system-role protection, translations) ·
✅ **Permissions** catalogue + `mine` · ✅ **Departments** tree (hierarchical, translations, public mirror) ·
✅ **Tenants** CRUD + super-admin **switch-tenant** · ✅ Tenant security: **IP filters, password policy,
permission delegations** · ✅ **User preferences** (language/theme/timezone/notifications/privacy) ·
✅ Localization metadata (en + ar).

❌ **Not present** (do not build UI for): audit-log read API, subscription/billing API, notifications feed
API, a `/users/me` endpoint, OAuth provider-redirect initiation (social-login takes a code the client must
already have — see Q4).

## 4. Auth model (verified)

- **Login** (`POST /api/auth/login`) verifies credentials and returns `AuthResultDto` with **both tokens in
  the response body**. Access = signed **HS256 JWT, 15-min** lifetime. Refresh = opaque random token,
  **30-day** lifetime, only its hash stored.
- **JWT claims:** `nameidentifier` (userId), `email`, `tenant_id`, `sid` (session id), and `role` claims
  (one per role). ⭐ **Permissions are NOT in the JWT** — the SPA must call `GET /api/permissions/mine`.
- **2FA at login:** if 2FA is on and the device isn't trusted, login returns **`403` with title
  `Auth.TwoFactorRequired`**. The SPA must catch that code and complete via `POST /api/auth/login/2fa`
  (re-send email+password+TOTP/backup code). A device the user trusted earlier (`POST /api/devices/{id}/trust`)
  bypasses 2FA when the same `X-Device-Id` is sent.
- **Refresh / rotation:** `POST /api/auth/refresh` rotates the token (old token marked used, new pair issued).
  **Reuse detection:** replaying an already-rotated token revokes the **entire token family + the session**
  → `401 Auth.RefreshTokenReused`. Other refresh failures: `Auth.InvalidRefreshToken`,
  `Auth.RefreshTokenExpired`, `Auth.SessionRevoked` (all 401).
- **Session validation:** every authenticated request re-checks the `sid` session server-side (cached 60s),
  so **logout / revoke / deactivation take effect within ~60s** and return `401` ("The session is no longer
  valid.") thereafter. → The SPA must treat a mid-session 401 as "log out & redirect".
- **Logout** revokes the current session (`204`). The SPA also clears all in-memory state.

## 5. Multi-tenancy (verified — isolation is a hard requirement)

- Tenant resolved by `TenantMiddleware` from the **`X-Tenant` slug header** (or host suffix, which is **off**
  by default — `Multitenancy:TenantHostSuffix` is empty).
- **`IsTenantPermitted` rule (must be honoured exactly):**
  - **Anonymous** caller → any tenant slug allowed (pre-auth flows: login, public site).
  - **SuperAdmin** → any tenant (legitimately cross-tenant; also uses `switch-tenant`).
  - **Normal authenticated** caller → `X-Tenant` is allowed **only if it equals their own token tenant**;
    **any other value → `403`** (not a silent fallback).
- **SPA rule:** send `X-Tenant` only (a) before login, set to the tenant the user is signing into, or
  (b) for a SuperAdmin explicitly operating cross-tenant. For a normal signed-in user **never send an
  `X-Tenant` that differs from their token tenant** — the interceptor must enforce this so the UI can never
  trigger a cross-tenant 403. Cross-tenant switching is **SuperAdmin-only** via `POST /api/auth/switch-tenant`,
  which returns a new access token whose `tenant_id` points at the target.

## 6. Authorization model (verified)

- **Dotted permission codes** `module.action`. Full catalogue (from `PermissionNames`):
  - **users:** create, update, delete, bulkdelete, view, list, export, activate, assignroles, managepassword
  - **roles:** create, update, delete, view, list, assign
  - **permissions:** list, view
  - **tenants:** create, update, delete, view, list
  - **apikeys:** create, update *(=rotate)*, delete *(=revoke)*, list
  - **sessions:** list, delete *(reserved; sessions endpoints are self-service today)*
  - **departments:** create, update, delete, view
  - **ipfilters:** create, delete, list
  - **passwordpolicies:** upsert, view
- **Role model:** named roles with an integer **hierarchy** (higher outranks lower), optional **parent role**,
  `isSystem` (protected), `isActive`, display order, color, and per-language translations. **`SuperAdmin`**
  is a well-known role that **bypasses all permission checks**.
- **Per-endpoint permission map** is in §2 (the `Perm` columns) — derived from each command/query's
  `IRequireNamedPermission.Permission`.
- **UI consequence:** the SPA fetches `GET /api/permissions/mine` (a `string[]`) right after login and drives
  **menu / route (`canMatch`) / element** visibility from it. SuperAdmin is detected from the `role` JWT claim
  and is treated as "has every permission". The server remains the source of truth; the UI only hides
  convenience.

## 7. Error contract (verified — RFC 7807)

`BaseApiController.Problem` maps `Result.Error` → status:

| `ErrorType` | HTTP | Body |
|---|---|---|
| Validation | **400** | `ValidationProblemDetails` |
| NotFound | 404 | `ProblemDetails` |
| Conflict | 409 | `ProblemDetails` |
| Unauthorized | 401 | `ProblemDetails` |
| Forbidden | 403 | `ProblemDetails` |
| (other) | 500 | `ProblemDetails` |

- **`title` = the stable, machine-readable code** (e.g. `Auth.InvalidCredentials`, `Auth.TwoFactorRequired`,
  `Auth.AccountLocked`). **`detail` = the human message, localized** to the request culture.
- **Validation errors:** `ValidationProblemDetails.errors` is `{ "<field>": ["<code>", ...] }`. Each value is
  **itself a stable code** (e.g. `Email.Invalid`, `Password.TooShort`) that the server has already localized.
  The SPA maps these onto reactive-form controls per field, and shows `detail` as the summary.
- **Infrastructure errors bypass the envelope** and are plain `ProblemDetails` written by middleware:
  - Tenant denied → `403` `application/problem+json`, `title` = "The requested tenant is not permitted…".
  - Session invalid → `401` `application/problem+json`.
  - Unhandled → `500` (detail only in Development).
  - **IP-filter block → `403` with a `text/plain` body `"IP address is not permitted."`** (⚠ not JSON).
  - **Rate limit → `429`** (no body) + `Retry-After` (see §9.1).
- **SPA error-mapping interceptor:** read `problem.title` as the code → look up a localized,
  user-facing message (Transloco key, e.g. `errors.Auth.InvalidCredentials`), falling back to
  `problem.detail`. Handle the non-JSON IP-filter 403 and bodyless 429 specially.

## 8. Localization (verified)

- **Supported cultures:** `en` (default) and **`ar` (RTL)**. Source of truth: `GET /api/localization/cultures`.
- **Server culture resolution chain (first match wins):** authenticated **user preference** → query string
  (`?culture=`) / cookie (`.AspNetCore.Culture`) → **`Accept-Language`** → tenant default → app default.
- **SPA approach:** send `Accept-Language` on every request (anonymous + authed); persist the user's choice via
  `PUT /api/preferences` so the server preference wins once signed in. The API returns culture-invariant data
  (ISO-8601 dates, invariant numbers) — **only human text is localized**; the SPA formats dates/numbers itself.
- **Localized DB content:** roles, permissions, departments carry a **raw `translations[]` array**
  (`{lang, name?, description?}`) alongside the **base** (default-culture) `name`/`description`. The SPA
  resolves the display value for the active culture from `translations`, falling back to the base value. The
  **public** department tree (`/api/public/departments/tree`) is pre-resolved to one culture instead.

## 9. Security-relevant behaviour (verified)

### 9.1 Rate limiting
Global **100 req / 1 min**; **auth endpoints 10 req / 5 min** (per partition). Rejection → **`429` +
`Retry-After`** (seconds). SPA: surface a friendly "too many attempts, retry in N s" and back off; never hammer.

### 9.2 Lockout
Failed logins increment a counter; at the policy threshold (default **5**) the account locks for the policy
window (default **15 min**) → `403 Auth.AccountLocked`. SPA shows a distinct lockout message and a
"request unlock email" affordance (`/api/auth/request-account-unlock`).

### 9.3 Password policy
Per-tenant: min length, require digit/special/upper/lower, max-age days, history count, lockout threshold/
minutes. Non-compliant password → `400 Auth.PasswordNotCompliant`. SPA mirrors the policy (fetched where the
user has `passwordpolicies.view`) for **client-side hints only**; server validation is authoritative.

### 9.4 IP filtering
Per-tenant allow/block CIDR rules; a blocked address gets **`403` `text/plain`** before reaching MVC. SPA must
detect this (non-JSON 403) and show an "access blocked from your network" page rather than a parse error.

### 9.5 CORS (⚠ shapes the security design — verified in `Program.cs`)
- **Allowed origins:** `https://localhost:5173`, `http://localhost:5173`, `http://localhost:4200`.
  → **Dev server can run on `:4200` (Angular default) or `:5173`.** Production origin must be added server-side.
- **Allowed headers (default):** `Authorization, Content-Type, Accept-Language, X-Tenant, X-Correlation-ID,
  Idempotency-Key, X-Api-Version`.
  → **`X-Device-Id` and `X-Api-Key` are NOT allowed.** Using trusted-device 2FA bypass from the browser
  requires adding `X-Device-Id` to `Cors:AllowedHeaders` server-side (**Open Question Q1**).
- **Exposed headers:** `X-Correlation-ID, Location, Retry-After, api-supported-versions`.
- **`AllowCredentials()` is NOT set.** → **Cross-origin cookies are not accepted by the API.** A pure
  httpOnly-refresh-cookie strategy is therefore **not currently possible without a backend change** (see §
  Phase 3 + Q2).

### 9.6 Response security headers
Server already sends `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`,
and an **API** CSP `default-src 'none'`. That CSP is for the API responses only; the **SPA ships its own CSP**
via its host (see Phase 3).

## 10. Wire "gotchas" the SPA must encode

1. **Enums are integers** — mirror `Gender, UserStatus, SessionType, DeviceType, SocialProvider, IpFilterType,
   ApiKeyStatus, AuditSeverity` exactly (values listed in §11).
2. **Permissions are not in the JWT** — fetch `/api/permissions/mine`.
3. **No `/users/me`** — build self-identity from `AuthResultDto` + JWT; fetch `/api/preferences` for settings.
4. **2FA login is a 403 code, not a field** — branch on `title === 'Auth.TwoFactorRequired'`.
5. **Reveal-once secrets** — `ApiKeyCreatedDto.apiKey`, `BackupCodesDto.codes` are returned exactly once; the
   UI must force the user to copy them and never refetch.
6. **IP-filter 403 is plain text; 429 has no body** — handle before generic JSON error parsing.
7. **`X-Tenant` isolation** — never let a normal user override it (§5).
8. **Validation values are codes** — translate them; don't display raw `Email.Invalid`.

## 11. Enum & DTO reference (wire values)

- **Gender:** Male 0, Female 1, Other 2, Unspecified 3
- **UserStatus:** Pending 0, Active 1, Suspended 2, Deactivated 3
- **SessionType:** PasswordLogin 0, TwoFactor 1, SocialLogin 2, RememberMe 3, TrustedDevice 4
- **DeviceType:** Browser 0, Mobile 1, Desktop 2, Tablet 3, Api 4
- **SocialProvider:** Google 0, Microsoft 1, GitHub 2, Facebook 3, Apple 4
- **IpFilterType:** Allow 0, Block 1
- **ApiKeyStatus:** Active 0, Expired 1, Revoked 2

Key DTO field lists captured in §2; the full set (UserDto's ~25 fields, PreferencesDto's 18, SessionDto,
DeviceDto, etc.) will be generated as TypeScript interfaces in `core/models` during scaffolding, one file per
feature, matching the C# records exactly.

---

# PHASE 2 — ARCHITECTURE & STACK

## 12. Stack (design-first; TailAdmin Free + Tailwind + CDK)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Angular (latest stable)** — standalone components, **signals**, new control flow (`@if`/`@for`), typed reactive forms, `inject()`, lazy routes via `canMatch` | Required; no NgModules |
| Styling | **Tailwind CSS** + **TailAdmin Free** design tokens/layout shell | Single visual source of truth |
| Behavior/a11y | **Angular CDK** (overlay, dialog, a11y/FocusTrap, menu, listbox, tree, drag-drop, virtual-scroll) | TailAdmin ships no behavior; CDK fills it |
| Data grid | **TanStack Table (Angular adapter)**, headless, Tailwind-styled | Server-side paging/sort/filter/selection for users/roles/sessions/tenants/audit-style grids |
| i18n | **Transloco** (runtime en↔ar switch, lazy scopes) | Runtime culture switch without reload |
| State | **Signals + feature services** (default). A store only if a feature proves it needs one (justified, not upfront) | Simplicity; Angular-native |
| HTTP | Typed feature clients + functional interceptors + env-based base URL | Central contract handling |
| Tests | **Jasmine + Karma** run headless on **Edge** (`CHROME_BIN`) | No Chrome on this box; Edge works |
| Lint/format | ESLint (angular-eslint, strict) + Prettier | Production quality |

> **AG Grid is *not* adopted.** TanStack covers every grid need here; AG Grid's enterprise features (and
> licensing) aren't warranted. Flagged only so the decision is explicit.

## 13. TailAdmin Free vs Pro audit

**Extract from TailAdmin Free (layout + tokens only):** sidebar shell + collapse behavior, topbar/header,
dark-mode toggle + theme tokens, `tailwind.config` design tokens (colors, spacing, radius, shadows), global
CSS, and the visual language of cards / badges / stat widgets / form controls / basic tables / modals / alerts /
dropdowns / breadcrumbs.

**Delete entirely (demo):** every demo *page/route*, ecommerce/analytics/invoice/calendar/chart sample data,
mock services, and any inline `<script>`/handlers in ported HTML.

**Pro-only (not in Free) → we build on CDK, don't stall:** advanced/combobox multiselect, data-grid with
server features (→ **TanStack**), date/time pickers (→ CDK overlay + headless, or a small a11y lib),
toast/notification system (→ CDK overlay), tree view for departments (→ **CDK Tree**), richer modals/drawers
(→ CDK Dialog). None block us; all are in the shared kit below.

## 14. Shared UI kit (CDK + Tailwind, TailAdmin-styled, accessible)

`button · input · textarea · select/combobox (CDK listbox) · checkbox/radio/toggle · form-field (label+error
wiring to ProblemDetails) · modal/dialog (CDK Dialog + focus trap) · drawer · toast (CDK overlay) · tabs (CDK
a11y) · table (TanStack + pagination) · tree (CDK Tree, for departments) · badge · card · empty-state ·
spinner/skeleton · breadcrumb · pagination · permission-gated `*hasPermission` directive`.
Every component: keyboard-navigable, ARIA-correct, focus-managed, and **RTL-verified**.

## 15. Project structure

```
client/
  src/app/
    core/            # singletons: auth, http, interceptors, guards, tenant, i18n, theme, models, config
      auth/          # TokenStore (abstraction), AuthService, session/identity signals
      http/          # ApiClient base, envelope unwrap
      interceptors/  # auth+tenant, refresh (single-flight), error→ProblemDetails
      guards/        # authGuard, permissionGuard (canMatch factories)
      models/        # generated TS interfaces + enums (one file per feature)
      tenant/        # tenant context (isolation rules)
      i18n/ theme/   # Transloco + dir/lang + light/dark
    shared/
      ui/            # the component kit (§14)
      directives/    # *hasPermission, etc.
      pipes/ utils/
    features/        # lazy, one folder per area, each with its routes + service + components
      auth/  dashboard/  users/  roles/  permissions/  departments/
      tenants/  security/(2fa,sessions,devices,api-keys,social)
      admin/(tenants,ip-filters,password-policy,delegations)  account/(profile,preferences)
    layout/          # app shell: sidebar, topbar, theme/lang toggles
  FRONTEND_PLAN.md   # this file
  README.md          # (added during scaffolding)
```

## 16. Routing & guards
- All feature routes **lazy** via `loadComponent`/`loadChildren`, guarded by **`canMatch`**:
  `authGuard` (valid session) + `permissionGuard(['users.list', ...])` (driven by `/permissions/mine`,
  SuperAdmin bypass). A failed `canMatch` falls through to a 403 page, never leaks the chunk.
- Public routes (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/confirm-email`, 2FA challenge)
  outside the authenticated shell.

## 17. HTTP layer & interceptors (3, in order)
1. **Auth + tenant** — attach `Authorization: Bearer` (from in-memory store) and, **only when permitted**, the
   `X-Tenant` header (§5 rule enforced here); always attach `Accept-Language`.
2. **Refresh (single-flight)** — on `401`, pause the request, run **one** `/auth/refresh` (rotation), retry the
   original; concurrent 401s share the one refresh. On refresh failure → **auto-logout** + redirect.
3. **Error → ProblemDetails** — central mapping (§7): unwrap envelope on success; on error read `title` code →
   localized message; special-case text/plain IP 403 and bodyless 429.

## 18. Theming matrix (light/dark × LTR/RTL)
Driven by `tailwind.config` tokens + a `dir`/`lang` attribute on `<html>`. **Tailwind logical properties only**
(`ps-/pe-`, `ms-/me-`, `start-/end-`, `rtl:`/`ltr:` variants). All four quadrants
(light-LTR, light-RTL, dark-LTR, dark-RTL) are an **acceptance criterion**, with an automated RTL render check.

## 19. Build order (feature-by-feature)
1. **Scaffold** clean Angular app + Tailwind + extract TailAdmin shell/tokens (delete all demos) + CDK +
   Transloco + CSP + env config.
2. **Core**: TokenStore abstraction, AuthService, 3 interceptors, guards, models/enums, tenant context, i18n/RTL,
   theme. Unit tests for guards/interceptors/token store.
3. **Auth slice** (proven pattern): login → 2FA challenge → refresh/rotation → logout; register / forgot /
   reset / confirm-email. Wires the whole security model end-to-end.
4. **App shell**: sidebar/topbar (permission-gated menu), theme + language toggles, 403/404/empty/loading states.
5. **Departments CRUD** (first full vertical CRUD slice — tree + translations) as the reference feature.
6. Users → Roles & Permissions (incl. role↔user assignment) → Profile & Preferences →
   Security center (2FA/sessions/devices/api-keys/social) → Tenant admin (tenants/switch-tenant/password-policy/
   ip-filters/delegations).
7. Harden: a11y pass, RTL pass, tests, README, production build budgets.

## 20. Phase 3 (security) — decisions baked into the plan
- **Token storage:** access token **in memory** only. Refresh token: because **CORS has no `AllowCredentials`
  and the API returns the refresh token in the body**, a pure httpOnly-cookie flow is **not possible today**
  without a backend change. **Recommendation:** put the refresh token behind a single `TokenStore`
  abstraction — in memory, with an optional `sessionStorage` fallback for reload survival — **never
  `localStorage`**, and isolate it so swapping to an httpOnly cookie later is a **one-file change** once the
  backend adds `AllowCredentials` + `Set-Cookie` (Q2). This is the documented trade-off the task asks for.
- **Auto-logout** on refresh failure / session-revoke 401; clear all in-memory state on logout.
- **XSS:** rely on Angular sanitization; no `bypassSecurityTrust*` without a documented reason; no `innerHTML`
  with untrusted data; strip inline scripts/handlers from ported TailAdmin HTML.
- **CSP:** ship a strict policy from the SPA host (no `unsafe-inline` scripts; Tailwind compiles to static CSS
  so styles need no `unsafe-inline`). Directives documented in the README.
- **Lockout / 429 / IP-filter** handled with specific user-facing messages (§9).
- **No secrets in client** — `environment.ts` only; base URL per env; nothing hardcoded.

## 21. Phase 4 (production) — commitments
Strict TS (no `any` without justification), ESLint + Prettier, Tailwind content paths set so unused CSS purges,
env-based config, build optimization + lazy loading + `OnPush`, global error handling with TailAdmin-styled
error/empty/loading states, **a11y on every shared component**, tests (guards, interceptors, core services,
data-grid, a couple feature smokes, an RTL render check), and a `client/README.md` documenting setup/run/build/
test, design-system + RTL conventions, and the security model.

---

## 22. Open questions for you (need a decision before/at coding)

- **Q1 — `X-Device-Id` CORS:** add it to `Cors:AllowedHeaders` so browser trusted-device 2FA-bypass works?
  (Else the SPA omits device-id and 2FA users always get the TOTP challenge.) **Recommend: add it.**
- **Q2 — Refresh-token storage:** accept the documented **in-memory + sessionStorage behind an abstraction**
  approach now, or first add backend `AllowCredentials` + httpOnly `Set-Cookie` on `/login`+`/refresh` so we
  go cookie-based from day one? **Recommend: ship the abstraction now; migrate to cookie when backend allows.**
- **Q3 — Self profile:** OK to render the profile screen from `AuthResultDto` + JWT + `/preferences` (since
  there's no `/users/me` and normal users may lack `users.view`)? Or add a `/users/me` endpoint? **Recommend:
  build from in-memory identity now; add `/users/me` later if richer self-profile is needed.**
- **Q4 — Social login:** `/social-login` consumes an OAuth **code** the client must already hold, but there's
  no provider-redirect-initiation endpoint and `SocialAuth:*` client IDs are empty. Build the social buttons
  now (provider redirect handled client-side once IDs are configured) or **defer social login** until the
  OAuth apps exist? **Recommend: defer the OAuth redirect wiring; keep linked-account *management* UI.**
- **Q5 — Dev server port:** `:4200` (Angular default, already in CORS) vs `:5173`. **Recommend: `:4200`.**
```

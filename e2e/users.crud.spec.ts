import { Page, Route, expect, test } from '@playwright/test';

/**
 * Backend-free CRUD flow: every `/api/**` call is fulfilled by `page.route()` mocks, so this proves the
 * real app wiring — login → establish session → permission-gated routing → users list → details page →
 * edit page → save — end-to-end without a running backend. It complements the auth smoke (which never
 * touches the API) by exercising the authenticated surface, and documents the template's pattern for
 * writing deterministic e2e against mocked APIs.
 */

/** The standard success envelope (`ApiResponse<T>`) every endpoint returns. */
const envelope = (data: unknown) => ({ data, success: true, message: null, correlationId: null });

const b64url = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

/** Unsigned JWT carrying the claims the SPA decodes for UX (identity, roles, tenant, expiry). */
const accessToken = [
  b64url({ alg: 'none', typ: 'JWT' }),
  b64url({
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier': 'u-admin',
    role: 'Admin',
    tenant_id: 't1',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }),
  'sig',
].join('.');

const authResult = {
  accessToken,
  refreshToken: 'rt-1',
  refreshTokenExpiresAt: '2099-01-01T00:00:00Z',
  userId: 'u-admin',
  email: 'admin@frame.local',
  fullName: 'Frame Admin',
};

/** Grants the users feature (route guard `users.list` + every gated control on the pages). */
const grantedPermissions = [
  'users.list',
  'users.view',
  'users.create',
  'users.update',
  'users.delete',
  'users.managepassword',
  'roles.assign',
];

const listItem = {
  id: 'u1',
  fullName: 'Amina Hassan',
  email: 'amina@example.com',
  status: 1, // Active
  isSystem: false,
  isLockedOut: true,
  createdAt: '2026-01-01T00:00:00Z',
};

const userDetail = {
  ...listItem,
  firstName: 'Amina',
  lastName: 'Hassan',
  phoneNumber: '+201000000000',
  emailConfirmed: true,
  phoneConfirmed: false,
  avatarUrl: null,
  gender: null,
  twoFactorEnabled: false,
  lockoutEnd: '2099-01-01T00:00:00Z',
  lastLoginAt: null,
};

const adminRole = {
  id: 'r1',
  name: 'Admin',
  description: null,
  isSystem: false,
  isActive: true,
  hierarchy: 1,
  parentRoleId: null,
  displayOrder: 0,
  color: null,
  translations: [],
};

const statusCounts = { total: 1, pending: 0, active: 1, suspended: 0, deactivated: 0 };

const pageOf = (items: unknown[]) => ({
  items,
  pageNumber: 1,
  pageSize: 10,
  totalCount: items.length,
  totalPages: 1,
  hasPreviousPage: false,
  hasNextPage: false,
});

/** Captures mutation payloads so the test can assert what the app actually sent. */
interface Captured {
  updateBody?: Record<string, unknown>;
}

async function mockApi(page: Page, captured: Captured): Promise<void> {
  await page.route('**/api/**', async (route: Route) => {
    const { pathname } = new URL(route.request().url());
    const method = route.request().method();
    const json = (data: unknown) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(envelope(data)),
      });

    if (method === 'POST' && pathname.endsWith('/api/auth/login')) {
      return json(authResult);
    }
    if (method === 'GET' && pathname.endsWith('/api/permissions/mine')) {
      return json(grantedPermissions);
    }
    if (method === 'GET' && pathname.endsWith('/api/users/status-counts')) {
      return json(statusCounts);
    }
    if (method === 'GET' && pathname.endsWith('/api/users/u1/roles')) {
      return json([adminRole]);
    }
    if (method === 'GET' && pathname.endsWith('/api/users/u1')) {
      return json(userDetail);
    }
    if (method === 'PUT' && pathname.endsWith('/api/users/u1')) {
      captured.updateBody = route.request().postDataJSON() as Record<string, unknown>;
      return json(null);
    }
    if (method === 'GET' && pathname.endsWith('/api/users')) {
      return json(pageOf([listItem]));
    }
    // Anything unmocked fails loudly instead of hanging the run.
    return route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ title: 'E2E.Unmocked', detail: `${method} ${pathname}` }),
    });
  });
}

test('login → users list → details → edit → save, fully mocked', async ({ page }) => {
  const captured: Captured = {};
  await mockApi(page, captured);

  // Sign in through the real form; establish() stores tokens and loads permissions.
  await page.goto('/auth/login');
  await page.locator('#email').fill('admin@frame.local');
  await page.locator('#password').fill('ChangeMe!123');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/dashboard/);

  // The Users nav item is permission-gated; reaching the list proves gating + the lazy route.
  await page.locator('a[href="/users"]').first().click();
  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByText('Amina Hassan')).toBeVisible();

  // Row click navigates to the details page (deep-linkable URL, loads profile + roles).
  await page.getByText('Amina Hassan').first().click();
  await expect(page).toHaveURL(/\/users\/u1\/details$/);
  await expect(page.getByText('amina@example.com').first()).toBeVisible();
  await expect(page.getByText('Admin', { exact: true })).toBeVisible(); // assigned-role badge
  await expect(page.getByText('Locked', { exact: true })).toBeVisible(); // lockout badge

  // Edit routes to the form page primed from the fetched record; email is not editable.
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page).toHaveURL(/\/users\/u1\/edit$/);
  await expect(page.locator('#u-firstName')).toHaveValue('Amina');

  await page.locator('#u-firstName').fill('Amira');
  await page.getByRole('button', { name: 'Save' }).click();

  // Save PUTs the update, toasts, and returns to the list.
  await expect(page).toHaveURL(/\/users$/);
  await expect(page.getByText('User updated.')).toBeVisible();
  expect(captured.updateBody).toMatchObject({ firstName: 'Amira', lastName: 'Hassan' });
});

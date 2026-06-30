import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { hasAnyPermission } from './core/guards/permission.guard';
import { unsavedChangesGuard } from './core/guards/unsaved-changes.guard';
import { Permissions } from './core/auth/permissions';

/**
 * Root routing. Public auth routes load behind `guestGuard`; everything else loads inside the
 * authenticated app shell behind `authGuard`. Each feature is a lazy child of the shell, additionally
 * gated by `hasAnyPermission` where the backend requires a permission. Features not yet built (build-order
 * steps 5–6) resolve to the shared coming-soon placeholder so the menu, breadcrumb, and guards are all
 * live now; each swaps its `loadComponent` as the real feature lands.
 */
export const routes: Routes = [
  {
    path: 'auth',
    canMatch: [guestGuard],
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '',
    canMatch: [authGuard],
    loadComponent: () => import('./layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        data: { titleKey: 'nav.dashboard' },
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },

      // --- Management (placeholder until each feature is built) ---
      {
        path: 'users',
        canMatch: [hasAnyPermission([Permissions.users.list])],
        data: { titleKey: 'nav.users' },
        loadChildren: () => import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
      },
      {
        path: 'roles',
        canMatch: [hasAnyPermission([Permissions.roles.list])],
        data: { titleKey: 'nav.roles' },
        loadChildren: () => import('./features/roles/roles.routes').then((m) => m.ROLES_ROUTES),
      },
      {
        path: 'permissions',
        canMatch: [hasAnyPermission([Permissions.permissions.list])],
        data: { titleKey: 'nav.permissions' },
        loadChildren: () =>
          import('./features/permissions/permissions.routes').then((m) => m.PERMISSIONS_ROUTES),
      },
      {
        path: 'departments',
        canMatch: [hasAnyPermission([Permissions.departments.view])],
        data: { titleKey: 'nav.departments' },
        loadChildren: () =>
          import('./features/departments/departments.routes').then((m) => m.DEPARTMENTS_ROUTES),
      },

      // --- Administration ---
      {
        path: 'admin/tenants',
        canMatch: [hasAnyPermission([Permissions.tenants.list])],
        data: { titleKey: 'nav.tenants' },
        loadComponent: () =>
          import('./features/admin/tenants-page.component').then((m) => m.TenantsPageComponent),
      },
      {
        path: 'admin/ip-filters',
        canMatch: [hasAnyPermission([Permissions.ipFilters.list])],
        data: { titleKey: 'nav.ipFilters' },
        loadComponent: () =>
          import('./features/admin/ip-filters-page.component').then(
            (m) => m.IpFiltersPageComponent,
          ),
      },
      {
        path: 'admin/password-policy',
        canMatch: [hasAnyPermission([Permissions.passwordPolicies.view])],
        canDeactivate: [unsavedChangesGuard],
        data: { titleKey: 'nav.passwordPolicy' },
        loadComponent: () =>
          import('./features/admin/password-policy-page.component').then(
            (m) => m.PasswordPolicyPageComponent,
          ),
      },

      // --- Self-service account (authorized per-call by the backend) ---
      {
        path: 'account/profile',
        data: { titleKey: 'nav.profile' },
        loadComponent: () =>
          import('./features/account/profile-page.component').then((m) => m.ProfilePageComponent),
      },
      {
        path: 'account/preferences',
        canDeactivate: [unsavedChangesGuard],
        data: { titleKey: 'nav.preferences' },
        loadComponent: () =>
          import('./features/account/preferences-page.component').then(
            (m) => m.PreferencesPageComponent,
          ),
      },
      {
        path: 'account/security',
        data: { titleKey: 'nav.security' },
        loadComponent: () =>
          import('./features/security/security-page.component').then(
            (m) => m.SecurityPageComponent,
          ),
      },
      {
        path: 'account/delegations',
        data: { titleKey: 'nav.delegations' },
        loadComponent: () =>
          import('./features/account/delegations-page.component').then(
            (m) => m.DelegationsPageComponent,
          ),
      },

      {
        path: 'forbidden',
        loadComponent: () =>
          import('./features/errors/forbidden.component').then((m) => m.ForbiddenComponent),
      },
      {
        path: '**',
        loadComponent: () =>
          import('./features/errors/not-found.component').then((m) => m.NotFoundComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

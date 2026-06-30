import { Permissions } from '../core/auth/permissions';
import { ICONS } from '../shared/icons';

/** A single navigable destination in the sidebar. */
export interface NavItem {
  /** Transloco key for the label. */
  labelKey: string;
  /** Router link (absolute, under the shell). */
  link: string;
  /** Inline SVG path (20×20, solid, `fill="currentColor"`). */
  icon: string;
  /**
   * Permission codes that reveal the item — the user needs **any** of them (super-admin always passes).
   * Omitted/empty means always visible (self-service areas the backend authorizes per call anyway).
   */
  permissions?: readonly string[];
}

/** A labelled group of {@link NavItem}s rendered under a section heading. */
export interface NavGroup {
  /** Transloco key for the section heading; omitted for the top (unlabelled) group. */
  labelKey?: string;
  items: readonly NavItem[];
}

/**
 * The full authenticated navigation, grouped by section. Items are filtered against the signed-in user's
 * permissions at render time (see {@link SidebarComponent}); the structure lives here so it stays
 * declarative and testable. Routes for features not yet built temporarily resolve to the coming-soon
 * placeholder (see app routes).
 */
export const NAV: readonly NavGroup[] = [
  {
    items: [{ labelKey: 'nav.dashboard', link: '/dashboard', icon: ICONS.dashboard }],
  },
  {
    labelKey: 'nav.manage',
    items: [
      {
        labelKey: 'nav.users',
        link: '/users',
        icon: ICONS.users,
        permissions: [Permissions.users.list],
      },
      {
        labelKey: 'nav.roles',
        link: '/roles',
        icon: ICONS.roles,
        permissions: [Permissions.roles.list],
      },
      {
        labelKey: 'nav.permissions',
        link: '/permissions',
        icon: ICONS.permissions,
        permissions: [Permissions.permissions.list],
      },
      {
        labelKey: 'nav.departments',
        link: '/departments',
        icon: ICONS.departments,
        permissions: [Permissions.departments.view],
      },
    ],
  },
  {
    labelKey: 'nav.administration',
    items: [
      {
        labelKey: 'nav.tenants',
        link: '/admin/tenants',
        icon: ICONS.tenants,
        permissions: [Permissions.tenants.list],
      },
      {
        labelKey: 'nav.ipFilters',
        link: '/admin/ip-filters',
        icon: ICONS.ipFilters,
        permissions: [Permissions.ipFilters.list],
      },
      {
        labelKey: 'nav.passwordPolicy',
        link: '/admin/password-policy',
        icon: ICONS.passwordPolicy,
        permissions: [Permissions.passwordPolicies.view],
      },
    ],
  },
  {
    labelKey: 'nav.account',
    items: [
      { labelKey: 'nav.profile', link: '/account/profile', icon: ICONS.profile },
      { labelKey: 'nav.preferences', link: '/account/preferences', icon: ICONS.preferences },
      { labelKey: 'nav.security', link: '/account/security', icon: ICONS.security },
      { labelKey: 'nav.delegations', link: '/account/delegations', icon: ICONS.delegations },
    ],
  },
];

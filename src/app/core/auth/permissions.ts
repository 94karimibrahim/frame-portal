/**
 * Canonical dotted permission codes, mirrored from the backend `PermissionNames` (module.action). Used
 * by route `canMatch` guards, the `*appHasPermission` directive, and menu gating so the UI never
 * hard-codes magic strings. The server remains the source of truth — these only drive what the UI
 * bothers to show.
 */
export const Permissions = {
  users: {
    create: 'users.create',
    update: 'users.update',
    delete: 'users.delete',
    bulkDelete: 'users.bulkdelete',
    view: 'users.view',
    list: 'users.list',
    export: 'users.export',
    activate: 'users.activate',
    assignRoles: 'users.assignroles',
    managePassword: 'users.managepassword',
  },
  roles: {
    create: 'roles.create',
    update: 'roles.update',
    delete: 'roles.delete',
    view: 'roles.view',
    list: 'roles.list',
    assign: 'roles.assign',
  },
  permissions: {
    list: 'permissions.list',
    view: 'permissions.view',
  },
  tenants: {
    create: 'tenants.create',
    update: 'tenants.update',
    delete: 'tenants.delete',
    view: 'tenants.view',
    list: 'tenants.list',
  },
  apiKeys: {
    create: 'apikeys.create',
    update: 'apikeys.update',
    delete: 'apikeys.delete',
    list: 'apikeys.list',
  },
  sessions: {
    list: 'sessions.list',
    revoke: 'sessions.delete',
  },
  departments: {
    create: 'departments.create',
    update: 'departments.update',
    delete: 'departments.delete',
    view: 'departments.view',
  },
  ipFilters: {
    create: 'ipfilters.create',
    delete: 'ipfilters.delete',
    list: 'ipfilters.list',
  },
  passwordPolicies: {
    upsert: 'passwordpolicies.upsert',
    view: 'passwordpolicies.view',
  },
} as const;

/** The well-known super-admin role name; bypasses every permission check on the backend. */
export const SUPER_ADMIN_ROLE = 'SuperAdmin';

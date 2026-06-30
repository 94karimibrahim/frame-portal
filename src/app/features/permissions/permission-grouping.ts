import { Permission } from '../../core/models';

/** A permission module and the permissions it contains, used by the catalogue page and the role editor. */
export interface PermissionGroup {
  module: string;
  items: Permission[];
}

/**
 * Groups a flat permission catalogue by `module`, sorting modules alphabetically and each module's
 * permissions by `code`. Pure so it's testable and reusable wherever the catalogue is displayed or picked.
 */
export function groupByModule(permissions: readonly Permission[]): PermissionGroup[] {
  const byModule = new Map<string, Permission[]>();
  for (const permission of permissions) {
    const bucket = byModule.get(permission.module);
    if (bucket) {
      bucket.push(permission);
    } else {
      byModule.set(permission.module, [permission]);
    }
  }
  return [...byModule.entries()]
    .map(([module, items]) => ({
      module,
      items: [...items].sort((a, b) => a.code.localeCompare(b.code)),
    }))
    .sort((a, b) => a.module.localeCompare(b.module));
}

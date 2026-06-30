import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { CellContext, injectFlexRenderContext } from '@tanstack/angular-table';
import { AuthService } from '../../../core/auth/auth.service';
import { Permissions } from '../../../core/auth/permissions';
import { TenantListItem } from '../../../core/models';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';

/** Callbacks the grid wires onto the tenant actions column via TanStack column `meta`. */
export interface TenantRowActions {
  edit(tenant: TenantListItem): void;
  remove(tenant: TenantListItem): void;
  switchTo(tenant: TenantListItem): void;
}

/**
 * Grid cell: switch-to (SuperAdmin only), edit, delete for a tenant. Switch is the cross-tenant
 * `auth/switch-tenant` action and is shown only to super-admins; edit/delete are permission-gated.
 */
@Component({
  selector: 'app-tenant-actions-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, HasPermissionDirective],
  template: `
    <div class="flex items-center justify-end gap-1">
      @if (auth.isSuperAdmin()) {
        <button
          type="button"
          class="rounded-theme-md px-2 py-1 text-theme-xs font-medium text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10"
          (click)="actions.switchTo(tenant)"
        >
          {{ 'admin.tenants.switch' | transloco }}
        </button>
      }
      <button
        *appHasPermission="perms.update"
        type="button"
        class="rounded-theme-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-500 dark:hover:bg-gray-800"
        [attr.aria-label]="'common.edit' | transloco"
        (click)="actions.edit(tenant)"
      >
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-8.5 8.5a2 2 0 0 1-.878.512l-3 .857a.75.75 0 0 1-.926-.926l.857-3a2 2 0 0 1 .512-.878l8.5-8.5Z"
          />
        </svg>
      </button>
      <button
        *appHasPermission="perms.delete"
        type="button"
        class="rounded-theme-md p-1.5 text-gray-400 hover:bg-error-50 hover:text-error-500 dark:hover:bg-error-500/10"
        [attr.aria-label]="'common.delete' | transloco"
        (click)="actions.remove(tenant)"
      >
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M8.75 1a1 1 0 0 0-.96.71L7.4 3H4a1 1 0 0 0 0 2h12a1 1 0 1 0 0-2h-3.4l-.39-1.29A1 1 0 0 0 11.25 1h-2.5ZM6 7a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Z"
          />
        </svg>
      </button>
    </div>
  `,
})
export class TenantActionsCellComponent {
  private readonly ctx = injectFlexRenderContext<CellContext<TenantListItem, unknown>>();
  protected readonly auth = inject(AuthService);
  protected readonly perms = Permissions.tenants;

  protected get tenant(): TenantListItem {
    return this.ctx.row.original;
  }
  protected get actions(): TenantRowActions {
    return (this.ctx.column.columnDef.meta as { actions: TenantRowActions }).actions;
  }
}

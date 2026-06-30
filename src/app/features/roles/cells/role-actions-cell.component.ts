import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { CellContext, injectFlexRenderContext } from '@tanstack/angular-table';
import { Permissions } from '../../../core/auth/permissions';
import { RoleListItem } from '../../../core/models';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';

/** Callbacks the grid wires onto the role actions column via TanStack column `meta`. */
export interface RoleRowActions {
  edit(role: RoleListItem): void;
  remove(role: RoleListItem): void;
}

/**
 * Grid cell: per-role edit / delete. Delete is hidden for system roles (the backend blocks deleting them),
 * and both are permission-gated. Handlers come from the column's `meta.actions`.
 */
@Component({
  selector: 'app-role-actions-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, HasPermissionDirective],
  template: `
    <div class="flex items-center justify-end gap-1">
      <button
        *appHasPermission="perms.update"
        type="button"
        class="rounded-theme-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-500 dark:hover:bg-gray-800"
        [attr.aria-label]="'common.edit' | transloco"
        [attr.title]="'common.edit' | transloco"
        (click)="actions.edit(role)"
      >
        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-8.5 8.5a2 2 0 0 1-.878.512l-3 .857a.75.75 0 0 1-.926-.926l.857-3a2 2 0 0 1 .512-.878l8.5-8.5Z"
          />
        </svg>
      </button>
      @if (!role.isSystem) {
        <button
          *appHasPermission="perms.delete"
          type="button"
          class="rounded-theme-md p-1.5 text-gray-400 hover:bg-error-50 hover:text-error-500 dark:hover:bg-error-500/10"
          [attr.aria-label]="'common.delete' | transloco"
          [attr.title]="'common.delete' | transloco"
          (click)="actions.remove(role)"
        >
          <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M8.75 1a1 1 0 0 0-.96.71L7.4 3H4a1 1 0 0 0 0 2h12a1 1 0 1 0 0-2h-3.4l-.39-1.29A1 1 0 0 0 11.25 1h-2.5ZM6 7a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Z"
            />
          </svg>
        </button>
      }
    </div>
  `,
})
export class RoleActionsCellComponent {
  private readonly ctx = injectFlexRenderContext<CellContext<RoleListItem, unknown>>();

  protected readonly perms = Permissions.roles;
  protected get role(): RoleListItem {
    return this.ctx.row.original;
  }
  protected get actions(): RoleRowActions {
    return (this.ctx.column.columnDef.meta as { actions: RoleRowActions }).actions;
  }
}

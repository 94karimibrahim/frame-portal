import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { CellContext, injectFlexRenderContext } from '@tanstack/angular-table';
import { AuthService } from '../../../core/auth/auth.service';
import { Permissions } from '../../../core/auth/permissions';
import { UserListItem } from '../../../core/models';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';

/** Callbacks the grid wires onto the actions column via TanStack column `meta` (see the users page). */
export interface UserRowActions {
  edit(user: UserListItem): void;
  manageRoles(user: UserListItem): void;
  unlock(user: UserListItem): void;
  resetPassword(user: UserListItem): void;
  remove(user: UserListItem): void;
}

/**
 * Grid cell: a single ⋯ button opening a labeled overflow menu (Edit / Manage roles / Unlock / Reset
 * password / Delete), each gated by the matching permission. Built on the CDK menu so it renders in an
 * overlay — it isn't clipped by the table's horizontal scroll container, and gets focus/keyboard/escape/
 * click-away handling for free. Destructive admin actions are disabled (with an explanatory tooltip) on
 * protected system accounts and on the caller's own account; the backend stays authoritative regardless.
 */
@Component({
  selector: 'app-user-actions-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, HasPermissionDirective, CdkMenuTrigger, CdkMenu, CdkMenuItem],
  template: `
    <div class="flex justify-end">
      <button
        type="button"
        class="rounded-theme-md p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        [cdkMenuTriggerFor]="menu"
        [attr.aria-label]="'common.actions' | transloco"
        [attr.title]="'common.actions' | transloco"
      >
        <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path
            d="M10 6a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm0 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm0 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
          />
        </svg>
      </button>
    </div>

    <ng-template #menu>
      <div
        cdkMenu
        class="min-w-56 rounded-theme-lg border border-gray-200 bg-white p-1 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        <button
          *appHasPermission="perms.update"
          cdkMenuItem
          type="button"
          [class]="itemClass"
          (cdkMenuItemTriggered)="actions.edit(user)"
        >
          <svg class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-8.5 8.5a2 2 0 0 1-.878.512l-3 .857a.75.75 0 0 1-.926-.926l.857-3a2 2 0 0 1 .512-.878l8.5-8.5Z"
            />
          </svg>
          {{ 'common.edit' | transloco }}
        </button>

        <button
          *appHasPermission="rolesAssign"
          cdkMenuItem
          type="button"
          [class]="itemClass"
          (cdkMenuItemTriggered)="actions.manageRoles(user)"
        >
          <svg class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-7 8a7 7 0 0 1 14 0 1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"
            />
          </svg>
          {{ 'users.manageRoles' | transloco }}
        </button>

        <!-- Only shown for accounts actually under a lockout (see UserListItem.isLockedOut). -->
        @if (user.isLockedOut) {
          <button
            *appHasPermission="perms.update"
            cdkMenuItem
            type="button"
            [class]="itemClass"
            [class.opacity-50]="guarded(user)"
            [class.cursor-not-allowed]="guarded(user)"
            [cdkMenuItemDisabled]="guarded(user)"
            [attr.title]="guardReason(user)"
            (cdkMenuItemTriggered)="actions.unlock(user)"
          >
            <svg
              class="h-4 w-4 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                d="M10 2a4 4 0 0 0-4 4v1H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H8V6a2 2 0 0 1 3.86-.75.75.75 0 1 0 1.38-.6A3.5 3.5 0 0 0 10 2Zm0 9a1 1 0 0 1 1 1v1.5a1 1 0 1 1-2 0V12a1 1 0 0 1 1-1Z"
              />
            </svg>
            {{ 'users.unlock' | transloco }}
          </button>
        }

        <button
          *appHasPermission="perms.managePassword"
          cdkMenuItem
          type="button"
          [class]="itemClass"
          [class.opacity-50]="guarded(user)"
          [class.cursor-not-allowed]="guarded(user)"
          [cdkMenuItemDisabled]="guarded(user)"
          [attr.title]="guardReason(user)"
          (cdkMenuItemTriggered)="actions.resetPassword(user)"
        >
          <svg class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M8 1a4 4 0 0 0-4 4v2H3.5A1.5 1.5 0 0 0 2 8.5v7A1.5 1.5 0 0 0 3.5 17h9a1.5 1.5 0 0 0 1.5-1.5V8.5A1.5 1.5 0 0 0 12.5 7H6V5a2 2 0 1 1 4 0 1 1 0 1 0 2 0 4 4 0 0 0-4-4Zm0 9a1.25 1.25 0 0 1 .75 2.25v1.25a.75.75 0 0 1-1.5 0V12.25A1.25 1.25 0 0 1 8 10Zm9.5-6.5a.75.75 0 0 1 1.28.53v2.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1-.53-1.28l.72-.72a3 3 0 0 0-4.74.43.75.75 0 1 1-1.27-.8 4.5 4.5 0 0 1 7.07-.84l.72-.72Z"
            />
          </svg>
          {{ 'users.resetPassword' | transloco }}
        </button>

        <div
          *appHasPermission="perms.delete"
          class="my-1 h-px bg-gray-100 dark:bg-gray-800"
          aria-hidden="true"
        ></div>

        <button
          *appHasPermission="perms.delete"
          cdkMenuItem
          type="button"
          [class]="dangerItemClass"
          [class.opacity-50]="guarded(user)"
          [class.cursor-not-allowed]="guarded(user)"
          [cdkMenuItemDisabled]="guarded(user)"
          [attr.title]="guardReason(user)"
          (cdkMenuItemTriggered)="actions.remove(user)"
        >
          <svg class="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M8.75 1a1 1 0 0 0-.96.71L7.4 3H4a1 1 0 0 0 0 2h12a1 1 0 1 0 0-2h-3.4l-.39-1.29A1 1 0 0 0 11.25 1h-2.5ZM6 7a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Z"
            />
          </svg>
          {{ 'common.delete' | transloco }}
        </button>
      </div>
    </ng-template>
  `,
})
export class UserActionsCellComponent {
  private readonly ctx = injectFlexRenderContext<CellContext<UserListItem, unknown>>();

  private readonly auth = inject(AuthService);
  private readonly i18n = inject(TranslocoService);

  protected readonly perms = Permissions.users;
  protected readonly rolesAssign = Permissions.roles.assign;

  /** Shared menu-item layout; the destructive item swaps in error tones. */
  protected readonly itemClass =
    'flex w-full items-center gap-2.5 rounded-theme-sm px-3 py-2 text-start text-theme-sm text-gray-700 outline-none hover:bg-gray-50 focus:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800 dark:focus:bg-gray-800';
  protected readonly dangerItemClass =
    'flex w-full items-center gap-2.5 rounded-theme-sm px-3 py-2 text-start text-theme-sm text-error-600 outline-none hover:bg-error-50 focus:bg-error-50 dark:text-error-500 dark:hover:bg-error-500/10 dark:focus:bg-error-500/10';

  protected get user(): UserListItem {
    return this.ctx.row.original;
  }

  /** True when the row is a protected system account or the caller's own account (admin actions blocked). */
  protected guarded(user: UserListItem): boolean {
    return user.isSystem || user.id === this.auth.identity()?.userId;
  }

  /** Tooltip explaining why a guarded action is disabled, or `null` when it is allowed. */
  protected guardReason(user: UserListItem): string | null {
    if (user.isSystem) {
      return this.i18n.translate('users.systemUserHint');
    }
    if (user.id === this.auth.identity()?.userId) {
      return this.i18n.translate('users.selfActionHint');
    }
    return null;
  }

  protected get actions(): UserRowActions {
    return (this.ctx.column.columnDef.meta as { actions: UserRowActions }).actions;
  }
}

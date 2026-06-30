import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { CellContext, injectFlexRenderContext } from '@tanstack/angular-table';
import { UserListItem } from '../../../core/models';
import { BadgeComponent } from '../../../shared/ui/badge.component';
import { initials } from '../../account/initials.util';

/** Grid cell: an initials avatar beside the user's stacked name + email, with a System badge. Rendered via `flexRenderComponent`. */
@Component({
  selector: 'app-user-name-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, BadgeComponent],
  template: `
    <div class="flex items-center gap-3">
      <span
        class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-theme-xs font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
        aria-hidden="true"
      >
        {{ avatar }}
      </span>
      <span class="min-w-0">
        <span class="flex items-center gap-2">
          <span class="truncate font-medium text-gray-800 dark:text-gray-100">{{
            user.fullName
          }}</span>
          @if (user.isSystem) {
            <app-badge variant="info">{{ 'users.systemUser' | transloco }}</app-badge>
          }
        </span>
        <span class="block truncate text-theme-xs text-gray-500 dark:text-gray-400">{{
          user.email
        }}</span>
      </span>
    </div>
  `,
})
export class UserNameCellComponent {
  private readonly ctx = injectFlexRenderContext<CellContext<UserListItem, unknown>>();

  protected get user(): UserListItem {
    return this.ctx.row.original;
  }

  protected get avatar(): string {
    return initials(this.user.fullName);
  }
}

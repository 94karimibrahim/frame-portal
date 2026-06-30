import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { CellContext, injectFlexRenderContext } from '@tanstack/angular-table';
import { USER_STATUS_LABEL, UserListItem } from '../../../core/models';
import { BadgeComponent } from '../../../shared/ui/badge.component';
import { userStatusVariant } from '../user-status.util';

/** Grid cell: renders a user's status as a coloured {@link BadgeComponent}. Rendered via `flexRenderComponent`. */
@Component({
  selector: 'app-user-status-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, BadgeComponent],
  template: `<app-badge [variant]="variant">
    <span class="h-1.5 w-1.5 rounded-full bg-current opacity-80" aria-hidden="true"></span>
    {{ label | transloco }}
  </app-badge>`,
})
export class UserStatusCellComponent {
  private readonly ctx = injectFlexRenderContext<CellContext<UserListItem, unknown>>();

  protected readonly variant = userStatusVariant(this.ctx.row.original.status);
  protected readonly label = USER_STATUS_LABEL[this.ctx.row.original.status];
}

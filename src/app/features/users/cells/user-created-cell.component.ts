import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CellContext, injectFlexRenderContext } from '@tanstack/angular-table';
import { LocaleService } from '../../../core/i18n/locale.service';
import { UserListItem } from '../../../core/models';
import { relativeDate } from '../../../shared/util/relative-time';

/**
 * Grid cell for the Created column: the relative phrase ("2 days ago") as the primary, scannable value,
 * with the original absolute date beneath it muted — and the full localized timestamp on hover. Both forms
 * localize (en/ar) via {@link LocaleService.culture}. Rendered via `flexRenderComponent`.
 */
@Component({
  selector: 'app-user-created-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="block" [attr.title]="exact">{{ relative }}</span>
    <span class="block text-theme-xs text-gray-400 dark:text-gray-500">{{ absolute }}</span>
  `,
})
export class UserCreatedCellComponent {
  private readonly ctx = injectFlexRenderContext<CellContext<UserListItem, unknown>>();
  private readonly locale = inject(LocaleService);

  private get value(): string {
    return this.ctx.row.original.createdAt;
  }

  /** Relative phrase: Today / Yesterday / N days ago, falling back to an absolute date when older. */
  protected get relative(): string {
    return relativeDate(this.value, this.locale.culture());
  }

  /** The original date, always shown so the exact day is never hidden behind the relative phrase. */
  protected get absolute(): string {
    return new Date(this.value).toLocaleDateString(this.locale.culture(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /** Full localized date + time, surfaced on hover. */
  protected get exact(): string {
    return new Date(this.value).toLocaleString(this.locale.culture());
  }
}

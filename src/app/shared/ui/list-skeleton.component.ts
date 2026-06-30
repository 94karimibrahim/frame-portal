import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { SkeletonComponent } from './skeleton.component';

/**
 * Loading placeholder for the divided two-line list rows used by the IP-filters and delegations pages
 * (`<ul class="divide-y …">` of a title + subtitle, with an optional trailing action). Mirrors their
 * `px-2 py-3` row rhythm so swapping it in while a page loads causes no layout shift. Drop it straight into
 * the host's loading branch (the host already supplies the surrounding card):
 *
 * ```html
 * @if (loading()) { <app-list-skeleton [rows]="5" /> } @else { … }
 * ```
 *
 * `aria-busy` + a hidden status label announce the load; the bars themselves are decorative.
 */
@Component({
  selector: 'app-list-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, SkeletonComponent],
  template: `
    <ul
      class="divide-y divide-gray-100 dark:divide-gray-800"
      aria-busy="true"
      [attr.aria-label]="'common.loading' | transloco"
    >
      @for (row of rowSpan(); track $index) {
        <li class="flex items-center justify-between gap-4 px-2 py-3">
          <div class="min-w-0 flex-1">
            <app-skeleton class="h-4 w-48 max-w-full" />
            <app-skeleton class="mt-2 h-3 w-32 max-w-full" />
          </div>
          @if (withAction()) {
            <app-skeleton class="h-8 w-16 shrink-0 rounded-theme-md" />
          }
        </li>
      }
    </ul>
  `,
})
export class ListSkeletonComponent {
  /** Number of placeholder rows (default 5). */
  readonly rows = input(5);
  /** Render a trailing action placeholder (e.g. a Delete/Revoke button). Default true. */
  readonly withAction = input(true);

  protected readonly rowSpan = computed(() => Array.from({ length: Math.max(1, this.rows()) }));
}

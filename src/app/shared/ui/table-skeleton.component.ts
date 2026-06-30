import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { SkeletonComponent } from './skeleton.component';

/**
 * Loading placeholder for {@link DataTableComponent}. Mirrors the grid's header + row rhythm (`px-4`,
 * `py-3.5`/`py-3`) and column count so swapping it in for the real table while a page loads causes no layout
 * shift. Drives the host's loading branch instead of a centered spinner:
 *
 * ```html
 * @if (loading()) { <app-table-skeleton [rows]="8" [cols]="columns.length" /> } @else { … }
 * ```
 *
 * `aria-busy` + a visually-hidden status label announce the load to assistive tech; the bars are decorative.
 */
@Component({
  selector: 'app-table-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, SkeletonComponent],
  template: `
    <div class="overflow-x-auto" aria-busy="true" [attr.aria-label]="'common.loading' | transloco">
      <table class="w-full min-w-[40rem] border-collapse">
        <thead class="bg-gray-50 dark:bg-white/[0.02]">
          <tr class="border-b border-gray-200 dark:border-gray-800">
            @for (col of colSpan(); track $index) {
              <th class="px-4 py-3.5 text-start">
                <app-skeleton class="h-3 w-20" />
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rowSpan(); track $index) {
            <tr class="border-b border-gray-100 dark:border-gray-800/60">
              @for (col of colSpan(); track $index) {
                <td class="px-4 py-3">
                  <app-skeleton [class]="$first ? 'h-4 w-40' : 'h-4 w-24'" />
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class TableSkeletonComponent {
  /** Number of placeholder rows to render (default 6). */
  readonly rows = input(6);
  /** Number of placeholder columns; match the real table's column count to avoid layout shift. */
  readonly cols = input(4);

  protected readonly rowSpan = computed(() => Array.from({ length: Math.max(1, this.rows()) }));
  protected readonly colSpan = computed(() => Array.from({ length: Math.max(1, this.cols()) }));
}

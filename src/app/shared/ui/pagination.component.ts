import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Server-side pagination control: shows the current range out of the total and Previous/Next buttons.
 * Page numbering is 1-based to mirror the API. Purely presentational — it reports the requested page via
 * {@link pageChange}; the host owns the data fetch. Chevrons mirror under RTL via the `rtl:` variant.
 */
@Component({
  selector: 'app-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
  template: `
    <div class="flex items-center justify-between gap-4 px-1 py-2">
      <p class="text-theme-xs text-gray-500 dark:text-gray-400">
        {{ 'pagination.range' | transloco: { from: from(), to: to(), total: totalCount() } }}
      </p>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn btn-secondary px-3 py-1.5"
          [disabled]="!hasPrevious()"
          (click)="pageChange.emit(pageNumber() - 1)"
        >
          <svg
            class="h-4 w-4 rtl:-scale-x-100"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M12.79 5.23a.75.75 0 0 1-.02 1.06L8.832 10l3.938 3.71a.75.75 0 1 1-1.04 1.08l-4.5-4.25a.75.75 0 0 1 0-1.08l4.5-4.25a.75.75 0 0 1 1.06.02Z"
            />
          </svg>
          {{ 'common.previous' | transloco }}
        </button>
        <button
          type="button"
          class="btn btn-secondary px-3 py-1.5"
          [disabled]="!hasNext()"
          (click)="pageChange.emit(pageNumber() + 1)"
        >
          {{ 'common.next' | transloco }}
          <svg
            class="h-4 w-4 rtl:-scale-x-100"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
            />
          </svg>
        </button>
      </div>
    </div>
  `,
})
export class PaginationComponent {
  readonly pageNumber = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly totalCount = input.required<number>();
  readonly hasPrevious = input.required<boolean>();
  readonly hasNext = input.required<boolean>();

  readonly pageChange = output<number>();

  protected readonly from = computed(() =>
    this.totalCount() === 0 ? 0 : (this.pageNumber() - 1) * this.pageSize() + 1,
  );
  protected readonly to = computed(() =>
    Math.min(this.pageNumber() * this.pageSize(), this.totalCount()),
  );
}

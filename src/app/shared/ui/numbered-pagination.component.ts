import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';

/** A page-number entry; `null` marks an elided gap (ellipsis). */
type PageEntry = number | null;

/**
 * Server-side pagination with **numbered pages + a rows-per-page selector** (TailAdmin style). Page numbers
 * are 1-based to mirror the API; large page counts collapse to first/last + a window around the current page
 * with ellipses. Purely presentational — it reports the requested page/size via {@link pageChange} /
 * {@link pageSizeChange}; the host owns the fetch. Chevrons mirror under RTL via the `rtl:` variant.
 */
@Component({
  selector: 'app-numbered-pagination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
  template: `
    <div class="flex flex-wrap items-center justify-between gap-3 px-1 py-2">
      <div class="flex items-center gap-2 text-theme-xs text-gray-500 dark:text-gray-400">
        <label [attr.for]="'rows-per-page'">{{ 'pagination.rows' | transloco }}</label>
        <select
          id="rows-per-page"
          class="form-input w-auto! py-1! text-theme-xs!"
          [value]="pageSize()"
          (change)="onSize($event)"
        >
          @for (n of pageSizeOptions(); track n) {
            <option [value]="n" [selected]="n === pageSize()">{{ n }}</option>
          }
        </select>
        <span class="ms-1 tabular-nums">
          {{ 'pagination.range' | transloco: { from: from(), to: to(), total: totalCount() } }}
        </span>
      </div>

      <div class="flex items-center gap-1">
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-theme-md text-gray-500 transition hover:bg-gray-100 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-800"
          [disabled]="pageNumber() <= 1"
          [attr.aria-label]="'common.previous' | transloco"
          (click)="go(pageNumber() - 1)"
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
        </button>

        @for (p of windowed(); track $index) {
          @if (p === null) {
            <span class="px-2 text-gray-400">…</span>
          } @else {
            <button
              type="button"
              class="flex h-9 min-w-9 items-center justify-center rounded-theme-md px-2 text-theme-sm font-medium transition"
              [class]="
                p === pageNumber()
                  ? 'bg-brand-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              "
              [attr.aria-current]="p === pageNumber() ? 'page' : null"
              (click)="go(p)"
            >
              {{ p }}
            </button>
          }
        }

        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-theme-md text-gray-500 transition hover:bg-gray-100 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-800"
          [disabled]="pageNumber() >= pageCount()"
          [attr.aria-label]="'common.next' | transloco"
          (click)="go(pageNumber() + 1)"
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
              d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
            />
          </svg>
        </button>
      </div>
    </div>
  `,
})
export class NumberedPaginationComponent {
  readonly pageNumber = input.required<number>();
  readonly pageSize = input.required<number>();
  readonly totalCount = input.required<number>();
  readonly pageSizeOptions = input<number[]>([10, 20, 50]);

  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.totalCount() / this.pageSize())),
  );
  protected readonly from = computed(() =>
    this.totalCount() === 0 ? 0 : (this.pageNumber() - 1) * this.pageSize() + 1,
  );
  protected readonly to = computed(() =>
    Math.min(this.pageNumber() * this.pageSize(), this.totalCount()),
  );

  /** First/last + a window of ±1 around the current page, with `null` ellipsis markers for large counts. */
  protected readonly windowed = computed<PageEntry[]>(() => {
    const count = this.pageCount();
    const page = this.pageNumber();
    if (count <= 7) {
      return Array.from({ length: count }, (_, i) => i + 1);
    }
    const out: PageEntry[] = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(count - 1, page + 1);
    if (start > 2) {
      out.push(null);
    }
    for (let i = start; i <= end; i++) {
      out.push(i);
    }
    if (end < count - 1) {
      out.push(null);
    }
    out.push(count);
    return out;
  });

  protected go(p: number): void {
    if (p >= 1 && p <= this.pageCount() && p !== this.pageNumber()) {
      this.pageChange.emit(p);
    }
  }

  protected onSize(event: Event): void {
    this.pageSizeChange.emit(Number((event.target as HTMLSelectElement).value));
  }
}

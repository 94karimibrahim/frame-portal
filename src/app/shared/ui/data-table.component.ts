import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { TranslocoModule } from '@jsverse/transloco';
import {
  ColumnDef,
  Column,
  FlexRenderDirective,
  Row,
  RowSelectionState,
  VisibilityState,
  createAngularTable,
  getCoreRowModel,
} from '@tanstack/angular-table';

/**
 * Headless, Tailwind-styled data grid (the project's single grid solution per FRONTEND_PLAN §12). Wraps
 * TanStack Table: the host supplies typed `columns` (TanStack `ColumnDef`s — custom cells render via
 * `flexRenderComponent`) and the current page of `data`. Paging/sorting/filtering are **server-side**
 * (`manualPagination`/`manualSorting`), so this component only renders the rows it's given; the host owns
 * fetching and the {@link PaginationComponent}. Loading and empty states are the host's concern too.
 *
 * Two opt-in "power" capabilities, both off by default so existing call sites are untouched:
 *  - **Row selection** (`selectable`): a leading checkbox column with select-all-on-page, emitting the
 *    selected original rows via {@link selectionChange}. Selection is **per current view** — it resets
 *    whenever `data` changes (new page/filter), which is the only honest model for a server-paged grid.
 *  - **Column visibility** (`enableColumnVisibility`): a "Columns" menu toggling hideable columns, with the
 *    choice optionally persisted to `localStorage` under `storageKey`. Column labels come from each
 *    column's `meta.label` (a Transloco key); set `enableHiding: false` to pin a column (e.g. row actions).
 *
 * Generic over the row type; callers pass `ColumnDef<TRow>[]`. The table object returned by
 * `createAngularTable` is itself a signal, so reading it in the template stays reactive to `data` changes.
 */
@Component({
  selector: 'app-data-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FlexRenderDirective, TranslocoModule, CdkTrapFocus],
  template: `
    @if (enableColumnVisibility()) {
      <div
        class="flex items-center justify-end border-b border-gray-100 px-3 py-2 dark:border-gray-800/60"
      >
        <div class="relative">
          <button
            type="button"
            class="btn btn-secondary px-3 py-1.5"
            [attr.aria-expanded]="columnsMenuOpen()"
            aria-haspopup="menu"
            (click)="columnsMenuOpen.set(!columnsMenuOpen())"
          >
            <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                d="M3 4.5A1.5 1.5 0 0 1 4.5 3h11A1.5 1.5 0 0 1 17 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-11ZM8 4.5v11h1.5v-11H8Zm3 0v11h1.5v-11H11Z"
              />
            </svg>
            {{ 'table.columns' | transloco }}
          </button>

          @if (columnsMenuOpen()) {
            <button
              type="button"
              class="fixed inset-0 z-40 cursor-default"
              tabindex="-1"
              [attr.aria-label]="'common.close' | transloco"
              (click)="columnsMenuOpen.set(false)"
            ></button>
            <div
              role="menu"
              tabindex="-1"
              cdkTrapFocus
              [cdkTrapFocusAutoCapture]="true"
              class="absolute inset-e-0 z-50 mt-2 w-56 rounded-theme-lg border border-gray-200 bg-white p-1.5 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
              (keydown.escape)="columnsMenuOpen.set(false)"
            >
              @for (col of hideableColumns(); track col.id) {
                <label
                  class="flex cursor-pointer items-center gap-2.5 rounded-theme-sm px-3 py-2 text-theme-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded-sm border-gray-300 text-brand-500"
                    [checked]="col.getIsVisible()"
                    (change)="col.toggleVisibility(isChecked($event))"
                  />
                  {{ columnLabel(col) | transloco }}
                </label>
              }
            </div>
          }
        </div>
      </div>
    }

    <div class="overflow-x-auto">
      <table class="w-full min-w-160 border-collapse text-start">
        <thead class="bg-gray-50 dark:bg-white/2">
          @for (headerGroup of table.getHeaderGroups(); track headerGroup.id) {
            <tr class="border-b border-gray-200 dark:border-gray-800">
              @if (selectable()) {
                <th class="w-10 py-3.5 ps-6 pe-4 text-start">
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded-sm border-gray-300 text-brand-500"
                    [checked]="table.getIsAllPageRowsSelected()"
                    [indeterminate]="table.getIsSomePageRowsSelected()"
                    [attr.aria-label]="'table.selectAll' | transloco"
                    (change)="table.toggleAllPageRowsSelected(isChecked($event))"
                  />
                </th>
              }
              @for (header of headerGroup.headers; track header.id) {
                <th
                  class="px-4 py-3.5 text-start text-theme-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-300"
                  [style.width]="header.getSize() ? header.getSize() + 'px' : null"
                >
                  @if (!header.isPlaceholder) {
                    <ng-container
                      *flexRender="
                        header.column.columnDef.header;
                        props: header.getContext();
                        let label
                      "
                    >
                      {{ label }}
                    </ng-container>
                  }
                </th>
              }
            </tr>
          }
        </thead>
        <tbody>
          @for (row of table.getRowModel().rows; track row.id) {
            <tr
              [class]="rowClass(row)"
              [class.cursor-pointer]="clickable()"
              [attr.role]="clickable() ? 'button' : null"
              [attr.tabindex]="clickable() ? 0 : null"
              (click)="onRowClick($event, row.original)"
              (keydown.enter)="onRowKeyActivate($event, row.original)"
              (keydown.space)="onRowKeyActivate($event, row.original)"
            >
              @if (selectable()) {
                <td class="py-3 ps-6 pe-4" (click)="$event.stopPropagation()">
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded-sm border-gray-300 text-brand-500 disabled:opacity-40"
                    [checked]="row.getIsSelected()"
                    [disabled]="!row.getCanSelect()"
                    [attr.aria-label]="'table.selectRow' | transloco"
                    (change)="row.toggleSelected(isChecked($event))"
                  />
                </td>
              }
              @for (cell of row.getVisibleCells(); track cell.id) {
                <td class="px-4 py-3 text-theme-sm text-gray-700 dark:text-gray-200">
                  <ng-container
                    *flexRender="cell.column.columnDef.cell; props: cell.getContext(); let value"
                  >
                    {{ value }}
                  </ng-container>
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
})
export class DataTableComponent<TRow> {
  readonly columns = input.required<ColumnDef<TRow, unknown>[]>();
  readonly data = input.required<TRow[]>();
  /** When true, rows are focusable/clickable and emit {@link rowClick}. Cells that own controls should stop propagation. */
  readonly clickable = input(false);
  /** Emits the clicked row's original data (only when {@link clickable} is set). */
  readonly rowClick = output<TRow>();

  /** Opt into a leading selection checkbox column; emits selected rows via {@link selectionChange}. */
  readonly selectable = input(false);
  /** Stable row identity for selection (defaults to row index); pass e.g. `(u) => u.id`. */
  readonly rowId = input<((row: TRow) => string) | undefined>(undefined);
  /** Gate which rows may be selected (defaults to all); e.g. exclude protected rows. */
  readonly rowSelectable = input<((row: TRow) => boolean) | undefined>(undefined);
  /** Selected original rows for the current view; re-emits (as `[]`) whenever `data` changes. */
  readonly selectionChange = output<TRow[]>();

  /** Opt into the "Columns" show/hide menu. Columns with `enableHiding: false` stay pinned. */
  readonly enableColumnVisibility = input(false);
  /** When set, persist the visibility choice to `localStorage` under this key so it survives reloads. */
  readonly storageKey = input<string | undefined>(undefined);

  protected readonly columnsMenuOpen = signal(false);

  /** Selection state, reset to empty whenever `data` changes — selection is per current page/view. */
  private readonly rowSelection = linkedSignal<TRow[], RowSelectionState>({
    source: this.data,
    computation: () => ({}),
  });

  /** Visibility state, seeded once from `localStorage` (if `storageKey` is set). */
  private readonly columnVisibility = linkedSignal<string | undefined, VisibilityState>({
    source: this.storageKey,
    computation: (key) => this.readVisibility(key),
  });

  protected readonly table = createAngularTable(() => ({
    data: this.data(),
    columns: this.columns(),
    state: {
      rowSelection: this.rowSelection(),
      columnVisibility: this.columnVisibility(),
    },
    enableRowSelection: this.selectable()
      ? (row: Row<TRow>) => this.rowSelectable()?.(row.original) ?? true
      : false,
    onRowSelectionChange: (updater) =>
      this.rowSelection.set(typeof updater === 'function' ? updater(this.rowSelection()) : updater),
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === 'function' ? updater(this.columnVisibility()) : updater;
      this.columnVisibility.set(next);
      this.writeVisibility(next);
    },
    getRowId: this.rowId(),
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
  }));

  constructor() {
    // Keep the host in sync with the current selection (and clear it when the view resets).
    effect(() => {
      this.rowSelection(); // track changes
      if (this.selectable()) {
        this.selectionChange.emit(this.table.getSelectedRowModel().rows.map((r) => r.original));
      }
    });
  }

  /** Leaf columns the user is allowed to hide (drives the Columns menu). */
  protected hideableColumns(): Column<TRow, unknown>[] {
    return this.table.getAllLeafColumns().filter((c) => c.getCanHide());
  }

  /** A column's Transloco label key from `meta.label`, falling back to its id. */
  protected columnLabel(column: Column<TRow, unknown>): string {
    return (column.columnDef.meta as { label?: string } | undefined)?.label ?? column.id;
  }

  /** Row styling, including the selected-row tint. */
  protected rowClass(row: Row<TRow>): string {
    const base = 'border-b border-gray-100 transition dark:border-gray-800/60';
    return row.getIsSelected()
      ? `${base} bg-brand-50/60 dark:bg-brand-500/6`
      : `${base} hover:bg-gray-100 dark:hover:bg-white/5`;
  }

  /** Narrow a change event to the checkbox's checked state. */
  protected isChecked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  /** Emit a row click, but ignore clicks that land on an interactive control inside the row (e.g. action buttons). */
  protected onRowClick(event: Event, row: TRow): void {
    if (!this.clickable()) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, select, textarea, label')) {
      return;
    }
    this.rowClick.emit(row);
  }

  /** Activate a focused row via Enter/Space without scrolling the page. */
  protected onRowKeyActivate(event: Event, row: TRow): void {
    if (this.clickable()) {
      event.preventDefault();
      this.rowClick.emit(row);
    }
  }

  private storageId(key: string): string {
    return `dt:visibility:${key}`;
  }

  private readVisibility(key: string | undefined): VisibilityState {
    if (!key) {
      return {};
    }
    try {
      const raw = localStorage.getItem(this.storageId(key));
      return raw ? (JSON.parse(raw) as VisibilityState) : {};
    } catch {
      return {};
    }
  }

  private writeVisibility(state: VisibilityState): void {
    const key = this.storageKey();
    if (!key) {
      return;
    }
    try {
      localStorage.setItem(this.storageId(key), JSON.stringify(state));
    } catch {
      // Storage unavailable (private mode / quota) — visibility simply won't persist.
    }
  }
}

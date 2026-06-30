import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ColumnDef, flexRenderComponent } from '@tanstack/angular-table';
import { catchError, debounceTime, distinctUntilChanged, forkJoin, map, of } from 'rxjs';
import { Permissions } from '../../core/auth/permissions';
import { AppError, PagedResult, RoleListItem } from '../../core/models';
import { NotificationService } from '../../core/notifications/notification.service';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { CardComponent } from '../../shared/ui/card.component';
import { DataTableComponent } from '../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { PaginationComponent } from '../../shared/ui/pagination.component';
import { SpinnerComponent } from '../../shared/ui/spinner.component';
import { TableSkeletonComponent } from '../../shared/ui/table-skeleton.component';
import { CsvColumn, downloadCsv, exportDateStamp, toCsv } from '../../shared/util/csv';
import { RoleActionsCellComponent, RoleRowActions } from './cells/role-actions-cell.component';
import { RoleNameCellComponent } from './cells/role-name-cell.component';
import { RoleDialogInput, RoleFormDialogComponent } from './role-form-dialog.component';
import { RoleService } from './role.service';

const PAGE_SIZE = 20;

/**
 * Roles management page (FRONTEND_PLAN §2.8): server-searched + paged grid via the shared
 * {@link DataTableComponent}, with the create/edit editor and a delete confirmation. System roles can't be
 * deleted (the action is hidden) and the backend enforces it regardless.
 */
@Component({
  selector: 'app-roles-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslocoModule,
    HasPermissionDirective,
    PageHeaderComponent,
    CardComponent,
    DataTableComponent,
    PaginationComponent,
    SpinnerComponent,
    TableSkeletonComponent,
    EmptyStateComponent,
    ModalComponent,
    RoleFormDialogComponent,
  ],
  template: `
    <app-page-header [title]="'roles.title' | transloco" [subtitle]="'roles.subtitle' | transloco">
      <div actions>
        <button
          *appHasPermission="perms.create"
          type="button"
          class="btn btn-primary"
          (click)="openCreate()"
        >
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M10 5a.75.75 0 0 1 .75.75v3.5h3.5a.75.75 0 0 1 0 1.5h-3.5v3.5a.75.75 0 0 1-1.5 0v-3.5h-3.5a.75.75 0 0 1 0-1.5h3.5v-3.5A.75.75 0 0 1 10 5Z"
            />
          </svg>
          {{ 'roles.new' | transloco }}
        </button>
      </div>
    </app-page-header>

    <app-card [padding]="false">
      <div class="border-b border-gray-100 p-4 dark:border-gray-800">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="w-full max-w-sm">
            <label class="sr-only" for="role-search">{{ 'common.search' | transloco }}</label>
            <input
              id="role-search"
              type="search"
              [formControl]="search"
              [placeholder]="'roles.searchPlaceholder' | transloco"
              class="form-input"
            />
          </div>
          <button
            type="button"
            class="btn btn-secondary px-3 py-1.5"
            [disabled]="exporting() || totalCount() === 0"
            (click)="exportAll()"
          >
            @if (exporting()) {
              <app-spinner size="sm" />
            } @else {
              <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  d="M10 2.75a.75.75 0 0 1 .75.75v6.69l1.97-1.97a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L6.22 9.28a.75.75 0 1 1 1.06-1.06l1.97 1.97V3.5A.75.75 0 0 1 10 2.75Z"
                />
                <path
                  d="M3.5 12.75a.75.75 0 0 1 .75.75v1.25c0 .69.56 1.25 1.25 1.25h9c.69 0 1.25-.56 1.25-1.25V13.5a.75.75 0 0 1 1.5 0v1.25A2.75 2.75 0 0 1 14.5 17.5h-9a2.75 2.75 0 0 1-2.75-2.75V13.5a.75.75 0 0 1 .75-.75Z"
                />
              </svg>
            }
            {{ 'table.export' | transloco }}
          </button>
        </div>
      </div>

      <!-- Bulk action bar — appears when rows are selected -->
      @if (selected().length > 0) {
        <div
          class="flex flex-wrap items-center gap-3 border-b border-gray-100 bg-brand-50/60 px-4 py-2.5 dark:border-gray-800 dark:bg-brand-500/10"
        >
          <span class="text-theme-sm font-medium text-gray-700 dark:text-gray-200">
            {{ 'table.selectedCount' | transloco: { count: selected().length } }}
          </span>
          <div class="ms-auto flex items-center gap-2">
            <button type="button" class="btn btn-secondary px-3 py-1.5" (click)="exportSelected()">
              {{ 'table.exportSelected' | transloco }}
            </button>
            <button
              *appHasPermission="perms.delete"
              type="button"
              class="btn btn-danger px-3 py-1.5 disabled:opacity-50"
              [disabled]="deletableSelected().length === 0"
              (click)="askBulkDelete()"
            >
              {{ 'table.deleteSelected' | transloco: { count: deletableSelected().length } }}
            </button>
          </div>
        </div>
      }

      @if (loading()) {
        <app-table-skeleton [rows]="8" [cols]="columns.length + 1" />
      } @else if (loadError()) {
        <app-empty-state [title]="'roles.loadError' | transloco">
          <button type="button" class="btn btn-secondary" (click)="load()">
            {{ 'common.retry' | transloco }}
          </button>
        </app-empty-state>
      } @else if (rows().length === 0) {
        <app-empty-state
          [title]="'roles.empty' | transloco"
          [description]="(search.value ? 'roles.emptySearchHint' : 'roles.emptyHint') | transloco"
        />
      } @else {
        <app-data-table
          [columns]="columns"
          [data]="rows()"
          [selectable]="true"
          [rowId]="roleRowId"
          [enableColumnVisibility]="true"
          storageKey="roles"
          (selectionChange)="selected.set($event)"
        />
        <div class="border-t border-gray-100 px-3 dark:border-gray-800/60">
          <app-pagination
            [pageNumber]="pageNumber()"
            [pageSize]="pageSize"
            [totalCount]="totalCount()"
            [hasPrevious]="result()!.hasPreviousPage"
            [hasNext]="result()!.hasNextPage"
            (pageChange)="goToPage($event)"
          />
        </div>
      }
    </app-card>

    @if (dialog(); as input) {
      <app-role-form-dialog [data]="input" (saved)="onSaved(input.mode)" (closed)="closeDialog()" />
    }

    @if (pendingDelete(); as target) {
      <app-modal
        [title]="'roles.deleteTitle' | transloco"
        widthClass="max-w-md"
        (closed)="closeDelete()"
      >
        <p class="text-theme-sm text-gray-600 dark:text-gray-300">
          {{ 'roles.deleteConfirm' | transloco: { name: target.name } }}
        </p>
        <div modalFooter class="flex items-center justify-end gap-3">
          <button
            type="button"
            class="btn btn-secondary"
            (click)="closeDelete()"
            [disabled]="deleting()"
          >
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            type="button"
            class="btn btn-danger"
            (click)="confirmDelete()"
            [disabled]="deleting()"
          >
            @if (deleting()) {
              <app-spinner size="sm" />
            }
            {{ 'common.delete' | transloco }}
          </button>
        </div>
      </app-modal>
    }

    @if (pendingBulkDelete()) {
      <app-modal
        [title]="'roles.bulkDeleteTitle' | transloco"
        widthClass="max-w-md"
        (closed)="closeBulkDelete()"
      >
        <p class="text-theme-sm text-gray-600 dark:text-gray-300">
          {{ 'roles.bulkDeleteConfirm' | transloco: { count: deletableSelected().length } }}
        </p>
        @if (selected().length !== deletableSelected().length) {
          <p class="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
            {{
              'roles.bulkDeleteSkipped'
                | transloco: { count: selected().length - deletableSelected().length }
            }}
          </p>
        }
        <div modalFooter class="flex items-center justify-end gap-3">
          <button
            type="button"
            class="btn btn-secondary"
            (click)="closeBulkDelete()"
            [disabled]="bulkDeleting()"
          >
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            type="button"
            class="btn btn-danger"
            (click)="confirmBulkDelete()"
            [disabled]="bulkDeleting()"
          >
            @if (bulkDeleting()) {
              <app-spinner size="sm" />
            }
            {{ 'common.delete' | transloco }}
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class RolesPageComponent {
  private readonly service = inject(RoleService);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(TranslocoService);
  protected readonly perms = Permissions.roles;
  protected readonly pageSize = PAGE_SIZE;

  protected readonly search = new FormControl('', { nonNullable: true });

  protected readonly result = signal<PagedResult<RoleListItem> | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly pageNumber = signal(1);

  protected readonly rows = computed(() => this.result()?.items ?? []);
  protected readonly totalCount = computed(() => this.result()?.totalCount ?? 0);

  protected readonly dialog = signal<RoleDialogInput | null>(null);
  protected readonly pendingDelete = signal<{ id: string; name: string } | null>(null);
  protected readonly deleting = signal(false);

  private readonly rowActions: RoleRowActions = {
    edit: (role) => this.openEdit(role),
    remove: (role) => this.askDelete(role),
  };

  protected readonly columns: ColumnDef<RoleListItem, unknown>[] = [
    {
      id: 'name',
      header: () => this.i18n.translate('roles.name'),
      meta: { label: 'roles.name' },
      cell: () => flexRenderComponent(RoleNameCellComponent),
    },
    {
      accessorKey: 'hierarchy',
      header: () => this.i18n.translate('roles.hierarchy'),
      meta: { label: 'roles.hierarchy' },
    },
    {
      id: 'description',
      header: () => this.i18n.translate('roles.description'),
      meta: { label: 'roles.description' },
      accessorFn: (row) => row.description || '—',
    },
    {
      id: 'actions',
      header: () => '',
      enableHiding: false,
      meta: { actions: this.rowActions },
      cell: () => flexRenderComponent(RoleActionsCellComponent),
    },
  ];

  /** Stable selection identity + the CSV shape (decoupled from how cells render on screen). */
  protected readonly roleRowId = (r: RoleListItem) => r.id;
  private exportColumns(): CsvColumn<RoleListItem>[] {
    return [
      { header: this.i18n.translate('roles.name'), value: (r) => r.name },
      { header: this.i18n.translate('roles.hierarchy'), value: (r) => r.hierarchy },
      { header: this.i18n.translate('roles.description'), value: (r) => r.description ?? '' },
    ];
  }

  /** Selection (current view) + bulk-operation state. */
  protected readonly selected = signal<RoleListItem[]>([]);
  protected readonly exporting = signal(false);
  protected readonly pendingBulkDelete = signal(false);
  protected readonly bulkDeleting = signal(false);

  /** Selected rows that may actually be deleted (system roles are guarded server-side). */
  protected readonly deletableSelected = computed(() => this.selected().filter((r) => !r.isSystem));

  constructor() {
    this.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => {
        this.pageNumber.set(1);
        this.load();
      });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.service
      .list({
        pageNumber: this.pageNumber(),
        pageSize: PAGE_SIZE,
        search: this.search.value || null,
      })
      .subscribe({
        next: (page) => {
          this.result.set(page);
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set(true);
          this.loading.set(false);
        },
      });
  }

  protected goToPage(page: number): void {
    this.pageNumber.set(page);
    this.load();
  }

  protected openCreate(): void {
    this.dialog.set({ mode: 'create' });
  }

  protected openEdit(role: RoleListItem): void {
    // Need the full role (incl. permissionCodes) for the editor.
    this.service.get(role.id).subscribe({
      next: (full) => this.dialog.set({ mode: 'edit', role: full }),
      error: () => undefined,
    });
  }

  protected askDelete(role: RoleListItem): void {
    this.pendingDelete.set({ id: role.id, name: role.name });
  }

  protected closeDialog(): void {
    this.dialog.set(null);
  }

  protected closeDelete(): void {
    if (!this.deleting()) {
      this.pendingDelete.set(null);
    }
  }

  protected onSaved(mode: 'create' | 'edit'): void {
    this.closeDialog();
    this.notify.success(this.i18n.translate(mode === 'edit' ? 'roles.updated' : 'roles.created'));
    this.load();
  }

  /**
   * Optimistic delete: drop the row (and decrement the total) immediately, close the dialog, hit the
   * server in the background, and restore + explain on failure (no other error toast covers this path).
   * No success refetch, so the removal doesn't flash the page.
   */
  protected confirmDelete(): void {
    const target = this.pendingDelete();
    if (!target) {
      return;
    }
    const snapshot = this.result();
    this.removeRowLocally(target.id);
    this.pendingDelete.set(null);
    this.service.remove(target.id).subscribe({
      next: () => {
        this.notify.success(this.i18n.translate('roles.deleted'));
        this.backfillIfPageEmpty();
      },
      error: (err: AppError) => {
        this.result.set(snapshot);
        this.notify.error(err?.detail || this.i18n.translate('common.actionFailed'));
      },
    });
  }

  /** Remove a row from the current page and decrement the total (optimistic mutation helper). */
  private removeRowLocally(id: string): void {
    this.result.update((page) =>
      page
        ? {
            ...page,
            items: page.items.filter((item) => item.id !== id),
            totalCount: Math.max(0, page.totalCount - 1),
          }
        : page,
    );
  }

  /** If an optimistic removal emptied a non-first page, step back one and refetch. */
  private backfillIfPageEmpty(): void {
    if (this.rows().length === 0 && this.pageNumber() > 1) {
      this.pageNumber.update((p) => p - 1);
      this.load();
    }
  }

  /** Export the selected rows to CSV (client-side; no round-trip needed). */
  protected exportSelected(): void {
    this.download(this.selected());
  }

  /** Export the whole filtered set — re-runs the current search for every match (capped), not just the page. */
  protected exportAll(): void {
    if (this.exporting()) {
      return;
    }
    this.exporting.set(true);
    const total = this.totalCount() || this.pageSize;
    this.service
      .list({
        pageNumber: 1,
        pageSize: Math.min(Math.max(total, 1), 5000),
        search: this.search.value || null,
      })
      .subscribe({
        next: (page) => {
          this.exporting.set(false);
          this.download(page.items);
        },
        error: () => {
          this.exporting.set(false);
          this.notify.error(this.i18n.translate('table.exportError'));
        },
      });
  }

  private download(rows: RoleListItem[]): void {
    if (rows.length === 0) {
      this.notify.error(this.i18n.translate('table.exportEmpty'));
      return;
    }
    downloadCsv(`roles-${exportDateStamp()}.csv`, toCsv(rows, this.exportColumns()));
  }

  protected askBulkDelete(): void {
    if (this.deletableSelected().length > 0) {
      this.pendingBulkDelete.set(true);
    }
  }

  protected closeBulkDelete(): void {
    if (!this.bulkDeleting()) {
      this.pendingBulkDelete.set(false);
    }
  }

  /**
   * Delete every selected, non-system role. Runs in parallel but tolerates partial failure (each is caught),
   * reports an aggregate result, then reloads — which clears the selection (the grid resets it on data change).
   */
  protected confirmBulkDelete(): void {
    const targets = this.deletableSelected();
    if (targets.length === 0) {
      return;
    }
    this.bulkDeleting.set(true);
    forkJoin(
      targets.map((r) =>
        this.service.remove(r.id).pipe(
          map(() => true),
          catchError(() => of(false)),
        ),
      ),
    ).subscribe((results) => {
      const ok = results.filter(Boolean).length;
      const failed = results.length - ok;
      this.bulkDeleting.set(false);
      this.pendingBulkDelete.set(false);
      if (failed === 0) {
        this.notify.success(this.i18n.translate('table.bulkDeleteDone', { count: ok }));
      } else {
        this.notify.error(this.i18n.translate('table.bulkDeletePartial', { ok, failed }));
      }
      if (this.rows().length === ok && this.pageNumber() > 1) {
        this.pageNumber.update((p) => p - 1);
      }
      this.load();
    });
  }
}

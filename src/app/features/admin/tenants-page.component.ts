import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ColumnDef, flexRenderComponent } from '@tanstack/angular-table';
import { catchError, debounceTime, distinctUntilChanged, forkJoin, map, of } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { Permissions } from '../../core/auth/permissions';
import { AppError, PagedResult, TenantListItem } from '../../core/models';
import { NotificationService } from '../../core/notifications/notification.service';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { CardComponent } from '../../shared/ui/card.component';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { DataTableComponent } from '../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { PaginationComponent } from '../../shared/ui/pagination.component';
import { SpinnerComponent } from '../../shared/ui/spinner.component';
import { TableSkeletonComponent } from '../../shared/ui/table-skeleton.component';
import { CsvColumn, downloadCsv, exportDateStamp, toCsv } from '../../shared/util/csv';
import {
  TenantActionsCellComponent,
  TenantRowActions,
} from './cells/tenant-actions-cell.component';
import { TenantStatusCellComponent } from './cells/tenant-status-cell.component';
import { TenantDialogInput, TenantFormDialogComponent } from './tenant-form-dialog.component';
import { TenantService } from './tenant.service';

const PAGE_SIZE = 20;

/**
 * Tenant administration (FRONTEND_PLAN §2.11): server-searched + paged grid of tenants with create/edit/
 * delete and, for super-admins, switch-tenant (re-scopes the access token to the chosen tenant, then lands
 * on the dashboard in that context).
 */
@Component({
  selector: 'app-tenants-page',
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
    ConfirmDialogComponent,
    TenantFormDialogComponent,
  ],
  template: `
    <app-page-header
      [title]="'admin.tenants.title' | transloco"
      [subtitle]="'admin.tenants.subtitle' | transloco"
    >
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
          {{ 'admin.tenants.new' | transloco }}
        </button>
      </div>
    </app-page-header>

    <app-card [padding]="false">
      <div class="border-b border-gray-100 p-4 dark:border-gray-800">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="w-full max-w-sm">
            <label class="sr-only" for="tenant-search">{{ 'common.search' | transloco }}</label>
            <input
              id="tenant-search"
              type="search"
              [formControl]="search"
              [placeholder]="'admin.tenants.searchPlaceholder' | transloco"
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
              class="btn btn-danger px-3 py-1.5"
              (click)="askBulkDelete()"
            >
              {{ 'table.deleteSelected' | transloco: { count: selected().length } }}
            </button>
          </div>
        </div>
      }

      @if (loading()) {
        <app-table-skeleton [rows]="8" [cols]="columns.length + 1" />
      } @else if (loadError()) {
        <app-empty-state [title]="'admin.tenants.loadError' | transloco">
          <button type="button" class="btn btn-secondary" (click)="load()">
            {{ 'common.retry' | transloco }}
          </button>
        </app-empty-state>
      } @else if (rows().length === 0) {
        <app-empty-state
          [title]="'admin.tenants.empty' | transloco"
          [description]="
            (search.value ? 'admin.tenants.emptySearchHint' : 'admin.tenants.emptyHint') | transloco
          "
        />
      } @else {
        <app-data-table
          [columns]="columns"
          [data]="rows()"
          [selectable]="true"
          [rowId]="tenantRowId"
          [enableColumnVisibility]="true"
          storageKey="tenants"
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
      <app-tenant-form-dialog
        [data]="input"
        (saved)="onSaved(input.mode)"
        (closed)="closeDialog()"
      />
    }

    @if (pendingDelete(); as target) {
      <app-confirm-dialog
        [title]="'admin.tenants.deleteTitle' | transloco"
        [message]="'admin.tenants.deleteConfirm' | transloco: { name: target.name }"
        [confirmLabel]="'common.delete' | transloco"
        [danger]="true"
        [busy]="deleting()"
        (confirmed)="confirmDelete()"
        (cancelled)="closeDelete()"
      />
    }

    @if (pendingBulkDelete()) {
      <app-confirm-dialog
        [title]="'admin.tenants.bulkDeleteTitle' | transloco"
        [message]="'admin.tenants.bulkDeleteConfirm' | transloco: { count: selected().length }"
        [confirmLabel]="'common.delete' | transloco"
        [danger]="true"
        [busy]="bulkDeleting()"
        (confirmed)="confirmBulkDelete()"
        (cancelled)="closeBulkDelete()"
      />
    }
  `,
})
export class TenantsPageComponent {
  private readonly service = inject(TenantService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(TranslocoService);
  protected readonly perms = Permissions.tenants;
  protected readonly pageSize = PAGE_SIZE;

  protected readonly search = new FormControl('', { nonNullable: true });

  protected readonly result = signal<PagedResult<TenantListItem> | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly pageNumber = signal(1);

  protected readonly rows = computed(() => this.result()?.items ?? []);
  protected readonly totalCount = computed(() => this.result()?.totalCount ?? 0);

  protected readonly dialog = signal<TenantDialogInput | null>(null);
  protected readonly pendingDelete = signal<{ id: string; name: string } | null>(null);
  protected readonly deleting = signal(false);

  private readonly rowActions: TenantRowActions = {
    edit: (tenant) => this.openEdit(tenant),
    remove: (tenant) => this.pendingDelete.set({ id: tenant.id, name: tenant.name }),
    switchTo: (tenant) => this.switchTo(tenant),
  };

  protected readonly columns: ColumnDef<TenantListItem, unknown>[] = [
    {
      accessorKey: 'name',
      header: () => this.i18n.translate('admin.tenants.name'),
      meta: { label: 'admin.tenants.name' },
    },
    {
      accessorKey: 'slug',
      header: () => this.i18n.translate('admin.tenants.slug'),
      meta: { label: 'admin.tenants.slug' },
    },
    {
      accessorKey: 'subscriptionTier',
      header: () => this.i18n.translate('admin.tenants.tier'),
      meta: { label: 'admin.tenants.tier' },
    },
    {
      id: 'status',
      header: () => this.i18n.translate('admin.tenants.status'),
      meta: { label: 'admin.tenants.status' },
      cell: () => flexRenderComponent(TenantStatusCellComponent),
    },
    {
      id: 'actions',
      header: () => '',
      enableHiding: false,
      meta: { actions: this.rowActions },
      cell: () => flexRenderComponent(TenantActionsCellComponent),
    },
  ];

  /** Stable selection identity + the CSV shape (decoupled from how cells render on screen). */
  protected readonly tenantRowId = (t: TenantListItem) => t.id;
  private exportColumns(): CsvColumn<TenantListItem>[] {
    return [
      { header: this.i18n.translate('admin.tenants.name'), value: (t) => t.name },
      { header: this.i18n.translate('admin.tenants.slug'), value: (t) => t.slug },
      { header: this.i18n.translate('admin.tenants.tier'), value: (t) => t.subscriptionTier },
    ];
  }

  /** Selection (current view) + bulk-operation state. Tenants have no protected rows. */
  protected readonly selected = signal<TenantListItem[]>([]);
  protected readonly exporting = signal(false);
  protected readonly pendingBulkDelete = signal(false);
  protected readonly bulkDeleting = signal(false);

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

  protected openEdit(tenant: TenantListItem): void {
    this.service.get(tenant.id).subscribe({
      next: (full) => this.dialog.set({ mode: 'edit', tenant: full }),
      error: () => undefined,
    });
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
    this.notify.success(
      this.i18n.translate(mode === 'edit' ? 'admin.tenants.updated' : 'admin.tenants.created'),
    );
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
        this.notify.success(this.i18n.translate('admin.tenants.deleted'));
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

  private download(rows: TenantListItem[]): void {
    if (rows.length === 0) {
      this.notify.error(this.i18n.translate('table.exportEmpty'));
      return;
    }
    downloadCsv(`tenants-${exportDateStamp()}.csv`, toCsv(rows, this.exportColumns()));
  }

  protected askBulkDelete(): void {
    if (this.selected().length > 0) {
      this.pendingBulkDelete.set(true);
    }
  }

  protected closeBulkDelete(): void {
    if (!this.bulkDeleting()) {
      this.pendingBulkDelete.set(false);
    }
  }

  /**
   * Delete every selected tenant. Runs in parallel but tolerates partial failure (each is caught — the
   * backend may refuse e.g. the active tenant), reports an aggregate result, then reloads, which clears the
   * selection (the grid resets it on data change).
   */
  protected confirmBulkDelete(): void {
    const targets = this.selected();
    if (targets.length === 0) {
      return;
    }
    this.bulkDeleting.set(true);
    forkJoin(
      targets.map((t) =>
        this.service.remove(t.id).pipe(
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

  private switchTo(tenant: TenantListItem): void {
    this.auth.switchTenant(tenant.id).subscribe({
      next: () => {
        this.notify.success(this.i18n.translate('admin.tenants.switched', { name: tenant.name }));
        void this.router.navigate(['/dashboard']);
      },
      error: () => undefined,
    });
  }
}

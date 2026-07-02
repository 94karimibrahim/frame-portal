import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ColumnDef, flexRenderComponent } from '@tanstack/angular-table';
import { catchError, debounceTime, distinctUntilChanged, forkJoin, map, merge, of } from 'rxjs';
import { Permissions } from '../../core/auth/permissions';
import { LocaleService } from '../../core/i18n/locale.service';
import {
  AppError,
  PagedResult,
  USER_STATUS_LABEL,
  UserListItem,
  UserStatus,
  UserStatusCounts,
} from '../../core/models';
import { NotificationService } from '../../core/notifications/notification.service';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { CardComponent } from '../../shared/ui/card.component';
import { DataTableComponent } from '../../shared/ui/data-table.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { NumberedPaginationComponent } from '../../shared/ui/numbered-pagination.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { SpinnerComponent } from '../../shared/ui/spinner.component';
import { TableSkeletonComponent } from '../../shared/ui/table-skeleton.component';
import { CsvColumn, downloadCsv, exportDateStamp, toCsv } from '../../shared/util/csv';
import { UserActionsCellComponent, UserRowActions } from './cells/user-actions-cell.component';
import { UserCreatedCellComponent } from './cells/user-created-cell.component';
import { UserNameCellComponent } from './cells/user-name-cell.component';
import { UserStatusCellComponent } from './cells/user-status-cell.component';
import { UserRolesDialogComponent, UserRolesDialogInput } from './user-roles-dialog.component';
import { UserService } from './user.service';

const PAGE_SIZE = 10;

/** A status quick-filter chip; `value` of `null` is the "All" chip. */
interface StatusChip {
  value: UserStatus | null;
  label: string;
}

/**
 * Users management page — a polished filter panel (per-column Name/Email/Role search + status quick-filter
 * chips with live counts + a sort menu + Clear) and a server-paged grid with avatar rows. Rows and actions
 * navigate to dedicated create/details/edit pages (see `users.routes`); role management and the destructive
 * confirms stay as inline dialogs here. All filtering/sorting/paging is **server-side** (the API does the
 * work); every control is permission-gated for convenience, with the backend authoritative.
 */
@Component({
  selector: 'app-users-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslocoModule,
    HasPermissionDirective,
    PageHeaderComponent,
    CardComponent,
    DataTableComponent,
    NumberedPaginationComponent,
    SpinnerComponent,
    TableSkeletonComponent,
    EmptyStateComponent,
    ModalComponent,
    UserRolesDialogComponent,
  ],
  template: `
    <app-page-header [title]="'users.title' | transloco" [subtitle]="'users.subtitle' | transloco">
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
          {{ 'users.new' | transloco }}
        </button>
      </div>
    </app-page-header>

    <app-card [padding]="false">
      <div class="border-b border-gray-100 p-4 dark:border-gray-800">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <!-- Status quick-filters -->
          <div
            class="custom-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
            role="group"
            [attr.aria-label]="'users.filterStatus' | transloco"
          >
            @for (chip of chips; track chip.value) {
              <button
                type="button"
                class="inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-theme-sm font-medium transition"
                [class]="status() === chip.value ? activeChip : idleChip"
                [attr.aria-pressed]="status() === chip.value"
                (click)="setStatus(chip.value)"
              >
                {{ chip.label | transloco }}
                @if (counts(); as c) {
                  <span
                    class="inline-flex min-w-5 items-center justify-center rounded-full px-2 py-0.5 text-theme-xs font-semibold tabular-nums"
                    [class]="
                      status() === chip.value
                        ? 'bg-brand-500 text-white'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                    "
                  >
                    {{ countFor(chip.value) }}
                  </span>
                }
              </button>
            }
          </div>

          <div class="flex items-center gap-2">
            <!-- Filters toggle: collapses the per-column search panel to save vertical space -->
            <button
              type="button"
              class="btn btn-secondary px-3 py-1.5"
              [class.border-brand-500!]="filtersOpen() || filterCount() > 0"
              [attr.aria-expanded]="filtersOpen()"
              (click)="filtersOpen.set(!filtersOpen())"
            >
              <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M2.5 5.25A.75.75 0 0 1 3.25 4.5h13.5a.75.75 0 0 1 .58 1.22l-4.83 5.92v4.36a.75.75 0 0 1-1.13.65l-3-1.74a.75.75 0 0 1-.37-.65v-2.62L2.67 5.72a.75.75 0 0 1-.17-.47Z"
                />
              </svg>
              {{ 'users.filters' | transloco }}
              @if (filterCount() > 0) {
                <span
                  class="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-theme-xs font-semibold text-white"
                >
                  {{ filterCount() }}
                </span>
              }
            </button>
            <!-- Sort menu -->
            <div class="relative">
              <button
                type="button"
                class="btn btn-secondary px-3 py-1.5"
                (click)="sortMenu.set(!sortMenu())"
              >
                <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    d="M5.5 3a.75.75 0 0 1 .75.75v9.69l1.72-1.72a.75.75 0 1 1 1.06 1.06l-3 3a.75.75 0 0 1-1.06 0l-3-3a.75.75 0 1 1 1.06-1.06l1.72 1.72V3.75A.75.75 0 0 1 5.5 3Zm6 0a.75.75 0 0 1 .53.22l3 3a.75.75 0 1 1-1.06 1.06l-1.72-1.72v9.69a.75.75 0 0 1-1.5 0V5.56L9.53 7.28a.75.75 0 0 1-1.06-1.06l3-3A.75.75 0 0 1 11.5 3Z"
                  />
                </svg>
                {{ 'users.sort' | transloco }}: {{ sortLabelKey() | transloco }}
                {{ sortDesc() ? '↓' : '↑' }}
              </button>
              @if (sortMenu()) {
                <div
                  class="absolute inset-e-0 top-11 z-10 w-44 rounded-theme-md border border-gray-200 bg-white p-1 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
                >
                  @for (s of sortFields; track s.key) {
                    <button
                      type="button"
                      class="flex w-full items-center justify-between rounded-theme-sm px-3 py-1.5 text-theme-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                      (click)="setSort(s.key)"
                    >
                      {{ s.labelKey | transloco }}
                      <span class="text-gray-400">{{
                        sortKey() === s.key ? (sortDesc() ? '↓' : '↑') : '↕'
                      }}</span>
                    </button>
                  }
                </div>
              }
            </div>
            <!-- Export the full filtered set (not just the page) -->
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
              {{ 'users.export' | transloco }}
            </button>
            @if (hasFilters()) {
              <button
                type="button"
                class="text-theme-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                (click)="clearFilters()"
              >
                {{ 'users.clear' | transloco }} ({{ filterCount() }})
              </button>
            }
          </div>
        </div>

        <!-- Per-column search inputs — collapsed behind the Filters toggle to save vertical space -->
        @if (filtersOpen()) {
          <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            @for (col of searchCols; track col.key) {
              <div class="relative">
                <span
                  class="pointer-events-none absolute inset-y-0 inset-s-3 flex items-center text-gray-400"
                >
                  <svg
                    class="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <circle cx="9" cy="9" r="6" />
                    <path stroke-linecap="round" d="m17 17-3-3" />
                  </svg>
                </span>
                <label class="sr-only" [attr.for]="'user-' + col.key">{{
                  col.labelKey | transloco
                }}</label>
                <input
                  [id]="'user-' + col.key"
                  type="search"
                  [formControl]="col.control"
                  [placeholder]="col.labelKey | transloco"
                  class="form-input ps-9 py-2!"
                />
              </div>
            }
          </div>
        }
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
              {{ 'users.exportSelected' | transloco }}
            </button>
            <button
              *appHasPermission="perms.delete"
              type="button"
              class="btn btn-danger px-3 py-1.5 disabled:opacity-50"
              [disabled]="deletableSelected().length === 0"
              (click)="askBulkDelete()"
            >
              {{ 'users.deleteSelected' | transloco: { count: deletableSelected().length } }}
            </button>
          </div>
        </div>
      }

      @if (loading()) {
        <app-table-skeleton [rows]="8" [cols]="columns.length + 1" />
      } @else if (loadError()) {
        <app-empty-state [title]="'users.loadError' | transloco">
          <button type="button" class="btn btn-secondary" (click)="load()">
            {{ 'common.retry' | transloco }}
          </button>
        </app-empty-state>
      } @else if (rows().length === 0) {
        @if (status() !== null && !hasTextFilter()) {
          <app-empty-state
            [title]="'users.emptyStatusTitle' | transloco: { status: statusLabel() }"
            [description]="'users.emptyStatusHint' | transloco"
          />
        } @else {
          <app-empty-state
            [title]="'users.empty' | transloco"
            [description]="(hasFilters() ? 'users.emptySearchHint' : 'users.emptyHint') | transloco"
          />
        }
      } @else {
        <app-data-table
          [columns]="columns"
          [data]="rows()"
          [clickable]="true"
          [selectable]="true"
          [rowId]="userRowId"
          [enableColumnVisibility]="true"
          storageKey="users"
          (rowClick)="openDetails($event)"
          (selectionChange)="selected.set($event)"
        />
        <div class="border-t border-gray-100 px-3 dark:border-gray-800/60">
          <app-numbered-pagination
            [pageNumber]="pageNumber()"
            [pageSize]="pageSize()"
            [totalCount]="totalCount()"
            [pageSizeOptions]="pageSizeOptions"
            (pageChange)="goToPage($event)"
            (pageSizeChange)="setPageSize($event)"
          />
        </div>
      }
    </app-card>

    @if (rolesDialog(); as input) {
      <app-user-roles-dialog
        [data]="input"
        (saved)="onRolesSaved()"
        (closed)="closeRolesDialog()"
      />
    }

    @if (pendingDelete(); as target) {
      <app-modal
        [title]="'users.deleteTitle' | transloco"
        widthClass="max-w-md"
        (closed)="closeDelete()"
      >
        <p class="text-theme-sm text-gray-600 dark:text-gray-300">
          {{ 'users.deleteConfirm' | transloco: { name: target.name } }}
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
        [title]="'users.bulkDeleteTitle' | transloco"
        widthClass="max-w-md"
        (closed)="closeBulkDelete()"
      >
        <p class="text-theme-sm text-gray-600 dark:text-gray-300">
          {{ 'users.bulkDeleteConfirm' | transloco: { count: deletableSelected().length } }}
        </p>
        @if (selected().length !== deletableSelected().length) {
          <p class="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
            {{
              'users.bulkDeleteSkipped'
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

    @if (pendingReset(); as target) {
      <app-modal
        [title]="'users.resetPasswordTitle' | transloco"
        widthClass="max-w-md"
        (closed)="closeReset()"
      >
        <p class="text-theme-sm text-gray-600 dark:text-gray-300">
          {{ 'users.resetPasswordConfirm' | transloco: { name: target.name } }}
        </p>
        <div modalFooter class="flex items-center justify-end gap-3">
          <button
            type="button"
            class="btn btn-secondary"
            (click)="closeReset()"
            [disabled]="resetting()"
          >
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            type="button"
            class="btn btn-primary"
            (click)="confirmReset()"
            [disabled]="resetting()"
          >
            @if (resetting()) {
              <app-spinner size="sm" />
            }
            {{ 'users.resetPassword' | transloco }}
          </button>
        </div>
      </app-modal>
    }

    @if (pendingUnlock(); as target) {
      <app-modal
        [title]="'users.unlockTitle' | transloco"
        widthClass="max-w-md"
        (closed)="closeUnlock()"
      >
        <p class="text-theme-sm text-gray-600 dark:text-gray-300">
          {{ 'users.unlockConfirm' | transloco: { name: target.name } }}
        </p>
        <div modalFooter class="flex items-center justify-end gap-3">
          <button
            type="button"
            class="btn btn-secondary"
            (click)="closeUnlock()"
            [disabled]="unlocking()"
          >
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            type="button"
            class="btn btn-primary"
            (click)="confirmUnlock()"
            [disabled]="unlocking()"
          >
            @if (unlocking()) {
              <app-spinner size="sm" />
            }
            {{ 'users.unlock' | transloco }}
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class UsersPageComponent {
  private readonly service = inject(UserService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(TranslocoService);
  private readonly locale = inject(LocaleService);
  protected readonly perms = Permissions.users;
  protected readonly pageSize = signal(PAGE_SIZE);
  protected readonly pageSizeOptions = [10, 20, 50];

  protected readonly activeChip =
    'border-brand-500 bg-brand-50 font-semibold text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300';
  protected readonly idleChip =
    'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-800 dark:bg-gray-dark dark:text-gray-300 dark:hover:bg-gray-800';

  protected readonly chips: StatusChip[] = [
    { value: null, label: 'users.filterAll' },
    { value: UserStatus.Active, label: USER_STATUS_LABEL[UserStatus.Active] },
    { value: UserStatus.Pending, label: USER_STATUS_LABEL[UserStatus.Pending] },
    { value: UserStatus.Suspended, label: USER_STATUS_LABEL[UserStatus.Suspended] },
    { value: UserStatus.Deactivated, label: USER_STATUS_LABEL[UserStatus.Deactivated] },
  ];

  // Per-column search controls (debounced, server-side).
  protected readonly nameFilter = new FormControl('', { nonNullable: true });
  protected readonly emailFilter = new FormControl('', { nonNullable: true });
  protected readonly roleFilter = new FormControl('', { nonNullable: true });
  protected readonly searchCols = [
    { key: 'name', labelKey: 'users.searchName', control: this.nameFilter },
    { key: 'email', labelKey: 'users.searchEmail', control: this.emailFilter },
    { key: 'role', labelKey: 'users.searchRole', control: this.roleFilter },
  ];

  protected readonly sortFields = [
    { key: 'name', labelKey: 'users.name' },
    { key: 'email', labelKey: 'users.email' },
    { key: 'status', labelKey: 'users.status' },
    { key: 'created', labelKey: 'users.createdAt' },
  ];
  protected readonly sortKey = signal('created');
  protected readonly sortDesc = signal(true);
  protected readonly sortMenu = signal(false);
  /** Whether the per-column search panel is expanded (collapsed by default to save vertical space). */
  protected readonly filtersOpen = signal(false);

  protected readonly result = signal<PagedResult<UserListItem> | null>(null);
  protected readonly counts = signal<UserStatusCounts | null>(null);
  protected readonly status = signal<UserStatus | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly pageNumber = signal(1);

  protected readonly rows = computed(() => this.result()?.items ?? []);
  protected readonly totalCount = computed(() => this.result()?.totalCount ?? 0);

  protected readonly rolesDialog = signal<UserRolesDialogInput | null>(null);
  protected readonly pendingDelete = signal<{ id: string; name: string } | null>(null);
  protected readonly deleting = signal(false);
  protected readonly pendingReset = signal<{ id: string; name: string } | null>(null);
  protected readonly resetting = signal(false);
  protected readonly pendingUnlock = signal<{ id: string; name: string } | null>(null);
  protected readonly unlocking = signal(false);

  /** Row action handlers handed to the actions cell via TanStack column `meta`. */
  private readonly rowActions: UserRowActions = {
    edit: (user) => this.openEdit(user),
    manageRoles: (user) => this.openRoles(user),
    unlock: (user) => this.askUnlock(user),
    resetPassword: (user) => this.askReset(user),
    remove: (user) => this.askDelete(user),
  };

  protected readonly columns: ColumnDef<UserListItem, unknown>[] = [
    {
      id: 'user',
      header: () => this.i18n.translate('users.name'),
      meta: { label: 'users.name' },
      cell: () => flexRenderComponent(UserNameCellComponent),
    },
    {
      id: 'status',
      header: () => this.i18n.translate('users.status'),
      meta: { label: 'users.status' },
      cell: () => flexRenderComponent(UserStatusCellComponent),
    },
    {
      id: 'createdAt',
      header: () => this.i18n.translate('users.createdAt'),
      meta: { label: 'users.createdAt' },
      accessorFn: (row) => row.createdAt,
      cell: () => flexRenderComponent(UserCreatedCellComponent),
    },
    {
      id: 'actions',
      header: () => '',
      enableHiding: false,
      meta: { actions: this.rowActions },
      cell: () => flexRenderComponent(UserActionsCellComponent),
    },
  ];

  /** Stable selection identity + the CSV shape (decoupled from how cells render on screen). */
  protected readonly userRowId = (u: UserListItem) => u.id;
  private exportColumns(): CsvColumn<UserListItem>[] {
    return [
      { header: this.i18n.translate('users.name'), value: (u) => u.fullName },
      { header: this.i18n.translate('users.email'), value: (u) => u.email },
      {
        header: this.i18n.translate('users.status'),
        value: (u) => this.i18n.translate(USER_STATUS_LABEL[u.status]),
      },
      {
        header: this.i18n.translate('users.createdAt'),
        value: (u) => new Date(u.createdAt).toLocaleDateString(this.locale.culture()),
      },
    ];
  }

  /** Selection (current view) + bulk-operation state. */
  protected readonly selected = signal<UserListItem[]>([]);
  protected readonly exporting = signal(false);
  protected readonly pendingBulkDelete = signal(false);
  protected readonly bulkDeleting = signal(false);

  /** Selected rows that may actually be deleted (system accounts are guarded server-side). */
  protected readonly deletableSelected = computed(() => this.selected().filter((u) => !u.isSystem));

  constructor() {
    // distinctUntilChanged runs per control, *before* the merge — applied after, it would compare
    // values across different controls and drop e.g. typing "x" in Email right after "x" in Name.
    merge(
      ...[this.nameFilter, this.emailFilter, this.roleFilter].map((c) =>
        c.valueChanges.pipe(distinctUntilChanged()),
      ),
    )
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe(() => {
        this.pageNumber.set(1);
        this.load();
      });
    this.load();
    this.loadCounts();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.service
      .list({
        pageNumber: this.pageNumber(),
        pageSize: this.pageSize(),
        name: this.nameFilter.value || null,
        email: this.emailFilter.value || null,
        role: this.roleFilter.value || null,
        status: this.status(),
        sort: this.sortKey(),
        descending: this.sortDesc(),
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

  /** Loads (or reloads after a mutation) the per-status totals that drive the chips. */
  protected loadCounts(): void {
    this.service.statusCounts().subscribe({
      next: (c) => this.counts.set(c),
      error: () => undefined,
    });
  }

  protected countFor(value: UserStatus | null): number {
    const c = this.counts();
    if (!c) {
      return 0;
    }
    switch (value) {
      case UserStatus.Active:
        return c.active;
      case UserStatus.Pending:
        return c.pending;
      case UserStatus.Suspended:
        return c.suspended;
      case UserStatus.Deactivated:
        return c.deactivated;
      default:
        return c.total; // null = the "All" chip
    }
  }

  protected setStatus(value: UserStatus | null): void {
    if (this.status() === value) {
      return;
    }
    this.status.set(value);
    this.pageNumber.set(1);
    this.load();
  }

  protected setSort(key: string): void {
    if (this.sortKey() === key) {
      this.sortDesc.update((d) => !d);
    } else {
      this.sortKey.set(key);
      this.sortDesc.set(key === 'created'); // created defaults newest-first, the rest ascending
    }
    this.sortMenu.set(false);
    this.pageNumber.set(1);
    this.load();
  }

  protected sortLabelKey(): string {
    return this.sortFields.find((s) => s.key === this.sortKey())?.labelKey ?? 'users.createdAt';
  }

  /** True when any per-column search or the status filter is active (drives Clear + empty-state copy). */
  protected hasFilters(): boolean {
    return this.filterCount() > 0;
  }

  /** True when any per-column text search is active (status chips excluded). */
  protected hasTextFilter(): boolean {
    return !!(
      this.nameFilter.value.trim() ||
      this.emailFilter.value.trim() ||
      this.roleFilter.value.trim()
    );
  }

  /** Localized label of the active status chip (empty when on the "All" chip); drives status-aware empties. */
  protected statusLabel(): string {
    const s = this.status();
    return s === null ? '' : this.i18n.translate(USER_STATUS_LABEL[s]);
  }

  /** Number of active filters (per-column searches + status), shown on the Clear button like concept #48. */
  protected filterCount(): number {
    return (
      (this.nameFilter.value.trim() ? 1 : 0) +
      (this.emailFilter.value.trim() ? 1 : 0) +
      (this.roleFilter.value.trim() ? 1 : 0) +
      (this.status() !== null ? 1 : 0)
    );
  }

  protected clearFilters(): void {
    this.nameFilter.setValue('', { emitEvent: false });
    this.emailFilter.setValue('', { emitEvent: false });
    this.roleFilter.setValue('', { emitEvent: false });
    this.status.set(null);
    this.pageNumber.set(1);
    this.load();
  }

  protected goToPage(page: number): void {
    this.pageNumber.set(page);
    this.load();
  }

  protected setPageSize(size: number): void {
    this.pageSize.set(size);
    this.pageNumber.set(1);
    this.load();
  }

  protected openDetails(user: UserListItem): void {
    this.router.navigate(['/users', user.id, 'details']);
  }

  protected openCreate(): void {
    this.router.navigate(['/users', 'new']);
  }

  protected openEdit(user: UserListItem): void {
    this.router.navigate(['/users', user.id, 'edit']);
  }

  protected openRoles(user: UserListItem): void {
    this.rolesDialog.set({ userId: user.id, userName: user.fullName });
  }

  protected closeRolesDialog(): void {
    this.rolesDialog.set(null);
  }

  protected onRolesSaved(): void {
    this.closeRolesDialog();
    this.notify.success(this.i18n.translate('users.rolesUpdated'));
  }

  protected askUnlock(user: UserListItem): void {
    this.pendingUnlock.set({ id: user.id, name: user.fullName });
  }

  protected closeUnlock(): void {
    if (!this.unlocking()) {
      this.pendingUnlock.set(null);
    }
  }

  protected confirmUnlock(): void {
    const target = this.pendingUnlock();
    if (!target) {
      return;
    }
    this.unlocking.set(true);
    this.service.unlock(target.id).subscribe({
      next: () => {
        this.unlocking.set(false);
        this.pendingUnlock.set(null);
        // Reflect the cleared lockout locally so the row's Unlock action disappears without a reload.
        this.result.update((page) =>
          page
            ? {
                ...page,
                items: page.items.map((item) =>
                  item.id === target.id ? { ...item, isLockedOut: false } : item,
                ),
              }
            : page,
        );
        this.notify.success(this.i18n.translate('users.unlocked', { name: target.name }));
      },
      error: () => this.unlocking.set(false),
    });
  }

  protected askDelete(user: UserListItem): void {
    this.pendingDelete.set({ id: user.id, name: user.fullName });
  }

  protected askReset(user: UserListItem): void {
    this.pendingReset.set({ id: user.id, name: user.fullName });
  }

  protected closeReset(): void {
    if (!this.resetting()) {
      this.pendingReset.set(null);
    }
  }

  protected confirmReset(): void {
    const target = this.pendingReset();
    if (!target) {
      return;
    }
    this.resetting.set(true);
    this.service.resetPassword(target.id).subscribe({
      next: () => {
        this.resetting.set(false);
        this.pendingReset.set(null);
        this.notify.success(this.i18n.translate('users.resetPasswordDone', { name: target.name }));
      },
      error: () => {
        this.resetting.set(false);
      },
    });
  }

  protected closeDelete(): void {
    if (!this.deleting()) {
      this.pendingDelete.set(null);
    }
  }

  /**
   * Optimistic delete: drop the row (and decrement the total) immediately, close the dialog, and only
   * touch the server in the background. On failure, restore the snapshot and surface the reason — there's
   * no other error toast for this path. We don't refetch on success (it would flash the page); the row is
   * already gone and the totals stay consistent until the next natural reload.
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
        this.notify.success(this.i18n.translate('users.deleted'));
        this.loadCounts();
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

  /**
   * Export the whole filtered set — not just the visible page. Re-runs the current query asking for every
   * matching row in one shot (capped), so the file reflects the active filters/sort. `exporting` drives the
   * button's progress state.
   */
  protected exportAll(): void {
    if (this.exporting()) {
      return;
    }
    this.exporting.set(true);
    const total = this.totalCount() || this.pageSize();
    this.service
      .list({
        pageNumber: 1,
        pageSize: Math.min(Math.max(total, 1), 5000),
        name: this.nameFilter.value || null,
        email: this.emailFilter.value || null,
        role: this.roleFilter.value || null,
        status: this.status(),
        sort: this.sortKey(),
        descending: this.sortDesc(),
      })
      .subscribe({
        next: (page) => {
          this.exporting.set(false);
          this.download(page.items);
        },
        error: () => {
          this.exporting.set(false);
          this.notify.error(this.i18n.translate('users.exportError'));
        },
      });
  }

  private download(rows: UserListItem[]): void {
    if (rows.length === 0) {
      this.notify.error(this.i18n.translate('users.exportEmpty'));
      return;
    }
    downloadCsv(`users-${exportDateStamp()}.csv`, toCsv(rows, this.exportColumns()));
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
   * Delete every selected, non-system row. Runs the deletes in parallel but tolerates partial failure —
   * each is caught so one rejection doesn't abort the rest — then reports an aggregate result and reloads
   * (which clears the selection, since the grid resets selection whenever its data changes).
   */
  protected confirmBulkDelete(): void {
    const targets = this.deletableSelected();
    if (targets.length === 0) {
      return;
    }
    this.bulkDeleting.set(true);
    forkJoin(
      targets.map((u) =>
        this.service.remove(u.id).pipe(
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
        this.notify.success(this.i18n.translate('users.bulkDeleteDone', { count: ok }));
      } else {
        this.notify.error(this.i18n.translate('users.bulkDeletePartial', { ok, failed }));
      }
      if (this.rows().length === ok && this.pageNumber() > 1) {
        this.pageNumber.update((p) => p - 1);
      }
      this.load();
      this.loadCounts();
    });
  }
}

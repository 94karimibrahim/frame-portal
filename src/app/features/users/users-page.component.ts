import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { ColumnDef, flexRenderComponent } from '@tanstack/angular-table';
import { Permissions } from '../../core/auth/permissions';
import { LocaleService } from '../../core/i18n/locale.service';
import { USER_STATUS_LABEL, UserListItem, UserStatus } from '../../core/models';
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
import { UsersPageStore, UserTarget } from './users-page.store';

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
 *
 * The server state and mutations live in {@link UsersPageStore} (provided here, so it lives and dies
 * with the page); this class keeps only the UI: dialogs, menus, selection, navigation, CSV assembly.
 */
@Component({
  selector: 'app-users-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [UsersPageStore],
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
                [class]="store.status() === chip.value ? activeChip : idleChip"
                [attr.aria-pressed]="store.status() === chip.value"
                (click)="store.setStatus(chip.value)"
              >
                {{ chip.label | transloco }}
                @if (store.counts(); as c) {
                  <span
                    class="inline-flex min-w-5 items-center justify-center rounded-full px-2 py-0.5 text-theme-xs font-semibold tabular-nums"
                    [class]="
                      store.status() === chip.value
                        ? 'bg-brand-500 text-white'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                    "
                  >
                    {{ store.countFor(chip.value) }}
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
              [class.border-brand-500!]="filtersOpen() || store.filterCount() > 0"
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
              @if (store.filterCount() > 0) {
                <span
                  class="inline-flex min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-theme-xs font-semibold text-white"
                >
                  {{ store.filterCount() }}
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
                {{ store.sortDesc() ? '↓' : '↑' }}
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
                        store.sortKey() === s.key ? (store.sortDesc() ? '↓' : '↑') : '↕'
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
              [disabled]="store.exporting() || store.totalCount() === 0"
              (click)="exportAll()"
            >
              @if (store.exporting()) {
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
            @if (store.hasFilters()) {
              <button
                type="button"
                class="text-theme-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                (click)="store.clearFilters()"
              >
                {{ 'users.clear' | transloco }} ({{ store.filterCount() }})
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

      @if (store.loading()) {
        <app-table-skeleton [rows]="8" [cols]="columns.length + 1" />
      } @else if (store.loadError()) {
        <app-empty-state [title]="'users.loadError' | transloco">
          <button type="button" class="btn btn-secondary" (click)="store.load()">
            {{ 'common.retry' | transloco }}
          </button>
        </app-empty-state>
      } @else if (store.rows().length === 0) {
        @if (store.status() !== null && !store.hasTextFilter()) {
          <app-empty-state
            [title]="'users.emptyStatusTitle' | transloco: { status: statusLabel() }"
            [description]="'users.emptyStatusHint' | transloco"
          />
        } @else {
          <app-empty-state
            [title]="'users.empty' | transloco"
            [description]="
              (store.hasFilters() ? 'users.emptySearchHint' : 'users.emptyHint') | transloco
            "
          />
        }
      } @else {
        <app-data-table
          [columns]="columns"
          [data]="store.rows()"
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
            [pageNumber]="store.pageNumber()"
            [pageSize]="store.pageSize()"
            [totalCount]="store.totalCount()"
            [pageSizeOptions]="pageSizeOptions"
            (pageChange)="store.goToPage($event)"
            (pageSizeChange)="store.setPageSize($event)"
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
          <button type="button" class="btn btn-secondary" (click)="closeDelete()">
            {{ 'common.cancel' | transloco }}
          </button>
          <button type="button" class="btn btn-danger" (click)="confirmDelete()">
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
            [disabled]="store.bulkDeleting()"
          >
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            type="button"
            class="btn btn-danger"
            (click)="confirmBulkDelete()"
            [disabled]="store.bulkDeleting()"
          >
            @if (store.bulkDeleting()) {
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
            [disabled]="store.resetting()"
          >
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            type="button"
            class="btn btn-primary"
            (click)="confirmReset()"
            [disabled]="store.resetting()"
          >
            @if (store.resetting()) {
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
            [disabled]="store.unlocking()"
          >
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            type="button"
            class="btn btn-primary"
            (click)="confirmUnlock()"
            [disabled]="store.unlocking()"
          >
            @if (store.unlocking()) {
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
  protected readonly store = inject(UsersPageStore);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(TranslocoService);
  private readonly locale = inject(LocaleService);
  protected readonly perms = Permissions.users;
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

  protected readonly searchCols = [
    { key: 'name', labelKey: 'users.searchName', control: this.store.nameFilter },
    { key: 'email', labelKey: 'users.searchEmail', control: this.store.emailFilter },
    { key: 'role', labelKey: 'users.searchRole', control: this.store.roleFilter },
  ];

  protected readonly sortFields = [
    { key: 'name', labelKey: 'users.name' },
    { key: 'email', labelKey: 'users.email' },
    { key: 'status', labelKey: 'users.status' },
    { key: 'created', labelKey: 'users.createdAt' },
  ];
  protected readonly sortMenu = signal(false);
  /** Whether the per-column search panel is expanded (collapsed by default to save vertical space). */
  protected readonly filtersOpen = signal(false);

  protected readonly rolesDialog = signal<UserRolesDialogInput | null>(null);
  protected readonly pendingDelete = signal<UserTarget | null>(null);
  protected readonly pendingReset = signal<UserTarget | null>(null);
  protected readonly pendingUnlock = signal<UserTarget | null>(null);

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

  /** Selection (current view) + bulk-operation dialog state. */
  protected readonly selected = signal<UserListItem[]>([]);
  protected readonly pendingBulkDelete = signal(false);

  /** Selected rows that may actually be deleted (system accounts are guarded server-side). */
  protected readonly deletableSelected = computed(() => this.selected().filter((u) => !u.isSystem));

  protected setSort(key: string): void {
    this.store.setSort(key);
    this.sortMenu.set(false);
  }

  protected sortLabelKey(): string {
    return (
      this.sortFields.find((s) => s.key === this.store.sortKey())?.labelKey ?? 'users.createdAt'
    );
  }

  /** Localized label of the active status chip (empty when on the "All" chip); drives status-aware empties. */
  protected statusLabel(): string {
    const s = this.store.status();
    return s === null ? '' : this.i18n.translate(USER_STATUS_LABEL[s]);
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
    if (!this.store.unlocking()) {
      this.pendingUnlock.set(null);
    }
  }

  protected confirmUnlock(): void {
    const target = this.pendingUnlock();
    if (!target) {
      return;
    }
    this.store.unlock(target).subscribe({
      next: () => this.pendingUnlock.set(null),
      error: () => undefined, // dialog stays open; the store already reset its busy flag
    });
  }

  protected askDelete(user: UserListItem): void {
    this.pendingDelete.set({ id: user.id, name: user.fullName });
  }

  protected askReset(user: UserListItem): void {
    this.pendingReset.set({ id: user.id, name: user.fullName });
  }

  protected closeReset(): void {
    if (!this.store.resetting()) {
      this.pendingReset.set(null);
    }
  }

  protected confirmReset(): void {
    const target = this.pendingReset();
    if (!target) {
      return;
    }
    this.store.resetPassword(target).subscribe({
      next: () => this.pendingReset.set(null),
      error: () => undefined, // dialog stays open; the store already reset its busy flag
    });
  }

  protected closeDelete(): void {
    this.pendingDelete.set(null);
  }

  /** The delete is optimistic (see the store) — the dialog closes immediately, no busy state needed. */
  protected confirmDelete(): void {
    const target = this.pendingDelete();
    if (!target) {
      return;
    }
    this.pendingDelete.set(null);
    this.store.deleteOptimistic(target);
  }

  /** Export the selected rows to CSV (client-side; no round-trip needed). */
  protected exportSelected(): void {
    this.download(this.selected());
  }

  /** Export the whole filtered set — the store re-runs the current query for every matching row. */
  protected exportAll(): void {
    if (this.store.exporting()) {
      return;
    }
    this.store.fetchAllFiltered().subscribe({
      next: (rows) => this.download(rows),
      error: () => undefined, // the store already toasted the failure
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
    if (!this.store.bulkDeleting()) {
      this.pendingBulkDelete.set(false);
    }
  }

  protected confirmBulkDelete(): void {
    const targets = this.deletableSelected().map((u) => ({ id: u.id, name: u.fullName }));
    if (targets.length === 0) {
      return;
    }
    this.store.bulkDelete(targets).subscribe(() => this.pendingBulkDelete.set(false));
  }
}

import { Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';
import {
  Observable,
  catchError,
  debounceTime,
  distinctUntilChanged,
  forkJoin,
  map,
  merge,
  of,
  tap,
} from 'rxjs';
import {
  AppError,
  PagedResult,
  UserListItem,
  UserStatus,
  UserStatusCounts,
} from '../../core/models';
import { NotificationService } from '../../core/notifications/notification.service';
import { UserService } from './user.service';

const PAGE_SIZE = 10;
/** Upper bound for the export-all fetch, so a huge tenant can't request an unbounded page. */
const EXPORT_CAP = 5000;

/** A row identity the confirm dialogs carry around (id to mutate, name for the copy). */
export interface UserTarget {
  id: string;
  name: string;
}

/**
 * Page store for the users list — the template's example of extracting a large page's server state
 * into a facade. Owns the query state (filters, status, sort, paging), the paged result + status
 * counts, and every server interaction including the optimistic mutations. The component keeps only
 * UI concerns: dialog visibility, menus, row selection, navigation, and CSV assembly.
 *
 * **Provided by the page component** (`providers: [UsersPageStore]`), so its lifetime — including the
 * `takeUntilDestroyed` filter subscription — is the page's lifetime, and two instances of the page
 * would get two independent stores.
 *
 * Mutation methods that a dialog awaits (`unlock`, `resetPassword`, `bulkDelete`) return **cold**
 * observables already instrumented with busy flags, local row updates, and toasts — the caller
 * subscribes exactly once and only decides what to do with its own UI (e.g. close the dialog).
 */
@Injectable()
export class UsersPageStore {
  private readonly service = inject(UserService);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(TranslocoService);

  // ── Query state ────────────────────────────────────────────────────────────
  readonly pageNumber = signal(1);
  readonly pageSize = signal(PAGE_SIZE);
  readonly status = signal<UserStatus | null>(null);
  readonly sortKey = signal('created');
  readonly sortDesc = signal(true);

  // Per-column search controls (debounced, server-side).
  readonly nameFilter = new FormControl('', { nonNullable: true });
  readonly emailFilter = new FormControl('', { nonNullable: true });
  readonly roleFilter = new FormControl('', { nonNullable: true });

  // ── Server state ───────────────────────────────────────────────────────────
  readonly result = signal<PagedResult<UserListItem> | null>(null);
  readonly counts = signal<UserStatusCounts | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal(false);

  readonly rows = computed(() => this.result()?.items ?? []);
  readonly totalCount = computed(() => this.result()?.totalCount ?? 0);

  // ── Mutation busy flags (gate dialog buttons) ──────────────────────────────
  readonly unlocking = signal(false);
  readonly resetting = signal(false);
  readonly bulkDeleting = signal(false);
  readonly exporting = signal(false);

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

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.service.list(this.query(this.pageNumber(), this.pageSize())).subscribe({
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
  loadCounts(): void {
    this.service.statusCounts().subscribe({
      next: (c) => this.counts.set(c),
      error: () => undefined,
    });
  }

  /** The current query, reused verbatim by the export so the file reflects the active filters/sort. */
  private query(pageNumber: number, pageSize: number) {
    return {
      pageNumber,
      pageSize,
      name: this.nameFilter.value || null,
      email: this.emailFilter.value || null,
      role: this.roleFilter.value || null,
      status: this.status(),
      sort: this.sortKey(),
      descending: this.sortDesc(),
    };
  }

  countFor(value: UserStatus | null): number {
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

  setStatus(value: UserStatus | null): void {
    if (this.status() === value) {
      return;
    }
    this.status.set(value);
    this.pageNumber.set(1);
    this.load();
  }

  setSort(key: string): void {
    if (this.sortKey() === key) {
      this.sortDesc.update((d) => !d);
    } else {
      this.sortKey.set(key);
      this.sortDesc.set(key === 'created'); // created defaults newest-first, the rest ascending
    }
    this.pageNumber.set(1);
    this.load();
  }

  /** True when any per-column search or the status filter is active (drives Clear + empty-state copy). */
  hasFilters(): boolean {
    return this.filterCount() > 0;
  }

  /** True when any per-column text search is active (status chips excluded). */
  hasTextFilter(): boolean {
    return !!(
      this.nameFilter.value.trim() ||
      this.emailFilter.value.trim() ||
      this.roleFilter.value.trim()
    );
  }

  /** Number of active filters (per-column searches + status), shown on the Filters/Clear buttons. */
  filterCount(): number {
    return (
      (this.nameFilter.value.trim() ? 1 : 0) +
      (this.emailFilter.value.trim() ? 1 : 0) +
      (this.roleFilter.value.trim() ? 1 : 0) +
      (this.status() !== null ? 1 : 0)
    );
  }

  clearFilters(): void {
    this.nameFilter.setValue('', { emitEvent: false });
    this.emailFilter.setValue('', { emitEvent: false });
    this.roleFilter.setValue('', { emitEvent: false });
    this.status.set(null);
    this.pageNumber.set(1);
    this.load();
  }

  goToPage(page: number): void {
    this.pageNumber.set(page);
    this.load();
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.pageNumber.set(1);
    this.load();
  }

  /**
   * Unlock a locked-out account. On success the cleared lockout is reflected locally so the row's
   * Unlock action disappears without a reload. Cold — subscribe once; `next` fires only on success.
   */
  unlock(target: UserTarget): Observable<void> {
    this.unlocking.set(true);
    return this.service.unlock(target.id).pipe(
      tap({
        next: () => {
          this.unlocking.set(false);
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
      }),
    );
  }

  /** Admin password reset (emails a one-time link). Cold — subscribe once; `next` only on success. */
  resetPassword(target: UserTarget): Observable<void> {
    this.resetting.set(true);
    return this.service.resetPassword(target.id).pipe(
      tap({
        next: () => {
          this.resetting.set(false);
          this.notify.success(
            this.i18n.translate('users.resetPasswordDone', { name: target.name }),
          );
        },
        error: () => this.resetting.set(false),
      }),
    );
  }

  /**
   * Optimistic delete: drop the row (and decrement the total) immediately and only touch the server
   * in the background. On failure, restore the snapshot and surface the reason — there's no other
   * error toast for this path. We don't refetch on success (it would flash the page); the row is
   * already gone and the totals stay consistent until the next natural reload. Fire-and-forget: the
   * store subscribes itself, since no dialog outlives the call.
   */
  deleteOptimistic(target: UserTarget): void {
    const snapshot = this.result();
    this.result.update((page) =>
      page
        ? {
            ...page,
            items: page.items.filter((item) => item.id !== target.id),
            totalCount: Math.max(0, page.totalCount - 1),
          }
        : page,
    );
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

  /** If an optimistic removal emptied a non-first page, step back one and refetch. */
  private backfillIfPageEmpty(): void {
    if (this.rows().length === 0 && this.pageNumber() > 1) {
      this.pageNumber.update((p) => p - 1);
      this.load();
    }
  }

  /**
   * Delete every given row. Runs the deletes in parallel but tolerates partial failure — each is
   * caught so one rejection doesn't abort the rest — then reports an aggregate toast and reloads
   * (which clears the selection, since the grid resets selection whenever its data changes).
   * Cold — subscribe once; always completes with the aggregate result.
   */
  bulkDelete(targets: UserTarget[]): Observable<{ ok: number; failed: number }> {
    this.bulkDeleting.set(true);
    return forkJoin(
      targets.map((u) =>
        this.service.remove(u.id).pipe(
          map(() => true),
          catchError(() => of(false)),
        ),
      ),
    ).pipe(
      map((results) => {
        const ok = results.filter(Boolean).length;
        return { ok, failed: results.length - ok };
      }),
      tap(({ ok, failed }) => {
        this.bulkDeleting.set(false);
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
      }),
    );
  }

  /**
   * Fetch the whole filtered set — not just the visible page — for the CSV export. Re-runs the
   * current query asking for every matching row in one shot (capped at {@link EXPORT_CAP});
   * `exporting` drives the button's progress state. Cold — subscribe once; `next` only on success
   * (the failure toast is handled here).
   */
  fetchAllFiltered(): Observable<UserListItem[]> {
    this.exporting.set(true);
    const total = this.totalCount() || this.pageSize();
    return this.service.list(this.query(1, Math.min(Math.max(total, 1), EXPORT_CAP))).pipe(
      map((page) => page.items),
      tap({
        next: () => this.exporting.set(false),
        error: () => {
          this.exporting.set(false);
          this.notify.error(this.i18n.translate('users.exportError'));
        },
      }),
    );
  }
}

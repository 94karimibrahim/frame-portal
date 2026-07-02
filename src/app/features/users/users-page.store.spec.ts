import type { MockedObject } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Subject, of, throwError } from 'rxjs';
import { PagedResult, UserListItem, UserStatus, UserStatusCounts } from '../../core/models';
import { NotificationService } from '../../core/notifications/notification.service';
import { UserService, UsersQuery } from './user.service';
import { UsersPageStore } from './users-page.store';

function user(id: string, overrides: Partial<UserListItem> = {}): UserListItem {
  return {
    id,
    fullName: `User ${id}`,
    email: `${id}@example.com`,
    status: UserStatus.Active,
    isSystem: false,
    isLockedOut: false,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function page(items: UserListItem[], totalCount = items.length): PagedResult<UserListItem> {
  return {
    items,
    pageNumber: 1,
    pageSize: 10,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / 10)),
    hasPreviousPage: false,
    hasNextPage: totalCount > items.length,
  };
}

const counts: UserStatusCounts = { total: 9, active: 5, pending: 2, suspended: 1, deactivated: 1 };

describe('UsersPageStore', () => {
  beforeEach(() => {
    vi.useFakeTimers({ advanceTimeDelta: 1, shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  let service: MockedObject<UserService>;
  let notify: MockedObject<NotificationService>;

  function createStore(): UsersPageStore {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { en: {}, ar: {} },
          translocoConfig: { availableLangs: ['en', 'ar'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [
        UsersPageStore,
        { provide: UserService, useValue: service },
        { provide: NotificationService, useValue: notify },
      ],
    });
    return TestBed.inject(UsersPageStore);
  }

  beforeEach(() => {
    service = {
      list: vi.fn().mockName('UserService.list'),
      statusCounts: vi.fn().mockName('UserService.statusCounts'),
      remove: vi.fn().mockName('UserService.remove'),
      unlock: vi.fn().mockName('UserService.unlock'),
      resetPassword: vi.fn().mockName('UserService.resetPassword'),
    } as unknown as MockedObject<UserService>;
    service.list.mockReturnValue(of(page([user('u1'), user('u2')])));
    service.statusCounts.mockReturnValue(of(counts));
    notify = {
      success: vi.fn().mockName('NotificationService.success'),
      error: vi.fn().mockName('NotificationService.error'),
    } as unknown as MockedObject<NotificationService>;
  });

  it('loads the first page and the status counts on creation', () => {
    const store = createStore();
    expect(store.rows().length).toBe(2);
    expect(store.loading()).toBe(false);
    expect(store.counts()).toEqual(counts);
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining<UsersQuery>({ pageNumber: 1, sort: 'created', descending: true }),
    );
  });

  it('flags loadError when the list call fails, and load() retries', () => {
    service.list.mockReturnValue(throwError(() => ({ status: 500 })));
    const store = createStore();
    expect(store.loadError()).toBe(true);
    service.list.mockReturnValue(of(page([user('u1')])));
    store.load();
    expect(store.loadError()).toBe(false);
    expect(store.rows().length).toBe(1);
  });

  it('debounces filter typing and resets to page 1', async () => {
    const store = createStore();
    store.goToPage(3);
    service.list.mockClear();
    store.nameFilter.setValue('ami');
    await vi.advanceTimersByTimeAsync(299);
    expect(service.list).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining<UsersQuery>({ pageNumber: 1, name: 'ami' }),
    );
  });

  // Regression for review finding M-2: distinctUntilChanged must run per control, before the merge —
  // otherwise typing the same text in a *different* filter box is deduped and never reloads.
  it('reloads when a second control receives the same text as the first', async () => {
    const store = createStore();
    store.nameFilter.setValue('x');
    await vi.advanceTimersByTimeAsync(300);
    service.list.mockClear();
    store.emailFilter.setValue('x');
    await vi.advanceTimersByTimeAsync(300);
    expect(service.list).toHaveBeenCalledTimes(1);
  });

  it('setStatus filters, resets the page, and ignores re-selecting the active chip', () => {
    const store = createStore();
    store.goToPage(2);
    service.list.mockClear();
    store.setStatus(UserStatus.Suspended);
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining<UsersQuery>({ pageNumber: 1, status: UserStatus.Suspended }),
    );
    service.list.mockClear();
    store.setStatus(UserStatus.Suspended);
    expect(service.list).not.toHaveBeenCalled();
  });

  it('setSort toggles direction on the active key and defaults new keys sensibly', () => {
    const store = createStore();
    store.setSort('created'); // active key -> flip newest-first to oldest-first
    expect(store.sortDesc()).toBe(false);
    store.setSort('name'); // new key -> ascending
    expect(store.sortKey()).toBe('name');
    expect(store.sortDesc()).toBe(false);
    store.setSort('created'); // back to created -> newest-first again
    expect(store.sortDesc()).toBe(true);
  });

  it('clearFilters resets everything and reloads exactly once', async () => {
    const store = createStore();
    store.nameFilter.setValue('a');
    store.setStatus(UserStatus.Pending);
    await vi.advanceTimersByTimeAsync(300);
    service.list.mockClear();
    store.clearFilters();
    await vi.advanceTimersByTimeAsync(300); // no debounced reload may sneak in after the immediate one
    expect(service.list).toHaveBeenCalledTimes(1);
    expect(store.filterCount()).toBe(0);
    expect(store.hasFilters()).toBe(false);
  });

  it('counts active filters across the text inputs and the status chip', () => {
    const store = createStore();
    store.nameFilter.setValue('a', { emitEvent: false });
    store.roleFilter.setValue('  ', { emitEvent: false }); // whitespace does not count
    store.setStatus(UserStatus.Active);
    expect(store.filterCount()).toBe(2);
    expect(store.hasTextFilter()).toBe(true);
  });

  it('optimistically removes a deleted row and restores the snapshot on failure', () => {
    const remove$ = new Subject<void>();
    service.remove.mockReturnValue(remove$.asObservable());
    const store = createStore();
    store.deleteOptimistic({ id: 'u1', name: 'User u1' });
    // Row and total drop before the server answers.
    expect(store.rows().map((u) => u.id)).toEqual(['u2']);
    expect(store.totalCount()).toBe(1);
    remove$.error({ detail: 'Nope' });
    expect(store.rows().map((u) => u.id)).toEqual(['u1', 'u2']);
    expect(store.totalCount()).toBe(2);
    expect(notify.error).toHaveBeenCalledWith('Nope');
  });

  it('steps back a page when an optimistic delete empties a non-first page', () => {
    service.list.mockReturnValue(of(page([user('u9')], 11)));
    service.remove.mockReturnValue(of(void 0));
    const store = createStore();
    store.goToPage(2);
    service.list.mockClear();
    store.deleteOptimistic({ id: 'u9', name: 'User u9' });
    expect(store.pageNumber()).toBe(1);
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining<UsersQuery>({ pageNumber: 1 }),
    );
  });

  it('unlock clears the row lockout locally and resolves the busy flag', () => {
    service.list.mockReturnValue(of(page([user('u1', { isLockedOut: true }), user('u2')])));
    service.unlock.mockReturnValue(of(void 0));
    const store = createStore();
    store.unlock({ id: 'u1', name: 'User u1' }).subscribe();
    expect(store.unlocking()).toBe(false);
    expect(store.rows().find((u) => u.id === 'u1')?.isLockedOut).toBe(false);
    expect(notify.success).toHaveBeenCalled();
  });

  it('bulkDelete tolerates partial failure and reports the aggregate', () => {
    service.remove.mockImplementation((id: string) =>
      id === 'u1' ? of(void 0) : throwError(() => ({ status: 409 })),
    );
    const store = createStore();
    let outcome:
      | {
          ok: number;
          failed: number;
        }
      | undefined;
    store
      .bulkDelete([
        { id: 'u1', name: 'User u1' },
        { id: 'u2', name: 'User u2' },
      ])
      .subscribe((r) => (outcome = r));
    expect(outcome).toEqual({ ok: 1, failed: 1 });
    expect(notify.error).toHaveBeenCalled(); // the partial-failure toast
    expect(store.bulkDeleting()).toBe(false);
  });

  it('fetchAllFiltered re-runs the active query for the whole set, capped at 5000', () => {
    service.list.mockReturnValue(of(page([user('u1')], 12000)));
    const store = createStore();
    store.nameFilter.setValue('ami', { emitEvent: false });
    service.list.mockClear();
    let exported: UserListItem[] | undefined;
    store.fetchAllFiltered().subscribe((rows) => (exported = rows));
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining<UsersQuery>({ pageNumber: 1, pageSize: 5000, name: 'ami' }),
    );
    expect(exported?.length).toBe(1);
    expect(store.exporting()).toBe(false);
  });
});

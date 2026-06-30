import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import {
  CreateUserRequest,
  PagedQuery,
  PagedResult,
  RoleListItem,
  UpdateUserRequest,
  User,
  UserListItem,
  UserStatus,
  UserStatusCounts,
} from '../../core/models';

/** List query for users: shared paging plus per-column filters, an account-status filter, and sorting. */
export type UsersQuery = PagedQuery & {
  status?: UserStatus | null;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  /** Sort column: `name` | `email` | `status` | `created`. */
  sort?: string | null;
  descending?: boolean;
};

/**
 * Data layer for user management (`/api/users`). The list is server-paged and searchable; every mutation
 * returns either the new id (create) or nothing (204). Authorization is enforced per call by the backend —
 * the UI gates controls for convenience only.
 */
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly api = inject(ApiClient);

  list(query: UsersQuery): Observable<PagedResult<UserListItem>> {
    return this.api.get<PagedResult<UserListItem>>('/users', {
      pageNumber: query.pageNumber ?? 1,
      pageSize: query.pageSize ?? 20,
      search: query.search ?? null,
      status: query.status ?? null,
      name: query.name ?? null,
      email: query.email ?? null,
      role: query.role ?? null,
      sort: query.sort ?? null,
      descending: query.descending ? true : null,
    });
  }

  /** Per-status user totals for the current tenant; drives the list quick-filter counts. */
  statusCounts(): Observable<UserStatusCounts> {
    return this.api.get<UserStatusCounts>('/users/status-counts');
  }

  get(id: string): Observable<User> {
    return this.api.get<User>(`/users/${id}`);
  }

  getRoles(id: string): Observable<RoleListItem[]> {
    return this.api.get<RoleListItem[]>(`/users/${id}/roles`);
  }

  create(request: CreateUserRequest): Observable<string> {
    return this.api.post<string>('/users', request);
  }

  update(id: string, request: UpdateUserRequest): Observable<void> {
    return this.api.put<void>(`/users/${id}`, request);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/users/${id}`);
  }

  unlock(id: string): Observable<void> {
    return this.api.post<void>(`/users/${id}/unlock`);
  }

  /** Admin-resets a user's password: emails them a one-time reset link and forces a password change. */
  resetPassword(id: string): Observable<void> {
    return this.api.post<void>(`/users/${id}/reset-password`);
  }
}

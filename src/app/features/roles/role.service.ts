import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import {
  CreateRoleRequest,
  PagedQuery,
  PagedResult,
  Role,
  RoleListItem,
  UpdateRoleRequest,
} from '../../core/models';

/** Largest page the API allows; used to pull the full role set for pickers (parent role, assignment). */
export const MAX_PAGE_SIZE = 200;

/**
 * Data layer for role management (`/api/roles`), including role↔user assignment. The list is server-paged;
 * {@link listAll} pulls every role in one shot (capped at the server max) for the editor's parent picker and
 * the user-roles assignment dialog, neither of which paginate.
 */
@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly api = inject(ApiClient);

  list(query: PagedQuery): Observable<PagedResult<RoleListItem>> {
    return this.api.get<PagedResult<RoleListItem>>('/roles', {
      pageNumber: query.pageNumber ?? 1,
      pageSize: query.pageSize ?? 20,
      search: query.search ?? null,
    });
  }

  listAll(): Observable<PagedResult<RoleListItem>> {
    return this.api.get<PagedResult<RoleListItem>>('/roles', {
      pageNumber: 1,
      pageSize: MAX_PAGE_SIZE,
    });
  }

  get(id: string): Observable<Role> {
    return this.api.get<Role>(`/roles/${id}`);
  }

  create(request: CreateRoleRequest): Observable<string> {
    return this.api.post<string>('/roles', request);
  }

  update(id: string, request: UpdateRoleRequest): Observable<void> {
    return this.api.put<void>(`/roles/${id}`, request);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/roles/${id}`);
  }

  assignToUser(roleId: string, userId: string): Observable<void> {
    return this.api.post<void>(`/roles/${roleId}/users/${userId}`);
  }

  removeFromUser(roleId: string, userId: string): Observable<void> {
    return this.api.delete<void>(`/roles/${roleId}/users/${userId}`);
  }
}

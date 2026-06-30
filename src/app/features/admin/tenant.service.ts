import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import {
  CreateTenantRequest,
  PagedQuery,
  PagedResult,
  Tenant,
  TenantListItem,
  UpdateTenantRequest,
} from '../../core/models';

/** Data layer for tenant administration (`/api/tenants`, cross-tenant — requires the `tenants.*` perms). */
@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly api = inject(ApiClient);

  list(query: PagedQuery): Observable<PagedResult<TenantListItem>> {
    return this.api.get<PagedResult<TenantListItem>>('/tenants', {
      pageNumber: query.pageNumber ?? 1,
      pageSize: query.pageSize ?? 20,
      search: query.search ?? null,
    });
  }

  get(id: string): Observable<Tenant> {
    return this.api.get<Tenant>(`/tenants/${id}`);
  }

  create(request: CreateTenantRequest): Observable<string> {
    return this.api.post<string>('/tenants', request);
  }

  update(id: string, request: UpdateTenantRequest): Observable<void> {
    return this.api.put<void>(`/tenants/${id}`, request);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/tenants/${id}`);
  }
}

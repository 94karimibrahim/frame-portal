import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { Permission } from '../../core/models';

/** Data layer for the permission catalogue (`/api/permissions`). Read-only; the catalogue is fixed in code. */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private readonly api = inject(ApiClient);

  /** The full catalogue, or just one module's permissions when `module` is given. */
  list(module?: string): Observable<Permission[]> {
    return this.api.get<Permission[]>('/permissions', { module: module ?? null });
  }
}

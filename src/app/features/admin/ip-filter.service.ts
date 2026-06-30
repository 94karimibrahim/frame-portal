import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { CreateIpFilterRequest, IpFilter } from '../../core/models';

/** Data layer for per-tenant IP allow/block rules (`/api/ipfilters`). */
@Injectable({ providedIn: 'root' })
export class IpFilterService {
  private readonly api = inject(ApiClient);

  list(): Observable<IpFilter[]> {
    return this.api.get<IpFilter[]>('/ipfilters');
  }

  create(request: CreateIpFilterRequest): Observable<string> {
    return this.api.post<string>('/ipfilters', request);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/ipfilters/${id}`);
  }
}

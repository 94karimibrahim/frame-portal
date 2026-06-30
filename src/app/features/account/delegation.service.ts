import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { CreateDelegationRequest, Delegation } from '../../core/models';

/**
 * Self-service permission delegation (`/api/delegations`): grant a subset of your own permissions to
 * another user for a time window. The delegator is always the caller; delegations are immutable (create /
 * revoke only).
 */
@Injectable({ providedIn: 'root' })
export class DelegationService {
  private readonly api = inject(ApiClient);

  list(): Observable<Delegation[]> {
    return this.api.get<Delegation[]>('/delegations');
  }

  create(request: CreateDelegationRequest): Observable<string> {
    return this.api.post<string>('/delegations', request);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/delegations/${id}`);
  }
}

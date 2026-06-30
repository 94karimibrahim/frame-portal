import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { ApiKey, ApiKeyCreated, CreateApiKeyRequest } from '../../core/models';

/** Self-service API-key management (`/api/apikeys`). Create/rotate return the secret exactly once. */
@Injectable({ providedIn: 'root' })
export class ApiKeyService {
  private readonly api = inject(ApiClient);

  list(): Observable<ApiKey[]> {
    return this.api.get<ApiKey[]>('/apikeys');
  }

  create(request: CreateApiKeyRequest): Observable<ApiKeyCreated> {
    return this.api.post<ApiKeyCreated>('/apikeys', request);
  }

  rotate(id: string): Observable<ApiKeyCreated> {
    return this.api.post<ApiKeyCreated>(`/apikeys/${id}/rotate`);
  }

  revoke(id: string): Observable<void> {
    return this.api.delete<void>(`/apikeys/${id}`);
  }
}

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { Session } from '../../core/models';

/** Self-service active-session management (`/api/sessions`). */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(ApiClient);

  list(): Observable<Session[]> {
    return this.api.get<Session[]>('/sessions');
  }

  revoke(id: string): Observable<void> {
    return this.api.delete<void>(`/sessions/${id}`);
  }

  revokeAll(): Observable<void> {
    return this.api.delete<void>('/sessions');
  }
}

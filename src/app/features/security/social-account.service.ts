import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { SocialAccount } from '../../core/models';

/**
 * Self-service linked social-account management (`/api/socialaccounts`). Listing + unlinking only — linking
 * needs an OAuth code from a provider redirect, which is deferred (FRONTEND_PLAN Q4).
 */
@Injectable({ providedIn: 'root' })
export class SocialAccountService {
  private readonly api = inject(ApiClient);

  list(): Observable<SocialAccount[]> {
    return this.api.get<SocialAccount[]>('/socialaccounts');
  }

  unlink(id: string): Observable<void> {
    return this.api.delete<void>(`/socialaccounts/${id}`);
  }
}

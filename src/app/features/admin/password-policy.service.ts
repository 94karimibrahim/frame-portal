import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { PasswordPolicy } from '../../core/models';

/** Data layer for the per-tenant password policy (`/api/passwordpolicies`); a single upsertable resource. */
@Injectable({ providedIn: 'root' })
export class PasswordPolicyService {
  private readonly api = inject(ApiClient);

  get(): Observable<PasswordPolicy> {
    return this.api.get<PasswordPolicy>('/passwordpolicies');
  }

  upsert(policy: PasswordPolicy): Observable<void> {
    return this.api.put<void>('/passwordpolicies', policy);
  }
}

import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { Preferences, UpdatePreferencesRequest } from '../../core/models';

/** Data layer for the signed-in user's preferences (`/api/preferences`, self-service). */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly api = inject(ApiClient);

  get(): Observable<Preferences> {
    return this.api.get<Preferences>('/preferences');
  }

  update(request: UpdatePreferencesRequest): Observable<void> {
    return this.api.put<void>('/preferences', request);
  }
}

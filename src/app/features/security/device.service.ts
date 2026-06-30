import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { Device } from '../../core/models';

/** Default trust window (days) when marking a device trusted; the backend also has its own cap. */
export const DEFAULT_TRUST_DAYS = 30;

/**
 * Self-service known-device management (`/api/devices`); trusting a device bypasses 2FA from it. Named
 * plural to distinguish from {@link core/auth/device.service}'s `DeviceService`, which owns the browser's
 * own stable device id.
 */
@Injectable({ providedIn: 'root' })
export class DevicesService {
  private readonly api = inject(ApiClient);

  list(): Observable<Device[]> {
    return this.api.get<Device[]>('/devices');
  }

  trust(id: string, trustDays = DEFAULT_TRUST_DAYS): Observable<void> {
    return this.api.post<void>(`/devices/${id}/trust`, undefined, { trustDays });
  }

  revokeTrust(id: string): Observable<void> {
    return this.api.post<void>(`/devices/${id}/revoke`);
  }
}

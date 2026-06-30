import { Injectable } from '@angular/core';

/**
 * Produces a stable per-browser device id used for the `X-Device-Id` login header (trusted-device 2FA
 * bypass). Persisted in `localStorage` so the same browser is recognised across sessions.
 *
 * ⚠ The backend CORS policy does not currently allow the `X-Device-Id` header (FRONTEND_PLAN Q1), so the
 * auth flow keeps {@link AuthService} sending it gated off. When the header is added to
 * `Cors:AllowedHeaders`, flip that flag — this service is already in place.
 */
@Injectable({ providedIn: 'root' })
export class DeviceService {
  private static readonly KEY = 'frame.device';

  getDeviceId(): string {
    try {
      let id = localStorage.getItem(DeviceService.KEY);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(DeviceService.KEY, id);
      }
      return id;
    } catch {
      // Storage unavailable: fall back to an ephemeral id (no persistence, still valid for one session).
      return crypto.randomUUID();
    }
  }
}

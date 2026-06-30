import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../../core/http/api-client.service';
import { BackupCodes, TwoFactorSetup, TwoFactorStatus } from '../../core/models';

/** Self-service two-factor (TOTP) management (`/api/twofactor`). All actions act on the caller's account. */
@Injectable({ providedIn: 'root' })
export class TwoFactorService {
  private readonly api = inject(ApiClient);

  status(): Observable<TwoFactorStatus> {
    return this.api.get<TwoFactorStatus>('/twofactor/status');
  }

  /** Begins setup: returns the shared key + otpauth URI to show as a QR. 2FA is not active until verified. */
  enable(): Observable<TwoFactorSetup> {
    return this.api.post<TwoFactorSetup>('/twofactor/enable');
  }

  /** Confirms the first TOTP code, activating 2FA and returning the (reveal-once) backup codes. */
  verify(code: string): Observable<BackupCodes> {
    return this.api.post<BackupCodes>('/twofactor/verify', { code });
  }

  disable(code: string): Observable<void> {
    return this.api.post<void>('/twofactor/disable', { code });
  }

  /** Regenerates backup codes (reveal-once), invalidating the previous set. */
  regenerateBackupCodes(code: string): Observable<BackupCodes> {
    return this.api.post<BackupCodes>('/twofactor/backup-codes', { code });
  }
}

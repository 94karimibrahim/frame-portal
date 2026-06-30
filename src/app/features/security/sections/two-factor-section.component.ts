import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import QRCode from 'qrcode';
import { TwoFactorSetup, TwoFactorStatus } from '../../../core/models';
import { NotificationService } from '../../../core/notifications/notification.service';
import { BadgeComponent } from '../../../shared/ui/badge.component';
import { ModalComponent } from '../../../shared/ui/modal.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { TwoFactorService } from '../two-factor.service';

/**
 * Security-center section for TOTP two-factor. Walks the enable flow (start → QR + shared key → verify code →
 * reveal one-time backup codes), and when enabled offers disable / regenerate-backup-codes, both of which
 * require a current code. Reveal-once codes are shown in a modal the user must copy before closing.
 */
@Component({
  selector: 'app-two-factor-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslocoModule, SpinnerComponent, BadgeComponent, ModalComponent],
  template: `
    <section
      class="rounded-theme-lg border border-gray-200 bg-white p-6 shadow-theme-sm dark:border-gray-800 dark:bg-gray-dark"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2
            class="flex items-center gap-2 text-theme-md font-semibold text-gray-800 dark:text-gray-100"
          >
            {{ 'security.twoFactor.title' | transloco }}
            @if (status()?.enabled) {
              <app-badge variant="success">{{ 'security.twoFactor.on' | transloco }}</app-badge>
            } @else {
              <app-badge variant="neutral">{{ 'security.twoFactor.off' | transloco }}</app-badge>
            }
          </h2>
          <p class="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
            {{ 'security.twoFactor.subtitle' | transloco }}
          </p>
        </div>
      </div>

      @if (loading()) {
        <div class="flex justify-center py-8"><app-spinner /></div>
      } @else if (loadError()) {
        <p class="py-4 text-theme-sm text-error-500">{{ 'security.loadError' | transloco }}</p>
      } @else if (setup(); as s) {
        <!-- Enable flow: scan + verify -->
        <div class="mt-5 flex flex-col items-start gap-5 sm:flex-row">
          @if (qrDataUrl(); as qr) {
            <img
              [src]="qr"
              alt=""
              width="180"
              height="180"
              class="rounded-theme-lg border border-gray-200 dark:border-gray-700"
            />
          }
          <div class="flex-1">
            <p class="text-theme-sm text-gray-600 dark:text-gray-300">
              {{ 'security.twoFactor.scanHint' | transloco }}
            </p>
            <p class="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
              {{ 'security.twoFactor.manualKey' | transloco }}
            </p>
            <code
              class="mt-1 block break-all rounded-theme-md bg-gray-50 px-3 py-2 text-theme-xs text-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >{{ s.sharedKey }}</code
            >

            <div class="mt-4 max-w-xs">
              <label class="form-label" for="tfa-code">{{
                'security.twoFactor.enterCode' | transloco
              }}</label>
              <input
                id="tfa-code"
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                [formControl]="setupCode"
                class="form-input"
              />
            </div>
            <div class="mt-4 flex gap-3">
              <button
                type="button"
                class="btn btn-primary"
                [disabled]="busy() || setupCode.invalid"
                (click)="verify()"
              >
                @if (busy()) {
                  <app-spinner size="sm" />
                }
                {{ 'security.twoFactor.verifyEnable' | transloco }}
              </button>
              <button
                type="button"
                class="btn btn-secondary"
                [disabled]="busy()"
                (click)="cancelSetup()"
              >
                {{ 'common.cancel' | transloco }}
              </button>
            </div>
          </div>
        </div>
      } @else if (status()?.enabled) {
        <div class="mt-5">
          <p class="text-theme-sm text-gray-600 dark:text-gray-300">
            {{
              'security.twoFactor.backupRemaining'
                | transloco: { count: status()!.remainingBackupCodes }
            }}
          </p>
          <div class="mt-4 flex flex-wrap gap-3">
            <button type="button" class="btn btn-secondary" (click)="openPrompt('regen')">
              {{ 'security.twoFactor.regenerate' | transloco }}
            </button>
            <button type="button" class="btn btn-danger" (click)="openPrompt('disable')">
              {{ 'security.twoFactor.disable' | transloco }}
            </button>
          </div>
        </div>
      } @else {
        <div class="mt-5">
          <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="enable()">
            @if (busy()) {
              <app-spinner size="sm" />
            }
            {{ 'security.twoFactor.enable' | transloco }}
          </button>
        </div>
      }
    </section>

    <!-- Code prompt for disable / regenerate -->
    @if (prompt(); as action) {
      <app-modal
        [title]="
          (action === 'disable'
            ? 'security.twoFactor.disableTitle'
            : 'security.twoFactor.regenerateTitle'
          ) | transloco
        "
        widthClass="max-w-md"
        (closed)="closePrompt()"
      >
        <label class="form-label" for="tfa-prompt-code">{{
          'security.twoFactor.enterCode' | transloco
        }}</label>
        <input
          id="tfa-prompt-code"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          [formControl]="promptCode"
          class="form-input"
        />
        <div modalFooter class="flex items-center justify-end gap-3">
          <button
            type="button"
            class="btn btn-secondary"
            (click)="closePrompt()"
            [disabled]="busy()"
          >
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            type="button"
            [class]="action === 'disable' ? 'btn btn-danger' : 'btn btn-primary'"
            [disabled]="busy() || promptCode.invalid"
            (click)="submitPrompt(action)"
          >
            @if (busy()) {
              <app-spinner size="sm" />
            }
            {{ 'common.confirm' | transloco }}
          </button>
        </div>
      </app-modal>
    }

    <!-- Reveal-once backup codes -->
    @if (backupCodes(); as codes) {
      <app-modal
        [title]="'security.twoFactor.backupTitle' | transloco"
        widthClass="max-w-md"
        (closed)="backupCodes.set(null)"
      >
        <p class="mb-3 text-theme-sm text-gray-600 dark:text-gray-300">
          {{ 'security.twoFactor.backupHint' | transloco }}
        </p>
        <ul class="grid grid-cols-2 gap-2">
          @for (code of codes; track code) {
            <li
              class="rounded-theme-md bg-gray-50 px-3 py-2 text-center font-mono text-theme-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100"
            >
              {{ code }}
            </li>
          }
        </ul>
        <div modalFooter class="flex items-center justify-end gap-3">
          <button type="button" class="btn btn-secondary" (click)="copyCodes(codes)">
            {{ 'common.copy' | transloco }}
          </button>
          <button type="button" class="btn btn-primary" (click)="backupCodes.set(null)">
            {{ 'common.close' | transloco }}
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class TwoFactorSectionComponent {
  private readonly service = inject(TwoFactorService);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(TranslocoService);

  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly busy = signal(false);
  protected readonly status = signal<TwoFactorStatus | null>(null);
  protected readonly setup = signal<TwoFactorSetup | null>(null);
  protected readonly qrDataUrl = signal<string | null>(null);
  protected readonly backupCodes = signal<string[] | null>(null);
  protected readonly prompt = signal<'disable' | 'regen' | null>(null);

  protected readonly setupCode = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });
  protected readonly promptCode = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required],
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.service.status().subscribe({
      next: (s) => {
        this.status.set(s);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  protected enable(): void {
    this.busy.set(true);
    this.service.enable().subscribe({
      next: (s) => {
        this.busy.set(false);
        this.setup.set(s);
        this.setupCode.reset();
        void QRCode.toDataURL(s.authenticatorUri)
          .then((url) => this.qrDataUrl.set(url))
          .catch(() => this.qrDataUrl.set(null));
      },
      error: () => this.busy.set(false),
    });
  }

  protected verify(): void {
    if (this.setupCode.invalid) {
      return;
    }
    this.busy.set(true);
    this.service.verify(this.setupCode.value).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.setup.set(null);
        this.qrDataUrl.set(null);
        this.backupCodes.set(result.codes);
        this.notify.success(this.i18n.translate('security.twoFactor.enabledToast'));
        this.load();
      },
      error: () => this.busy.set(false),
    });
  }

  protected cancelSetup(): void {
    this.setup.set(null);
    this.qrDataUrl.set(null);
  }

  protected openPrompt(action: 'disable' | 'regen'): void {
    this.promptCode.reset();
    this.prompt.set(action);
  }

  protected closePrompt(): void {
    if (!this.busy()) {
      this.prompt.set(null);
    }
  }

  protected submitPrompt(action: 'disable' | 'regen'): void {
    if (this.promptCode.invalid) {
      return;
    }
    this.busy.set(true);
    const code = this.promptCode.value;
    if (action === 'disable') {
      this.service.disable(code).subscribe({
        next: () => {
          this.busy.set(false);
          this.prompt.set(null);
          this.notify.success(this.i18n.translate('security.twoFactor.disabledToast'));
          this.load();
        },
        error: () => this.busy.set(false),
      });
    } else {
      this.service.regenerateBackupCodes(code).subscribe({
        next: (result) => {
          this.busy.set(false);
          this.prompt.set(null);
          this.backupCodes.set(result.codes);
          this.load();
        },
        error: () => this.busy.set(false),
      });
    }
  }

  protected copyCodes(codes: string[]): void {
    void navigator.clipboard
      ?.writeText(codes.join('\n'))
      .then(() => this.notify.success(this.i18n.translate('common.copied')));
  }
}

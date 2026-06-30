import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LocaleService } from '../../../core/i18n/locale.service';
import { DEVICE_TYPE_LABEL, Device } from '../../../core/models';
import { NotificationService } from '../../../core/notifications/notification.service';
import { BadgeComponent } from '../../../shared/ui/badge.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { DevicesService } from '../device.service';

/** Security-center section: lists known devices; trust (for 2FA bypass) or revoke trust on each. */
@Component({
  selector: 'app-devices-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, SpinnerComponent, BadgeComponent],
  template: `
    <section
      class="rounded-theme-lg border border-gray-200 bg-white p-6 shadow-theme-sm dark:border-gray-800 dark:bg-gray-dark"
    >
      <h2 class="text-theme-md font-semibold text-gray-800 dark:text-gray-100">
        {{ 'security.devices.title' | transloco }}
      </h2>
      <p class="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
        {{ 'security.devices.subtitle' | transloco }}
      </p>

      @if (loading()) {
        <div class="flex justify-center py-8"><app-spinner /></div>
      } @else if (loadError()) {
        <p class="py-4 text-theme-sm text-error-500">{{ 'security.loadError' | transloco }}</p>
      } @else if (devices().length === 0) {
        <p class="py-4 text-theme-sm text-gray-500 dark:text-gray-400">
          {{ 'security.devices.empty' | transloco }}
        </p>
      } @else {
        <ul class="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
          @for (d of devices(); track d.id) {
            <li class="flex items-center justify-between gap-4 py-3">
              <div class="min-w-0">
                <p
                  class="flex items-center gap-2 truncate text-theme-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  {{ d.name }}
                  @if (d.isTrusted) {
                    <app-badge variant="success">{{
                      'security.devices.trusted' | transloco
                    }}</app-badge>
                  }
                </p>
                <p class="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                  {{ deviceTypeLabel(d) | transloco }}{{ d.browser ? ' · ' + d.browser : '' }} ·
                  {{ 'security.devices.lastSeen' | transloco }} {{ fmt(d.lastSeenAt) }}
                </p>
              </div>
              @if (d.isTrusted) {
                <button
                  type="button"
                  class="btn btn-secondary px-3 py-1.5"
                  [disabled]="busyId() === d.id"
                  (click)="revokeTrust(d)"
                >
                  {{ 'security.devices.revokeTrust' | transloco }}
                </button>
              } @else {
                <button
                  type="button"
                  class="btn btn-secondary px-3 py-1.5"
                  [disabled]="busyId() === d.id"
                  (click)="trust(d)"
                >
                  {{ 'security.devices.trust' | transloco }}
                </button>
              }
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class DevicesSectionComponent {
  private readonly service = inject(DevicesService);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(TranslocoService);
  private readonly locale = inject(LocaleService);

  protected readonly devices = signal<Device[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly busyId = signal<string | null>(null);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.service.list().subscribe({
      next: (list) => {
        this.devices.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  protected trust(device: Device): void {
    this.busyId.set(device.id);
    this.service.trust(device.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.notify.success(this.i18n.translate('security.devices.trustedToast'));
        this.load();
      },
      error: () => this.busyId.set(null),
    });
  }

  protected revokeTrust(device: Device): void {
    this.busyId.set(device.id);
    this.service.revokeTrust(device.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.notify.success(this.i18n.translate('security.devices.revokedToast'));
        this.load();
      },
      error: () => this.busyId.set(null),
    });
  }

  protected deviceTypeLabel(device: Device): string {
    return DEVICE_TYPE_LABEL[device.deviceType];
  }

  protected fmt(date: string | null | undefined): string {
    return date ? new Date(date).toLocaleString(this.locale.culture()) : '—';
  }
}

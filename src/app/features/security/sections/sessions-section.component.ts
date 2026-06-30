import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LocaleService } from '../../../core/i18n/locale.service';
import { Session } from '../../../core/models';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { SessionService } from '../session.service';

/** Security-center section: lists the user's active sessions and lets them revoke one or all. */
@Component({
  selector: 'app-sessions-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, SpinnerComponent, ConfirmDialogComponent],
  template: `
    <section
      class="rounded-theme-lg border border-gray-200 bg-white p-6 shadow-theme-sm dark:border-gray-800 dark:bg-gray-dark"
    >
      <div class="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 class="text-theme-md font-semibold text-gray-800 dark:text-gray-100">
            {{ 'security.sessions.title' | transloco }}
          </h2>
          <p class="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
            {{ 'security.sessions.subtitle' | transloco }}
          </p>
        </div>
        @if (sessions().length > 0) {
          <button
            type="button"
            class="btn btn-secondary px-3 py-1.5"
            (click)="confirmAll.set(true)"
          >
            {{ 'security.sessions.revokeAll' | transloco }}
          </button>
        }
      </div>

      @if (loading()) {
        <div class="flex justify-center py-8"><app-spinner /></div>
      } @else if (loadError()) {
        <p class="py-4 text-theme-sm text-error-500">{{ 'security.loadError' | transloco }}</p>
      } @else if (sessions().length === 0) {
        <p class="py-4 text-theme-sm text-gray-500 dark:text-gray-400">
          {{ 'security.sessions.empty' | transloco }}
        </p>
      } @else {
        <ul class="divide-y divide-gray-100 dark:divide-gray-800">
          @for (s of sessions(); track s.id) {
            <li class="flex items-center justify-between gap-4 py-3">
              <div class="min-w-0">
                <p class="truncate text-theme-sm font-medium text-gray-700 dark:text-gray-200">
                  {{ label(s) }}
                </p>
                <p class="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                  {{ s.ipAddress }}{{ s.location ? ' · ' + s.location : '' }} ·
                  {{ 'security.sessions.lastActive' | transloco }} {{ fmt(s.lastActivityAt) }}
                </p>
              </div>
              <button
                type="button"
                class="btn btn-secondary px-3 py-1.5"
                [disabled]="revokingId() === s.id"
                (click)="revoke(s)"
              >
                {{ 'security.sessions.revoke' | transloco }}
              </button>
            </li>
          }
        </ul>
      }
    </section>

    @if (confirmAll()) {
      <app-confirm-dialog
        [title]="'security.sessions.revokeAllTitle' | transloco"
        [message]="'security.sessions.revokeAllConfirm' | transloco"
        [confirmLabel]="'security.sessions.revokeAll' | transloco"
        [danger]="true"
        [busy]="revokingAll()"
        (confirmed)="revokeAll()"
        (cancelled)="confirmAll.set(false)"
      />
    }
  `,
})
export class SessionsSectionComponent {
  private readonly service = inject(SessionService);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(TranslocoService);
  private readonly locale = inject(LocaleService);

  protected readonly sessions = signal<Session[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly revokingId = signal<string | null>(null);
  protected readonly confirmAll = signal(false);
  protected readonly revokingAll = signal(false);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.service.list().subscribe({
      next: (list) => {
        this.sessions.set(list.filter((s) => !s.isRevoked));
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  protected revoke(session: Session): void {
    this.revokingId.set(session.id);
    this.service.revoke(session.id).subscribe({
      next: () => {
        this.revokingId.set(null);
        this.sessions.update((list) => list.filter((s) => s.id !== session.id));
        this.notify.success(this.i18n.translate('security.sessions.revoked'));
      },
      error: () => this.revokingId.set(null),
    });
  }

  protected revokeAll(): void {
    this.revokingAll.set(true);
    this.service.revokeAll().subscribe({
      next: () => {
        this.revokingAll.set(false);
        this.confirmAll.set(false);
        this.notify.success(this.i18n.translate('security.sessions.revokedAll'));
        this.load();
      },
      error: () => this.revokingAll.set(false),
    });
  }

  protected label(s: Session): string {
    return (
      s.deviceName ||
      [s.browser, s.operatingSystem].filter(Boolean).join(' · ') ||
      this.i18n.translate('security.unknownDevice')
    );
  }

  protected fmt(date: string | null | undefined): string {
    return date ? new Date(date).toLocaleString(this.locale.culture()) : '—';
  }
}

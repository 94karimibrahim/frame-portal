import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { SOCIAL_PROVIDER_LABEL, SocialAccount } from '../../../core/models';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { SocialAccountService } from '../social-account.service';

/**
 * Security-center section: linked social accounts. Lists them and supports unlinking. Linking new accounts
 * needs an OAuth provider redirect, which is deferred (FRONTEND_PLAN Q4) — so no "link" affordance here.
 */
@Component({
  selector: 'app-social-accounts-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, SpinnerComponent, ConfirmDialogComponent],
  template: `
    <section
      class="rounded-theme-lg border border-gray-200 bg-white p-6 shadow-theme-sm dark:border-gray-800 dark:bg-gray-dark"
    >
      <h2 class="text-theme-md font-semibold text-gray-800 dark:text-gray-100">
        {{ 'security.social.title' | transloco }}
      </h2>
      <p class="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
        {{ 'security.social.subtitle' | transloco }}
      </p>

      @if (loading()) {
        <div class="flex justify-center py-8"><app-spinner /></div>
      } @else if (loadError()) {
        <p class="py-4 text-theme-sm text-error-500">{{ 'security.loadError' | transloco }}</p>
      } @else if (accounts().length === 0) {
        <p class="py-4 text-theme-sm text-gray-500 dark:text-gray-400">
          {{ 'security.social.empty' | transloco }}
        </p>
      } @else {
        <ul class="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
          @for (a of accounts(); track a.id) {
            <li class="flex items-center justify-between gap-4 py-3">
              <div class="min-w-0">
                <p class="truncate text-theme-sm font-medium text-gray-700 dark:text-gray-200">
                  {{ providerName(a) }}
                </p>
                <p class="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                  {{ a.displayName || a.email || a.providerAccountId }}
                </p>
              </div>
              <button
                type="button"
                class="btn btn-secondary px-3 py-1.5"
                (click)="pendingUnlink.set(a)"
              >
                {{ 'security.social.unlink' | transloco }}
              </button>
            </li>
          }
        </ul>
      }
    </section>

    @if (pendingUnlink(); as a) {
      <app-confirm-dialog
        [title]="'security.social.unlinkTitle' | transloco"
        [message]="'security.social.unlinkConfirm' | transloco: { provider: providerName(a) }"
        [confirmLabel]="'security.social.unlink' | transloco"
        [danger]="true"
        [busy]="unlinking()"
        (confirmed)="unlink(a)"
        (cancelled)="pendingUnlink.set(null)"
      />
    }
  `,
})
export class SocialAccountsSectionComponent {
  private readonly service = inject(SocialAccountService);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(TranslocoService);

  protected readonly accounts = signal<SocialAccount[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly pendingUnlink = signal<SocialAccount | null>(null);
  protected readonly unlinking = signal(false);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.service.list().subscribe({
      next: (list) => {
        this.accounts.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  protected unlink(account: SocialAccount): void {
    this.unlinking.set(true);
    this.service.unlink(account.id).subscribe({
      next: () => {
        this.unlinking.set(false);
        this.pendingUnlink.set(null);
        this.accounts.update((list) => list.filter((a) => a.id !== account.id));
        this.notify.success(this.i18n.translate('security.social.unlinked'));
      },
      error: () => this.unlinking.set(false),
    });
  }

  protected providerName(account: SocialAccount): string {
    return SOCIAL_PROVIDER_LABEL[account.provider];
  }
}

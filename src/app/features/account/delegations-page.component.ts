import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { Permissions } from '../../core/auth/permissions';
import { LocaleService } from '../../core/i18n/locale.service';
import { AppError, Delegation, UserListItem } from '../../core/models';
import { NotificationService } from '../../core/notifications/notification.service';
import { BadgeComponent, BadgeVariant } from '../../shared/ui/badge.component';
import { CardComponent } from '../../shared/ui/card.component';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ListSkeletonComponent } from '../../shared/ui/list-skeleton.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { UserService } from '../users/user.service';
import {
  DelegationDialogInput,
  DelegationFormDialogComponent,
} from './delegation-form-dialog.component';
import { DelegationService } from './delegation.service';

type DelegationStatus = 'active' | 'scheduled' | 'expired' | 'revoked';

/**
 * Self-service permission delegations (FRONTEND_PLAN §2.12): the caller's outgoing delegations, with create
 * and revoke. When the caller can list users, delegate names resolve from that list and the create dialog
 * offers a dropdown; otherwise it falls back to entering a user id.
 */
@Component({
  selector: 'app-delegations-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    PageHeaderComponent,
    CardComponent,
    ListSkeletonComponent,
    EmptyStateComponent,
    BadgeComponent,
    ConfirmDialogComponent,
    DelegationFormDialogComponent,
  ],
  template: `
    <div class="mx-auto max-w-3xl">
      <app-page-header
        [title]="'delegations.title' | transloco"
        [subtitle]="'delegations.subtitle' | transloco"
      >
        <div actions>
          <button type="button" class="btn btn-primary" (click)="openCreate()">
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                d="M10 5a.75.75 0 0 1 .75.75v3.5h3.5a.75.75 0 0 1 0 1.5h-3.5v3.5a.75.75 0 0 1-1.5 0v-3.5h-3.5a.75.75 0 0 1 0-1.5h3.5v-3.5A.75.75 0 0 1 10 5Z"
              />
            </svg>
            {{ 'delegations.new' | transloco }}
          </button>
        </div>
      </app-page-header>

      <app-card [padding]="false">
        <div class="p-2 sm:p-3">
          @if (loading()) {
            <app-list-skeleton [rows]="4" />
          } @else if (loadError()) {
            <app-empty-state [title]="'delegations.loadError' | transloco">
              <button type="button" class="btn btn-secondary" (click)="load()">
                {{ 'common.retry' | transloco }}
              </button>
            </app-empty-state>
          } @else if (delegations().length === 0) {
            <app-empty-state
              [title]="'delegations.empty' | transloco"
              [description]="'delegations.emptyHint' | transloco"
            />
          } @else {
            <ul class="divide-y divide-gray-100 dark:divide-gray-800">
              @for (d of delegations(); track d.id) {
                <li
                  animate.enter="list-item-enter"
                  animate.leave="list-item-leave"
                  class="flex items-center justify-between gap-4 px-2 py-3"
                >
                  <div class="min-w-0">
                    <p
                      class="flex items-center gap-2 text-theme-sm font-medium text-gray-700 dark:text-gray-200"
                    >
                      {{ 'delegations.to' | transloco }} {{ nameFor(d.delegatedToId) }}
                      <app-badge [variant]="statusVariant(d)">{{
                        'delegations.status.' + status(d) | transloco
                      }}</app-badge>
                    </p>
                    <p class="mt-0.5 truncate text-theme-xs text-gray-500 dark:text-gray-400">
                      {{ d.permissionSet.length }}
                      {{ 'delegations.permissionsCount' | transloco }} · {{ fmt(d.startsAt) }} →
                      {{ fmt(d.expiresAt) }}
                    </p>
                  </div>
                  @if (!d.isRevoked) {
                    <button
                      type="button"
                      class="btn btn-secondary px-3 py-1.5"
                      (click)="pendingRevoke.set(d)"
                    >
                      {{ 'delegations.revoke' | transloco }}
                    </button>
                  }
                </li>
              }
            </ul>
          }
        </div>
      </app-card>
    </div>

    @if (dialog(); as input) {
      <app-delegation-form-dialog [data]="input" (saved)="onSaved()" (closed)="closeDialog()" />
    }

    @if (pendingRevoke(); as d) {
      <app-confirm-dialog
        [title]="'delegations.revokeTitle' | transloco"
        [message]="'delegations.revokeConfirm' | transloco: { name: nameFor(d.delegatedToId) }"
        [confirmLabel]="'delegations.revoke' | transloco"
        [danger]="true"
        [busy]="revoking()"
        (confirmed)="revoke(d)"
        (cancelled)="pendingRevoke.set(null)"
      />
    }
  `,
})
export class DelegationsPageComponent {
  private readonly service = inject(DelegationService);
  private readonly users = inject(UserService);
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(TranslocoService);
  private readonly locale = inject(LocaleService);

  protected readonly delegations = signal<Delegation[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly dialog = signal<DelegationDialogInput | null>(null);
  protected readonly pendingRevoke = signal<Delegation | null>(null);
  protected readonly revoking = signal(false);

  private readonly canListUsers = this.auth.hasPermission(Permissions.users.list);
  private readonly userList = signal<UserListItem[]>([]);
  private readonly userMap = computed(
    () => new Map(this.userList().map((u) => [u.id, u.fullName])),
  );

  constructor() {
    if (this.canListUsers) {
      this.users.list({ pageNumber: 1, pageSize: 200 }).subscribe({
        next: (page) => this.userList.set(page.items),
        error: () => undefined,
      });
    }
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.service.list().subscribe({
      next: (list) => {
        this.delegations.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  protected openCreate(): void {
    this.dialog.set({ users: this.userList(), canListUsers: this.canListUsers });
  }

  protected closeDialog(): void {
    this.dialog.set(null);
  }

  protected onSaved(): void {
    this.closeDialog();
    this.notify.success(this.i18n.translate('delegations.created'));
    this.load();
  }

  /**
   * Optimistic revoke: remove the delegation from the list immediately (it animates out) and close the
   * dialog, then call the server. On failure, restore the list and surface the reason.
   */
  protected revoke(delegation: Delegation): void {
    const snapshot = this.delegations();
    this.delegations.update((list) => list.filter((d) => d.id !== delegation.id));
    this.pendingRevoke.set(null);
    this.service.remove(delegation.id).subscribe({
      next: () => this.notify.success(this.i18n.translate('delegations.revoked')),
      error: (err: AppError) => {
        this.delegations.set(snapshot);
        this.notify.error(err?.detail || this.i18n.translate('common.actionFailed'));
      },
    });
  }

  protected nameFor(id: string): string {
    return this.userMap().get(id) ?? id;
  }

  protected status(d: Delegation): DelegationStatus {
    if (d.isRevoked) {
      return 'revoked';
    }
    const now = Date.now();
    if (new Date(d.expiresAt).getTime() < now) {
      return 'expired';
    }
    if (new Date(d.startsAt).getTime() > now) {
      return 'scheduled';
    }
    return 'active';
  }

  protected statusVariant(d: Delegation): BadgeVariant {
    switch (this.status(d)) {
      case 'active':
        return 'success';
      case 'scheduled':
        return 'info';
      default:
        return 'neutral';
    }
  }

  protected fmt(date: string): string {
    return new Date(date).toLocaleString(this.locale.culture());
  }
}

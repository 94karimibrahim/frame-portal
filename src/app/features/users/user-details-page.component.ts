import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { Permissions } from '../../core/auth/permissions';
import { LocaleService } from '../../core/i18n/locale.service';
import { GENDER_LABEL, RoleListItem, USER_STATUS_LABEL, User } from '../../core/models';
import { NotificationService } from '../../core/notifications/notification.service';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { CardComponent } from '../../shared/ui/card.component';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { SpinnerComponent } from '../../shared/ui/spinner.component';
import { initials } from '../account/initials.util';
import { UserRolesDialogComponent } from './user-roles-dialog.component';
import { userStatusVariant } from './user-status.util';
import { UserService } from './user.service';

/**
 * Read-only user detail **page** (replaces the former slide-over drawer). Reads `:id` from the route, loads
 * the full profile + assigned roles, and hosts the same secondary actions the drawer did — but as inline
 * confirm dialogs (reset/delete) and the shared manage-roles dialog. Edit routes to the dedicated edit page;
 * a successful delete returns to the list. Everything is derived from the fetched {@link User} so the page
 * also works on a hard refresh / deep link, where no list row is in memory.
 */
@Component({
  selector: 'app-user-details-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    HasPermissionDirective,
    PageHeaderComponent,
    CardComponent,
    BadgeComponent,
    SpinnerComponent,
    EmptyStateComponent,
    ConfirmDialogComponent,
    UserRolesDialogComponent,
  ],
  template: `
    <app-page-header [title]="'users.detailTitle' | transloco">
      <div actions>
        <button type="button" class="btn btn-secondary" (click)="back()">
          {{ 'common.back' | transloco }}
        </button>
      </div>
    </app-page-header>

    @if (loadingUser()) {
      <div class="flex justify-center py-16"><app-spinner size="lg" /></div>
    } @else if (user(); as u) {
      <app-card>
        <div class="flex items-center gap-4">
          <span
            class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-theme-lg font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
            aria-hidden="true"
          >
            {{ avatar() }}
          </span>
          <div class="min-w-0">
            <p class="truncate text-theme-md font-semibold text-gray-900 dark:text-white">
              {{ u.fullName }}
            </p>
            <p class="truncate text-theme-sm text-gray-500 dark:text-gray-400">{{ u.email }}</p>
            <span class="mt-1.5 inline-flex flex-wrap items-center gap-1.5">
              <app-badge [variant]="statusVariant()">{{ statusLabel() | transloco }}</app-badge>
              @if (u.isLockedOut) {
                <app-badge variant="error" [attr.title]="lockedTitle(u)">{{
                  'users.locked' | transloco
                }}</app-badge>
              }
              @if (u.isSystem) {
                <app-badge variant="neutral">{{ 'users.systemUser' | transloco }}</app-badge>
              }
            </span>
          </div>
        </div>

        <dl class="mt-6 space-y-4">
          <div>
            <dt class="text-theme-xs font-medium uppercase tracking-wide text-gray-400">
              {{ 'users.roles' | transloco }}
            </dt>
            <dd class="mt-1.5 flex flex-wrap gap-1.5">
              @if (loadingRoles()) {
                <app-spinner size="sm" />
              } @else {
                @for (role of roles(); track role.id) {
                  <app-badge variant="neutral">{{ role.name }}</app-badge>
                } @empty {
                  <span class="text-theme-sm text-gray-500 dark:text-gray-400">{{
                    'profile.noRoles' | transloco
                  }}</span>
                }
              }
            </dd>
          </div>

          @for (row of facts(u); track row.label) {
            @if (row.value) {
              <div class="grid grid-cols-3 gap-2">
                <dt class="text-theme-xs font-medium uppercase tracking-wide text-gray-400">
                  {{ row.label | transloco }}
                </dt>
                <dd class="col-span-2 text-theme-sm text-gray-700 dark:text-gray-200">
                  {{ row.value }}
                </dd>
              </div>
            }
          }
        </dl>

        <div
          class="mt-8 flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-5 dark:border-gray-800"
        >
          <button
            *appHasPermission="rolesAssign"
            type="button"
            class="btn btn-secondary"
            (click)="rolesOpen.set(true)"
          >
            {{ 'users.manageRoles' | transloco }}
          </button>
          @if (u.isLockedOut) {
            <button
              *appHasPermission="perms.update"
              type="button"
              class="btn btn-secondary disabled:cursor-not-allowed disabled:opacity-40"
              [disabled]="guarded()"
              [attr.title]="guardTitle()"
              (click)="unlockOpen.set(true)"
            >
              {{ 'users.unlock' | transloco }}
            </button>
          }
          <button
            *appHasPermission="perms.managePassword"
            type="button"
            class="btn btn-secondary disabled:cursor-not-allowed disabled:opacity-40"
            [disabled]="guarded()"
            [attr.title]="guardTitle()"
            (click)="resetOpen.set(true)"
          >
            {{ 'users.resetPassword' | transloco }}
          </button>
          <button
            *appHasPermission="perms.delete"
            type="button"
            class="btn btn-danger disabled:cursor-not-allowed disabled:opacity-40"
            [disabled]="guarded()"
            [attr.title]="guardTitle()"
            (click)="deleteOpen.set(true)"
          >
            {{ 'common.delete' | transloco }}
          </button>
          <button
            *appHasPermission="perms.update"
            type="button"
            class="btn btn-primary"
            (click)="edit()"
          >
            {{ 'common.edit' | transloco }}
          </button>
        </div>
      </app-card>

      @if (rolesOpen()) {
        <app-user-roles-dialog
          [data]="{ userId: u.id, userName: u.fullName }"
          (saved)="onRolesSaved()"
          (closed)="rolesOpen.set(false)"
        />
      }

      @if (unlockOpen()) {
        <app-confirm-dialog
          [title]="'users.unlockTitle' | transloco"
          [message]="'users.unlockConfirm' | transloco: { name: u.fullName }"
          [confirmLabel]="'users.unlock' | transloco"
          [busy]="unlocking()"
          (confirmed)="confirmUnlock()"
          (cancelled)="unlockOpen.set(false)"
        />
      }

      @if (resetOpen()) {
        <app-confirm-dialog
          [title]="'users.resetPasswordTitle' | transloco"
          [message]="'users.resetPasswordConfirm' | transloco: { name: u.fullName }"
          [confirmLabel]="'users.resetPassword' | transloco"
          [busy]="resetting()"
          (confirmed)="confirmReset()"
          (cancelled)="resetOpen.set(false)"
        />
      }

      @if (deleteOpen()) {
        <app-confirm-dialog
          [title]="'users.deleteTitle' | transloco"
          [message]="'users.deleteConfirm' | transloco: { name: u.fullName }"
          [confirmLabel]="'common.delete' | transloco"
          [danger]="true"
          [busy]="deleting()"
          (confirmed)="confirmDelete()"
          (cancelled)="deleteOpen.set(false)"
        />
      }
    } @else {
      <app-empty-state [title]="'users.detailError' | transloco">
        <button type="button" class="btn btn-secondary" (click)="back()">
          {{ 'common.back' | transloco }}
        </button>
      </app-empty-state>
    }
  `,
})
export class UserDetailsPageComponent {
  private readonly service = inject(UserService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(TranslocoService);
  private readonly locale = inject(LocaleService);
  private readonly auth = inject(AuthService);

  protected readonly perms = Permissions.users;
  protected readonly rolesAssign = Permissions.roles.assign;

  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  protected readonly user = signal<User | null>(null);
  protected readonly roles = signal<RoleListItem[]>([]);
  protected readonly loadingUser = signal(true);
  protected readonly loadingRoles = signal(true);

  protected readonly rolesOpen = signal(false);
  protected readonly unlockOpen = signal(false);
  protected readonly resetOpen = signal(false);
  protected readonly deleteOpen = signal(false);
  protected readonly unlocking = signal(false);
  protected readonly resetting = signal(false);
  protected readonly deleting = signal(false);

  protected readonly avatar = computed(() => initials(this.user()?.fullName ?? ''));
  protected readonly statusLabel = computed(() => {
    const u = this.user();
    return u ? USER_STATUS_LABEL[u.status] : '';
  });
  protected readonly statusVariant = computed(() => {
    const u = this.user();
    return u ? userStatusVariant(u.status) : 'neutral';
  });

  constructor() {
    if (this.id) {
      this.load();
    } else {
      this.loadingUser.set(false);
      this.loadingRoles.set(false);
    }
  }

  private load(): void {
    this.service.get(this.id).subscribe({
      next: (u) => {
        this.user.set(u);
        this.loadingUser.set(false);
      },
      error: () => this.loadingUser.set(false),
    });
    this.service.getRoles(this.id).subscribe({
      next: (r) => {
        this.roles.set(r);
        this.loadingRoles.set(false);
      },
      error: () => this.loadingRoles.set(false),
    });
  }

  /** True when this is a protected system account or the caller's own account (admin actions blocked). */
  protected guarded(): boolean {
    const u = this.user();
    return !!u && (u.isSystem || u.id === this.auth.identity()?.userId);
  }

  /** Tooltip explaining why an admin action is blocked, or `null` when it is allowed. */
  protected guardTitle(): string | null {
    const u = this.user();
    if (!u) {
      return null;
    }
    if (u.isSystem) {
      return this.i18n.translate('users.systemUserHint');
    }
    if (u.id === this.auth.identity()?.userId) {
      return this.i18n.translate('users.selfActionHint');
    }
    return null;
  }

  /** Profile facts shown below the roles; falsy values are skipped in the template. */
  protected facts(u: User): { label: string; value: string }[] {
    return [
      { label: 'users.phoneNumber', value: u.phoneNumber ?? '' },
      {
        label: 'users.gender',
        value:
          u.gender === null || u.gender === undefined
            ? ''
            : this.i18n.translate(GENDER_LABEL[u.gender]),
      },
      { label: 'users.country', value: u.country ?? '' },
      { label: 'users.city', value: u.city ?? '' },
      { label: 'users.lastLogin', value: this.fmt(u.lastLoginAt) },
      { label: 'users.createdAt', value: this.fmt(u.createdAt) },
    ];
  }

  private fmt(date: string | null | undefined): string {
    return date ? new Date(date).toLocaleString(this.locale.culture()) : '';
  }

  protected back(): void {
    this.router.navigate(['/users']);
  }

  protected edit(): void {
    this.router.navigate(['/users', this.id, 'edit']);
  }

  protected onRolesSaved(): void {
    this.rolesOpen.set(false);
    this.notify.success(this.i18n.translate('users.rolesUpdated'));
    // Refresh the visible role badges after a change.
    this.loadingRoles.set(true);
    this.service.getRoles(this.id).subscribe({
      next: (r) => {
        this.roles.set(r);
        this.loadingRoles.set(false);
      },
      error: () => this.loadingRoles.set(false),
    });
  }

  protected confirmUnlock(): void {
    const u = this.user();
    if (!u) {
      return;
    }
    this.unlocking.set(true);
    this.service.unlock(u.id).subscribe({
      next: () => {
        this.unlocking.set(false);
        this.unlockOpen.set(false);
        // Reflect the cleared lockout locally so the Locked badge + Unlock button drop away.
        this.user.update((current) =>
          current ? { ...current, isLockedOut: false, lockoutEnd: null } : current,
        );
        this.notify.success(this.i18n.translate('users.unlocked', { name: u.fullName }));
      },
      error: () => this.unlocking.set(false),
    });
  }

  /** Tooltip for the Locked badge: the lockout expiry when the backend provides one. */
  protected lockedTitle(u: User): string | null {
    return u.lockoutEnd
      ? this.i18n.translate('users.lockedUntil', {
          until: new Date(u.lockoutEnd).toLocaleString(this.locale.culture()),
        })
      : null;
  }

  protected confirmReset(): void {
    const u = this.user();
    if (!u) {
      return;
    }
    this.resetting.set(true);
    this.service.resetPassword(u.id).subscribe({
      next: () => {
        this.resetting.set(false);
        this.resetOpen.set(false);
        this.notify.success(this.i18n.translate('users.resetPasswordDone', { name: u.fullName }));
      },
      error: () => this.resetting.set(false),
    });
  }

  protected confirmDelete(): void {
    const u = this.user();
    if (!u) {
      return;
    }
    this.deleting.set(true);
    this.service.remove(u.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteOpen.set(false);
        this.notify.success(this.i18n.translate('users.deleted'));
        this.router.navigate(['/users']);
      },
      error: () => this.deleting.set(false),
    });
  }
}

import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { Permissions } from '../../core/auth/permissions';
import { LocaleService } from '../../core/i18n/locale.service';
import {
  GENDER_LABEL,
  RoleListItem,
  USER_STATUS_LABEL,
  User,
  UserListItem,
} from '../../core/models';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { DrawerComponent } from '../../shared/ui/drawer.component';
import { SpinnerComponent } from '../../shared/ui/spinner.component';
import { initials } from '../account/initials.util';
import { userStatusVariant } from './user-status.util';
import { UserService } from './user.service';

/**
 * Read-only user detail slide-over. Shows an instant header from the list row, then loads the full
 * profile + assigned roles. Action buttons are permission-gated and emit up to the page (which owns the
 * edit drawer, roles dialog, unlock, and delete confirm) so this stays presentational.
 */
@Component({
  selector: 'app-user-detail-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    HasPermissionDirective,
    DrawerComponent,
    BadgeComponent,
    SpinnerComponent,
  ],
  template: `
    <app-drawer
      [title]="'users.detailTitle' | transloco"
      widthClass="max-w-md"
      (closed)="closed.emit()"
    >
      <div class="flex items-center gap-4">
        <span
          class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-theme-lg font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
          aria-hidden="true"
        >
          {{ avatar() }}
        </span>
        <div class="min-w-0">
          <p class="truncate text-theme-md font-semibold text-gray-900 dark:text-white">
            {{ user().fullName }}
          </p>
          <p class="truncate text-theme-sm text-gray-500 dark:text-gray-400">{{ user().email }}</p>
          <span class="mt-1.5 inline-flex flex-wrap items-center gap-1.5">
            <app-badge [variant]="statusVariant()">{{ statusLabel() | transloco }}</app-badge>
            @if (user().isSystem) {
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

        @if (loadingUser()) {
          <div class="flex justify-center py-4"><app-spinner /></div>
        } @else if (full(); as u) {
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
        }
      </dl>

      <div drawerfooter class="flex flex-wrap items-center justify-end gap-2">
        <button
          *appHasPermission="rolesAssign"
          type="button"
          class="btn btn-secondary"
          (click)="manageRoles.emit(user())"
        >
          {{ 'users.manageRoles' | transloco }}
        </button>
        <button
          *appHasPermission="perms.update"
          type="button"
          class="btn btn-secondary disabled:cursor-not-allowed disabled:opacity-40"
          [disabled]="guarded()"
          [attr.title]="guardTitle()"
          (click)="unlock.emit(user())"
        >
          {{ 'users.unlock' | transloco }}
        </button>
        <button
          *appHasPermission="perms.managePassword"
          type="button"
          class="btn btn-secondary disabled:cursor-not-allowed disabled:opacity-40"
          [disabled]="guarded()"
          [attr.title]="guardTitle()"
          (click)="resetPassword.emit(user())"
        >
          {{ 'users.resetPassword' | transloco }}
        </button>
        <button
          *appHasPermission="perms.delete"
          type="button"
          class="btn btn-danger disabled:cursor-not-allowed disabled:opacity-40"
          [disabled]="guarded()"
          [attr.title]="guardTitle()"
          (click)="remove.emit(user())"
        >
          {{ 'common.delete' | transloco }}
        </button>
        <button
          *appHasPermission="perms.update"
          type="button"
          class="btn btn-primary"
          (click)="edit.emit(user())"
        >
          {{ 'common.edit' | transloco }}
        </button>
      </div>
    </app-drawer>
  `,
})
export class UserDetailDrawerComponent {
  private readonly service = inject(UserService);
  private readonly i18n = inject(TranslocoService);
  private readonly locale = inject(LocaleService);
  private readonly auth = inject(AuthService);

  readonly user = input.required<UserListItem>();
  readonly edit = output<UserListItem>();
  readonly manageRoles = output<UserListItem>();
  readonly unlock = output<UserListItem>();
  readonly resetPassword = output<UserListItem>();
  readonly remove = output<UserListItem>();
  readonly closed = output<void>();

  protected readonly perms = Permissions.users;
  protected readonly rolesAssign = Permissions.roles.assign;

  /** True when this is a protected system account or the caller's own account (admin actions blocked). */
  protected guarded(): boolean {
    return this.user().isSystem || this.user().id === this.auth.identity()?.userId;
  }

  /** Tooltip explaining why an admin action is blocked, or `null` when it is allowed. */
  protected guardTitle(): string | null {
    if (this.user().isSystem) {
      return this.i18n.translate('users.systemUserHint');
    }
    if (this.user().id === this.auth.identity()?.userId) {
      return this.i18n.translate('users.selfActionHint');
    }
    return null;
  }

  protected readonly full = signal<User | null>(null);
  protected readonly roles = signal<RoleListItem[]>([]);
  protected readonly loadingUser = signal(true);
  protected readonly loadingRoles = signal(true);

  protected readonly avatar = () => initials(this.user().fullName);
  protected readonly statusLabel = () => USER_STATUS_LABEL[this.user().status];
  protected readonly statusVariant = () => userStatusVariant(this.user().status);

  constructor() {
    // Load once when the drawer mounts; the page recreates the component per selected user.
    queueMicrotask(() => this.load());
  }

  private load(): void {
    const id = this.user().id;
    this.service.get(id).subscribe({
      next: (u) => {
        this.full.set(u);
        this.loadingUser.set(false);
      },
      error: () => this.loadingUser.set(false),
    });
    this.service.getRoles(id).subscribe({
      next: (r) => {
        this.roles.set(r);
        this.loadingRoles.set(false);
      },
      error: () => this.loadingRoles.set(false),
    });
  }

  /** Profile facts shown when the full record is loaded; falsy values are skipped in the template. */
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
}

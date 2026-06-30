import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { CardComponent } from '../../shared/ui/card.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { initials } from './initials.util';

/**
 * Self profile (FRONTEND_PLAN Q3): rendered entirely from the in-memory identity (AuthResult + JWT claims),
 * since there is no `/users/me` and a normal user may lack `users.view`. Read-only — roles come from the JWT
 * `role` claims. Quick links lead to the editable areas (preferences, security).
 */
@Component({
  selector: 'app-profile-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoModule, BadgeComponent, PageHeaderComponent, CardComponent],
  template: `
    <div class="mx-auto max-w-3xl">
      <app-page-header [title]="'profile.title' | transloco" />

      @if (identity(); as me) {
        <app-card>
          <div class="flex items-center gap-4">
            <span
              class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-brand-50 text-title-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
              aria-hidden="true"
            >
              {{ avatarInitials() }}
            </span>
            <div class="min-w-0">
              <p class="truncate text-theme-lg font-semibold text-gray-900 dark:text-white">
                {{ me.fullName }}
              </p>
              <p class="truncate text-theme-sm text-gray-500 dark:text-gray-400">{{ me.email }}</p>
              @if (me.isSuperAdmin) {
                <span class="mt-1 inline-block"
                  ><app-badge variant="info">{{
                    'profile.superAdmin' | transloco
                  }}</app-badge></span
                >
              }
            </div>
          </div>

          <dl class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt class="text-theme-xs font-medium uppercase tracking-wide text-gray-400">
                {{ 'profile.roles' | transloco }}
              </dt>
              <dd class="mt-1.5 flex flex-wrap gap-1.5">
                @for (role of me.roles; track role) {
                  <app-badge variant="neutral">{{ role }}</app-badge>
                } @empty {
                  <span class="text-theme-sm text-gray-500 dark:text-gray-400">{{
                    'profile.noRoles' | transloco
                  }}</span>
                }
              </dd>
            </div>
            <div>
              <dt class="text-theme-xs font-medium uppercase tracking-wide text-gray-400">
                {{ 'profile.tenant' | transloco }}
              </dt>
              <dd class="mt-1.5 text-theme-sm text-gray-700 dark:text-gray-200">
                {{ me.tenantId || '—' }}
              </dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-theme-xs font-medium uppercase tracking-wide text-gray-400">
                {{ 'profile.userId' | transloco }}
              </dt>
              <dd class="mt-1.5 break-all font-mono text-theme-xs text-gray-500 dark:text-gray-400">
                {{ me.userId }}
              </dd>
            </div>
          </dl>

          <div class="mt-6 flex flex-wrap gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
            <a routerLink="/account/preferences" class="btn btn-secondary">{{
              'nav.preferences' | transloco
            }}</a>
            <a routerLink="/account/security" class="btn btn-secondary">{{
              'nav.security' | transloco
            }}</a>
          </div>
        </app-card>
      }
    </div>
  `,
})
export class ProfilePageComponent {
  private readonly auth = inject(AuthService);

  protected readonly identity = this.auth.identity;
  protected readonly avatarInitials = computed(() => initials(this.identity()?.fullName ?? ''));
}

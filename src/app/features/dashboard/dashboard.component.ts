import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { Permissions } from '../../core/auth/permissions';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { CardComponent } from '../../shared/ui/card.component';
import { CardGridSkeletonComponent } from '../../shared/ui/card-grid-skeleton.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ICONS } from '../../shared/icons';

/**
 * Authenticated landing page. Greets the signed-in user, then surfaces permission-gated quick links
 * into the management areas plus always-available account shortcuts. Deliberately **data-light and
 * honest** — there is no metrics/stats API, so it shows real navigation and explicit empty states
 * rather than fabricated KPIs; real widgets arrive once their backing features exist.
 */
@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    TranslocoModule,
    HasPermissionDirective,
    CardComponent,
    CardGridSkeletonComponent,
    EmptyStateComponent,
  ],
  template: `
    <!-- Welcome hero -->
    <section
      class="overflow-hidden rounded-theme-lg bg-linear-to-br from-brand-500 to-brand-700 p-6 text-white shadow-theme-sm sm:p-8"
    >
      <h1 class="text-title-md font-semibold">
        {{ 'dashboard.greeting' | transloco: { name: auth.identity()?.fullName } }}
      </h1>
      <p class="mt-1 max-w-2xl text-theme-sm text-white/80">
        {{ 'dashboard.subtitle' | transloco }}
      </p>
    </section>

    <!-- Quick links into management areas (permission-gated) -->
    <h2
      class="mt-8 text-theme-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
    >
      {{ 'dashboard.quickLinksTitle' | transloco }}
    </h2>
    <div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      @for (link of quickLinks; track link.link) {
        <a *appHasPermission="link.permissions" [routerLink]="link.link" class="block">
          <app-card [interactive]="true">
            <div class="flex items-start gap-4">
              <span
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-theme-lg bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400"
              >
                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path [attr.d]="icons[link.icon]" fill-rule="evenodd" clip-rule="evenodd" />
                </svg>
              </span>
              <div class="min-w-0">
                <p class="text-theme-sm font-medium text-gray-800 dark:text-gray-100">
                  {{ link.labelKey | transloco }}
                </p>
                <p class="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
                  {{ link.hintKey | transloco }}
                </p>
              </div>
              <svg
                class="ms-auto h-5 w-5 shrink-0 text-gray-300 rtl:rotate-180 dark:text-gray-600"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path [attr.d]="icons.chevron" fill-rule="evenodd" clip-rule="evenodd" />
              </svg>
            </div>
          </app-card>
        </a>
      }
    </div>

    <!--
      The fold-line panels render after the browser settles the critical content. They carry no
      time-sensitive data, so @defer keeps them off the first paint and shows a matching skeleton.
    -->
    @defer (on idle) {
      <div class="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <!-- Getting started: always-available account shortcuts -->
        <app-card class="block lg:col-span-1" [padding]="false">
          <div card-header>
            <h2 class="text-theme-sm font-semibold text-gray-800 dark:text-gray-100">
              {{ 'dashboard.gettingStartedTitle' | transloco }}
            </h2>
            <p class="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
              {{ 'dashboard.gettingStartedHint' | transloco }}
            </p>
          </div>
          <ul class="divide-y divide-gray-100 dark:divide-gray-800">
            @for (item of accountLinks; track item.link) {
              <li>
                <a
                  [routerLink]="item.link"
                  class="flex items-center gap-3 px-5 py-3.5 transition hover:bg-gray-50 dark:hover:bg-gray-800/60"
                >
                  <span
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-theme-md bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                  >
                    <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path [attr.d]="icons[item.icon]" fill-rule="evenodd" clip-rule="evenodd" />
                    </svg>
                  </span>
                  <span class="text-theme-sm font-medium text-gray-700 dark:text-gray-200">
                    {{ item.labelKey | transloco }}
                  </span>
                  <svg
                    class="ms-auto h-5 w-5 shrink-0 text-gray-300 rtl:rotate-180 dark:text-gray-600"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path [attr.d]="icons.chevron" fill-rule="evenodd" clip-rule="evenodd" />
                  </svg>
                </a>
              </li>
            }
          </ul>
        </app-card>

        <!-- Recent activity: honest empty state until a feed API exists -->
        <app-card class="block lg:col-span-2" [padding]="false">
          <div card-header>
            <h2 class="text-theme-sm font-semibold text-gray-800 dark:text-gray-100">
              {{ 'dashboard.activityTitle' | transloco }}
            </h2>
          </div>
          <app-empty-state
            [title]="'dashboard.activityEmptyTitle' | transloco"
            [description]="'dashboard.activityEmptyDesc' | transloco"
          />
        </app-card>
      </div>
    } @placeholder {
      <div class="mt-8">
        <app-card-grid-skeleton [cards]="2" [lines]="3" />
      </div>
    }
  `,
})
export class DashboardComponent {
  protected readonly auth = inject(AuthService);
  protected readonly icons = ICONS;

  /** Management destinations, each revealed only when the user holds the listed permission. */
  protected readonly quickLinks = [
    {
      link: '/users',
      icon: 'users',
      labelKey: 'nav.users',
      hintKey: 'dashboard.usersHint',
      permissions: [Permissions.users.list],
    },
    {
      link: '/roles',
      icon: 'roles',
      labelKey: 'nav.roles',
      hintKey: 'dashboard.rolesHint',
      permissions: [Permissions.roles.list],
    },
    {
      link: '/departments',
      icon: 'departments',
      labelKey: 'nav.departments',
      hintKey: 'dashboard.departmentsHint',
      permissions: [Permissions.departments.view],
    },
  ] as const;

  /** Self-service account areas — always available, no permission gating. */
  protected readonly accountLinks = [
    { link: '/account/profile', icon: 'profile', labelKey: 'nav.profile' },
    { link: '/account/security', icon: 'security', labelKey: 'nav.security' },
    { link: '/account/preferences', icon: 'preferences', labelKey: 'nav.preferences' },
  ] as const;
}

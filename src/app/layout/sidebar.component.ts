import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../core/auth/auth.service';
import { NAV, NavGroup } from './nav.model';
import { LayoutService } from './layout.service';

/**
 * Authenticated navigation rail. Renders {@link NAV} filtered to the items the signed-in user may reach
 * (super-admin sees all), grouped under section headings. Collapses to an icon-only mini rail on desktop
 * (`LayoutService.collapsed`) and slides off-canvas on mobile (`LayoutService.mobileOpen`); both use
 * logical properties so RTL mirrors correctly. Selecting a link closes the mobile drawer.
 *
 * Class names that carry `:` / `/` (variant/opacity) live in `[ngClass]` objects rather than
 * `[class.x]` bindings, whose keys can't contain those characters.
 */
@Component({
  selector: 'app-sidebar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, RouterLink, RouterLinkActive, TranslocoModule],
  template: `
    <aside
      class="custom-scrollbar fixed inset-y-0 start-0 z-50 flex flex-col overflow-y-auto border-e border-gray-200 bg-white transition-all duration-300 ease-in-out dark:border-gray-800 dark:bg-gray-dark lg:sticky lg:top-0 lg:h-screen lg:translate-x-0"
      [ngClass]="{
        'w-72': !layout.collapsed(),
        'lg:w-20': layout.collapsed(),
        'translate-x-0': layout.mobileOpen(),
        'max-lg:-translate-x-full max-lg:rtl:translate-x-full': !layout.mobileOpen(),
      }"
    >
      <div
        class="flex h-16 items-center gap-3 border-b border-gray-100 px-6 dark:border-gray-800"
        [ngClass]="{ 'lg:justify-center lg:px-0': layout.collapsed() }"
      >
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-theme-lg bg-brand-500 text-base font-bold text-white shadow-theme-sm"
        >
          F
        </span>
        @if (!layout.collapsed()) {
          <span class="truncate text-title-sm font-semibold text-gray-900 dark:text-white">
            {{ 'common.appName' | transloco }}
          </span>
        }
      </div>

      <nav class="flex-1 px-4 pb-6 pt-2">
        @for (group of groups(); track group.labelKey || $index) {
          <div class="mt-6 first:mt-2">
            @if (group.labelKey && !layout.collapsed()) {
              <p
                class="mb-2 px-2 text-theme-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"
              >
                {{ group.labelKey | transloco }}
              </p>
            }
            <ul class="flex flex-col gap-1">
              @for (item of group.items; track item.link) {
                <li>
                  <a
                    [routerLink]="item.link"
                    routerLinkActive="bg-brand-50 font-semibold text-brand-600 before:absolute before:inset-y-1.5 before:start-0 before:w-1 before:rounded-e-full before:bg-brand-500 before:content-[''] dark:bg-brand-500/10 dark:text-brand-400"
                    class="group relative flex items-center gap-3 rounded-theme-md px-3 py-2.5 text-theme-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
                    [ngClass]="{ 'lg:justify-center': layout.collapsed() }"
                    [attr.title]="layout.collapsed() ? (item.labelKey | transloco) : null"
                    (click)="layout.closeMobile()"
                  >
                    <svg
                      class="h-5 w-5 shrink-0 opacity-70 transition group-hover:opacity-100"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path [attr.d]="item.icon" fill-rule="evenodd" clip-rule="evenodd" />
                    </svg>
                    @if (!layout.collapsed()) {
                      <span class="truncate">{{ item.labelKey | transloco }}</span>
                    }
                  </a>
                </li>
              }
            </ul>
          </div>
        }
      </nav>
    </aside>
  `,
})
export class SidebarComponent {
  protected readonly layout = inject(LayoutService);
  private readonly auth = inject(AuthService);

  /** The nav, filtered to items the user can reach; empty groups (after filtering) are dropped. */
  protected readonly groups = computed<NavGroup[]>(() => {
    // Read the permission signal so the menu re-filters after login / switch-tenant.
    this.auth.permissions();
    return NAV.map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.permissions || this.auth.hasAny(item.permissions)),
    })).filter((group) => group.items.length > 0);
  });
}

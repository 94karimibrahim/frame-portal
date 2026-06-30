import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../core/auth/auth.service';
import { CommandPaletteService } from '../core/command-palette/command-palette.service';
import { LocaleService } from '../core/i18n/locale.service';
import { ThemeMode, ThemeService } from '../core/theme/theme.service';
import { BadgeComponent } from '../shared/ui/badge.component';
import { BreadcrumbComponent } from './breadcrumb.component';
import { LayoutService } from './layout.service';

/**
 * Authenticated top bar: sidebar toggles (hamburger on mobile, collapse on desktop), language and theme
 * switches, and the user menu (identity + profile link + sign-out). The user menu is a lightweight
 * signal-driven dropdown with a click-catching backdrop; it will move onto the CDK overlay when the
 * shared UI kit's menu primitive lands.
 */
@Component({
  selector: 'app-topbar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // The sticky positioning lives on the host (not the inner <header>): a sticky element only stays
  // pinned while its parent box is in view, and the host's parent is the tall content column — whereas
  // the host itself is just header-height, so a sticky <header> would un-stick after one bar of scroll.
  host: { class: 'sticky top-0 z-40' },
  imports: [RouterLink, TranslocoModule, CdkTrapFocus, BadgeComponent, BreadcrumbComponent],
  template: `
    <header
      class="flex h-16 items-center gap-2 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-dark sm:px-6"
    >
      <!-- Mobile: open drawer -->
      <button
        type="button"
        class="rounded-theme-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 lg:hidden"
        [attr.aria-label]="'shell.openMenu' | transloco"
        (click)="layout.toggleMobile()"
      >
        <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <!-- Desktop: collapse rail -->
      <button
        type="button"
        class="hidden rounded-theme-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 lg:inline-flex"
        [attr.aria-label]="'shell.toggleSidebar' | transloco"
        [attr.aria-pressed]="layout.collapsed()"
        (click)="layout.toggleCollapsed()"
      >
        <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h10M4 18h16" />
        </svg>
      </button>

      <!-- Location breadcrumb (hidden on the smallest screens to keep the bar uncluttered) -->
      <app-breadcrumb class="hidden min-w-0 ps-1 sm:block" />

      <div class="flex-1"></div>

      <!-- Command palette trigger (also opens on ⌘K / Ctrl-K) -->
      <button
        type="button"
        class="hidden items-center gap-2 rounded-theme-md border border-gray-200 px-3 py-1.5 text-theme-sm text-gray-400 transition hover:bg-gray-50 hover:text-gray-600 dark:border-gray-800 dark:hover:bg-gray-800 dark:hover:text-gray-300 sm:inline-flex"
        [attr.aria-label]="'commandPalette.title' | transloco"
        (click)="commandPalette.open()"
      >
        <svg
          class="h-4 w-4"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="6" />
          <path stroke-linecap="round" d="m17 17-3-3" />
        </svg>
        <span>{{ 'commandPalette.trigger' | transloco }}</span>
        <kbd
          class="rounded border border-gray-200 px-1.5 py-0.5 text-theme-xs font-medium dark:border-gray-700"
        >
          ⌘K
        </kbd>
      </button>

      <!-- Mobile: icon-only palette trigger -->
      <button
        type="button"
        class="rounded-theme-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 sm:hidden"
        [attr.aria-label]="'commandPalette.title' | transloco"
        (click)="commandPalette.open()"
      >
        <svg
          class="h-5 w-5"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="9" cy="9" r="6" />
          <path stroke-linecap="round" d="m17 17-3-3" />
        </svg>
      </button>

      <!-- Language -->
      <button
        type="button"
        class="rounded-theme-md border border-gray-200 px-3 py-1.5 text-theme-sm font-medium text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
        (click)="toggleLanguage()"
      >
        {{ otherLanguageLabel() }}
      </button>

      <!-- Theme (3-way: light / dark / follow system) -->
      <div class="relative">
        <button
          type="button"
          class="rounded-theme-md border border-gray-200 p-2 text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
          [attr.aria-label]="'shell.theme' | transloco"
          [attr.aria-expanded]="themeMenuOpen()"
          aria-haspopup="menu"
          (click)="themeMenuOpen.set(!themeMenuOpen())"
        >
          <svg
            class="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              [attr.d]="themeIcon()"
              [attr.stroke-linecap]="'round'"
              [attr.stroke-linejoin]="'round'"
            />
            @if (theme.mode() === 'light') {
              <circle cx="12" cy="12" r="4" />
            }
          </svg>
        </button>

        @if (themeMenuOpen()) {
          <button
            type="button"
            class="fixed inset-0 z-40 cursor-default"
            tabindex="-1"
            [attr.aria-label]="'common.close' | transloco"
            (click)="themeMenuOpen.set(false)"
          ></button>

          <div
            role="menu"
            tabindex="-1"
            cdkTrapFocus
            [cdkTrapFocusAutoCapture]="true"
            class="absolute end-0 z-50 mt-2 w-44 overflow-hidden rounded-theme-lg border border-gray-200 bg-white py-1 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
            (keydown.escape)="themeMenuOpen.set(false)"
          >
            @for (opt of themeOptions; track opt.mode) {
              <button
                role="menuitemradio"
                type="button"
                class="flex w-full items-center gap-3 px-4 py-2.5 text-start text-theme-sm transition hover:bg-gray-50 dark:hover:bg-gray-800"
                [class]="
                  theme.mode() === opt.mode
                    ? 'font-medium text-brand-600 dark:text-brand-400'
                    : 'text-gray-700 dark:text-gray-200'
                "
                [attr.aria-checked]="theme.mode() === opt.mode"
                (click)="setTheme(opt.mode)"
              >
                <svg
                  class="h-4 w-4 shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path [attr.d]="opt.icon" stroke-linecap="round" stroke-linejoin="round" />
                  @if (opt.mode === 'light') {
                    <circle cx="12" cy="12" r="4" />
                  }
                </svg>
                {{ opt.labelKey | transloco }}
              </button>
            }
          </div>
        }
      </div>

      <!-- Divider -->
      <div class="mx-1 hidden h-6 w-px bg-gray-200 dark:bg-gray-800 sm:block"></div>

      <!-- User menu -->
      <div class="relative">
        <button
          type="button"
          class="flex items-center gap-2 rounded-theme-md p-1.5 transition hover:bg-gray-100 dark:hover:bg-gray-800"
          [attr.aria-expanded]="menuOpen()"
          aria-haspopup="menu"
          (click)="menuOpen.set(!menuOpen())"
        >
          <span
            class="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-theme-xs font-semibold text-white"
          >
            {{ initials() }}
          </span>
          <span class="hidden text-theme-sm font-medium text-gray-700 dark:text-gray-200 sm:inline">
            {{ auth.identity()?.fullName }}
          </span>
          <svg
            class="hidden h-4 w-4 text-gray-400 transition-transform sm:block"
            [class.rotate-180]="menuOpen()"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
              clip-rule="evenodd"
            />
          </svg>
        </button>

        @if (menuOpen()) {
          <!-- click-away backdrop -->
          <button
            type="button"
            class="fixed inset-0 z-40 cursor-default"
            tabindex="-1"
            [attr.aria-label]="'common.close' | transloco"
            (click)="menuOpen.set(false)"
          ></button>

          <div
            role="menu"
            tabindex="-1"
            cdkTrapFocus
            [cdkTrapFocusAutoCapture]="true"
            class="absolute end-0 z-50 mt-2 w-60 overflow-hidden rounded-theme-lg border border-gray-200 bg-white py-1 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
            (keydown.escape)="menuOpen.set(false)"
          >
            <div
              class="flex items-start gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800"
            >
              <span
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-theme-sm font-semibold text-white"
              >
                {{ initials() }}
              </span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-theme-sm font-medium text-gray-800 dark:text-gray-100">
                  {{ auth.identity()?.fullName }}
                </p>
                <p class="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                  {{ auth.identity()?.email }}
                </p>
                @if (roleLabel()) {
                  <span class="mt-1.5 inline-block">
                    <app-badge [variant]="auth.isSuperAdmin() ? 'info' : 'neutral'">{{
                      roleLabel()
                    }}</app-badge>
                  </span>
                }
              </div>
            </div>
            <a
              role="menuitem"
              routerLink="/account/profile"
              class="block px-4 py-2.5 text-theme-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              (click)="menuOpen.set(false)"
            >
              {{ 'nav.profile' | transloco }}
            </a>
            <a
              role="menuitem"
              routerLink="/account/preferences"
              class="block px-4 py-2.5 text-theme-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
              (click)="menuOpen.set(false)"
            >
              {{ 'nav.preferences' | transloco }}
            </a>
            <button
              role="menuitem"
              type="button"
              class="block w-full px-4 py-2.5 text-start text-theme-sm text-error-600 hover:bg-error-50 disabled:opacity-60 dark:text-error-500 dark:hover:bg-error-500/10"
              [disabled]="loggingOut()"
              (click)="logout()"
            >
              {{ 'nav.logout' | transloco }}
            </button>
          </div>
        }
      </div>
    </header>
  `,
})
export class TopbarComponent {
  protected readonly layout = inject(LayoutService);
  protected readonly theme = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  protected readonly commandPalette = inject(CommandPaletteService);
  private readonly locale = inject(LocaleService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);

  protected readonly menuOpen = signal(false);
  protected readonly themeMenuOpen = signal(false);
  protected readonly loggingOut = signal(false);

  // Stroke icon paths (viewBox 0 0 24 24): sun rays, crescent moon, monitor.
  private static readonly THEME_ICONS = {
    light:
      'M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41',
    dark: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z',
    system: 'M4 5h16v10H4zM8 19h8M12 15v4',
  } as const;

  protected readonly themeOptions: { mode: ThemeMode; labelKey: string; icon: string }[] = [
    { mode: 'light', labelKey: 'shell.themeLight', icon: TopbarComponent.THEME_ICONS.light },
    { mode: 'dark', labelKey: 'shell.themeDark', icon: TopbarComponent.THEME_ICONS.dark },
    { mode: 'system', labelKey: 'shell.themeSystem', icon: TopbarComponent.THEME_ICONS.system },
  ];

  /** Icon for the current theme mode shown on the trigger. */
  protected readonly themeIcon = computed(() => TopbarComponent.THEME_ICONS[this.theme.mode()]);

  protected readonly otherLanguageLabel = computed(() =>
    this.locale.culture() === 'ar' ? 'English' : 'العربية',
  );

  /** A short role chip for the user menu: a super-admin marker, else the user's primary role name. */
  protected readonly roleLabel = computed(() => {
    const identity = this.auth.identity();
    this.locale.culture(); // re-translate the super-admin label when the language changes
    if (identity?.isSuperAdmin) {
      return this.transloco.translate('shell.superAdmin');
    }
    return identity?.roles?.[0] ?? '';
  });

  protected readonly initials = computed(() => {
    const name = this.auth.identity()?.fullName?.trim() ?? '';
    if (!name) {
      return '?';
    }
    const parts = name.split(/\s+/);
    const first = parts[0]?.[0] ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
    return (first + last).toUpperCase();
  });

  protected toggleLanguage(): void {
    this.locale.setCulture(this.locale.culture() === 'ar' ? 'en' : 'ar');
  }

  protected setTheme(mode: ThemeMode): void {
    this.theme.setMode(mode);
    this.themeMenuOpen.set(false);
  }

  protected logout(): void {
    if (this.loggingOut()) {
      return;
    }
    this.loggingOut.set(true);
    this.auth.logout().subscribe({
      next: () => this.afterLogout(),
      error: () => this.afterLogout(),
    });
  }

  private afterLogout(): void {
    this.menuOpen.set(false);
    this.loggingOut.set(false);
    void this.router.navigate(['/auth/login']);
  }
}

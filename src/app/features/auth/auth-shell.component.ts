import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { LocaleService } from '../../core/i18n/locale.service';
import { ThemeService } from '../../core/theme/theme.service';

/**
 * Public auth layout: a centered TailAdmin-styled card hosting the auth routes, with language and theme
 * toggles available before sign-in. Lives outside the authenticated app shell.
 */
@Component({
  selector: 'app-auth-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, TranslocoModule],
  template: `
    <div class="flex min-h-screen flex-col bg-gray-50 dark:bg-gray-900">
      <header class="flex items-center justify-between px-6 py-5">
        <span class="text-title-sm font-semibold text-gray-900 dark:text-white">
          {{ 'common.appName' | transloco }}
        </span>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="rounded-theme-md px-3 py-1.5 text-theme-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            (click)="toggleLanguage()"
          >
            {{ otherLanguageLabel() }}
          </button>
          <button
            type="button"
            class="rounded-theme-md p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            [attr.aria-label]="'nav.' + (theme.isDark() ? 'dashboard' : 'dashboard') | transloco"
            (click)="theme.toggle()"
          >
            @if (theme.isDark()) {
              <!-- sun -->
              <svg
                class="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="4" />
                <path
                  stroke-linecap="round"
                  d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41"
                />
              </svg>
            } @else {
              <!-- moon -->
              <svg
                class="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
                />
              </svg>
            }
          </button>
        </div>
      </header>

      <main class="flex flex-1 items-center justify-center px-4 py-8">
        <div
          class="w-full max-w-md rounded-theme-lg border border-gray-200 bg-white p-6 shadow-theme-md dark:border-gray-800 dark:bg-gray-dark sm:p-8"
        >
          <router-outlet />
        </div>
      </main>
    </div>
  `,
})
export class AuthShellComponent {
  protected readonly theme = inject(ThemeService);
  private readonly locale = inject(LocaleService);

  protected readonly otherLanguageLabel = computed(() =>
    this.locale.culture() === 'ar' ? 'English' : 'العربية',
  );

  protected toggleLanguage(): void {
    this.locale.setCulture(this.locale.culture() === 'ar' ? 'en' : 'ar');
  }
}

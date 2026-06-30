import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * 404 page for unknown routes within the authenticated area (the shell's child wildcard). Kept inside the
 * shell so the chrome and navigation remain available.
 */
@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoModule],
  template: `
    <div class="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span
        class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400"
        aria-hidden="true"
      >
        <svg
          class="h-8 w-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        >
          <circle cx="11" cy="11" r="7" stroke-linecap="round" />
          <path stroke-linecap="round" d="m20 20-3.5-3.5" />
        </svg>
      </span>
      <p class="text-title-lg font-bold text-brand-500">404</p>
      <h1 class="mt-2 text-title-sm font-semibold text-gray-900 dark:text-white">
        {{ 'states.notFoundTitle' | transloco }}
      </h1>
      <p class="mt-1 max-w-md text-theme-sm text-gray-500 dark:text-gray-400">
        {{ 'errors.notFound' | transloco }}
      </p>
      <a routerLink="/dashboard" class="btn btn-primary mt-6">{{ 'states.goHome' | transloco }}</a>
    </div>
  `,
})
export class NotFoundComponent {}

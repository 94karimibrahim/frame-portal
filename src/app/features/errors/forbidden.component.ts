import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * 403 page shown when an authenticated user reaches a route they lack permission for (the
 * `hasAnyPermission` guard redirects here). Rendered inside the shell so the user keeps their navigation.
 */
@Component({
  selector: 'app-forbidden',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoModule],
  template: `
    <div class="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span
        class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-error-50 text-error-500 dark:bg-error-500/10"
        aria-hidden="true"
      >
        <svg
          class="h-8 w-8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        >
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path stroke-linecap="round" d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      </span>
      <p class="text-title-lg font-bold text-brand-500">403</p>
      <h1 class="mt-2 text-title-sm font-semibold text-gray-900 dark:text-white">
        {{ 'states.forbiddenTitle' | transloco }}
      </h1>
      <p class="mt-1 max-w-md text-theme-sm text-gray-500 dark:text-gray-400">
        {{ 'errors.forbidden' | transloco }}
      </p>
      <a routerLink="/dashboard" class="btn btn-primary mt-6">{{ 'states.goHome' | transloco }}</a>
    </div>
  `,
})
export class ForbiddenComponent {}

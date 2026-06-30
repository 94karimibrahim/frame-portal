import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Centered empty/zero-data placeholder for lists and panels. The host provides the title/description
 * (already localized); any projected content (e.g. a primary action button) renders below the text.
 */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div
        class="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
      >
        <svg
          class="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M20 13V7a2 2 0 0 0-2-2h-3.5L13 3.5a1 1 0 0 0-.7-.3H6a2 2 0 0 0-2 2v6m0 0v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6M4 13h16"
          />
        </svg>
      </div>
      <p class="text-theme-sm font-medium text-gray-800 dark:text-gray-100">{{ title() }}</p>
      @if (description()) {
        <p class="mt-1 max-w-sm text-theme-xs text-gray-500 dark:text-gray-400">
          {{ description() }}
        </p>
      }
      <div class="mt-5 empty:hidden">
        <ng-content />
      </div>
    </div>
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly description = input<string>('');
}

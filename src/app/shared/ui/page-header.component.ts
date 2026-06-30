import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Standard page heading block: a title, an optional muted subtitle, and an optional `[actions]` slot
 * (primary button, filters) anchored to the end of the row. The host passes already-localized strings.
 * Logical alignment + flex-wrap keep it correct under RTL and on narrow screens.
 */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div class="min-w-0">
        <h1 class="text-title-md font-semibold text-gray-900 dark:text-white">{{ title() }}</h1>
        @if (subtitle()) {
          <p class="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">{{ subtitle() }}</p>
        }
      </div>
      <div class="shrink-0 empty:hidden">
        <ng-content select="[actions]" />
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
}

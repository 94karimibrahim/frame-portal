import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Base shimmer placeholder. Decorative only — size it from the caller with normal utility classes, e.g.
 * `<app-skeleton class="h-4 w-32" />` or `<app-skeleton class="h-10 w-10 rounded-full" />`; the host class
 * supplies the pulse, surface colour, and a default radius that a caller's `rounded-*` can override.
 * `aria-hidden` since the surrounding region announces its own loading state.
 */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block animate-pulse rounded-theme-md bg-gray-200 dark:bg-gray-800',
    'aria-hidden': 'true',
  },
  template: ``,
})
export class SkeletonComponent {}

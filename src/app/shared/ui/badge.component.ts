import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Semantic colour intent for a {@link BadgeComponent}. */
export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error' | 'info';

/**
 * Small status pill (TailAdmin light-tone style). Colour is chosen by {@link variant}; the label is the
 * projected content (already localized by the host). Uses solid theme tokens so it reads in both light and
 * dark, and inherits text direction for RTL.
 */
@Component({
  selector: 'app-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-theme-xs font-medium"
      [class]="classes()"
    >
      <ng-content />
    </span>
  `,
})
export class BadgeComponent {
  readonly variant = input<BadgeVariant>('neutral');

  protected readonly classes = computed(() => {
    switch (this.variant()) {
      case 'success':
        return 'bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500';
      case 'warning':
        return 'bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-500';
      case 'error':
        return 'bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-500';
      case 'info':
        return 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
    }
  });
}

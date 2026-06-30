import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Accessible slide-over panel anchored to the **end** edge (right in LTR, left in RTL). Presentational
 * only — the host controls visibility with `@if` and reacts to {@link closed} (backdrop click, Escape, or
 * the header close button). CDK's focus trap captures and restores focus; `role="dialog"` + `aria-modal`
 * + a labelled title wire it up for assistive tech. Body and an optional `[drawerfooter]` are projected.
 * Full height with a scrollable body, so it suits detail panes and longer forms.
 */
@Component({
  selector: 'app-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [A11yModule, TranslocoModule],
  template: `
    <div
      class="fixed inset-0 z-[90] flex justify-end"
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="title()"
      (keydown.escape)="closed.emit()"
    >
      <!-- Backdrop (a button so dismiss is keyboard-accessible and screen-reader labelled). -->
      <button
        type="button"
        class="absolute inset-0 cursor-default bg-gray-900/50 backdrop-blur-[1px]"
        [attr.aria-label]="'common.close' | transloco"
        (click)="closed.emit()"
      ></button>

      <!-- Panel -->
      <div
        class="relative z-10 flex h-full w-full flex-col border-s border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
        [class]="widthClass()"
        cdkTrapFocus
        cdkTrapFocusAutoCapture
      >
        <div
          class="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-800"
        >
          <h2 class="text-theme-lg font-semibold text-gray-900 dark:text-white">{{ title() }}</h2>
          <button
            type="button"
            class="-me-1 rounded-theme-md p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            [attr.aria-label]="'common.close' | transloco"
            (click)="closed.emit()"
          >
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414Z"
              />
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto px-6 py-5">
          <ng-content />
        </div>

        <div class="border-t border-gray-200 px-6 py-4 empty:hidden dark:border-gray-800">
          <ng-content select="[drawerfooter]" />
        </div>
      </div>
    </div>
  `,
})
export class DrawerComponent {
  /** Accessible title shown in the header and used as the dialog's label. */
  readonly title = input.required<string>();
  /** Max-width Tailwind class for the panel (defaults to a comfortable detail/form width). */
  readonly widthClass = input<string>('max-w-md');
  /** Emitted on backdrop click, Escape, or the close button. The host decides whether to actually close. */
  readonly closed = output<void>();
}

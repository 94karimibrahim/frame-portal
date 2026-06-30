import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * The per-field validation message row beneath a form control: a single line with an icon, in one of three
 * states — **error** (the field is invalid), **warning** (a non-blocking caution the host computes), or
 * **success** (the field is valid and the user has engaged with it). Priority is error → warning → success;
 * nothing renders when all are clear, so neutral fields stay quiet and take no vertical space.
 *
 * Purely presentational: the host resolves the strings (via {@link ServerFormBase}'s `errorFor`/`showSuccess`
 * and its own warning logic) and passes them in. The persistent `aria-live="polite"` wrapper means a
 * screen reader announces the message whenever it appears or changes.
 *
 * ```html
 * <input class="form-input" [class.form-input--error]="invalid(c)" [class.form-input--success]="showSuccess(c)" />
 * <app-field-feedback [error]="errorFor(c)" [success]="showSuccess(c)" />
 * ```
 */
@Component({
  selector: 'app-field-feedback',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule],
  template: `
    <div aria-live="polite">
      @if (error()) {
        <p
          class="mt-1.5 flex items-start gap-1.5 text-theme-xs text-error-700 dark:text-error-500"
          role="alert"
        >
          <svg
            class="mt-px h-3.5 w-3.5 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1-9a1 1 0 0 0-1 1v4a1 1 0 1 0 2 0V6a1 1 0 0 0-1-1Z"
            />
          </svg>
          {{ error() }}
        </p>
      } @else if (warning()) {
        <p
          class="mt-1.5 flex items-start gap-1.5 text-theme-xs text-warning-700 dark:text-warning-500"
        >
          <svg
            class="mt-px h-3.5 w-3.5 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92ZM11 13a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1-8a1 1 0 0 0-1 1v3a1 1 0 1 0 2 0V6a1 1 0 0 0-1-1Z"
            />
          </svg>
          {{ warning() }}
        </p>
      } @else if (success()) {
        <p
          class="mt-1.5 flex items-start gap-1.5 text-theme-xs text-success-700 dark:text-success-500"
        >
          <svg
            class="mt-px h-3.5 w-3.5 shrink-0"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4Z"
            />
          </svg>
          {{ successText() || ('validation.looksGood' | transloco) }}
        </p>
      }
    </div>
  `,
})
export class FieldFeedbackComponent {
  /** Localized error message, or `null`/empty when the field isn't in error. */
  readonly error = input<string | null>(null);
  /** Localized, non-blocking caution; shown only when there's no error. */
  readonly warning = input<string | null>(null);
  /** Whether to show the positive state (only when there's no error or warning). */
  readonly success = input(false);
  /** Optional custom success text; defaults to a generic "looks good". */
  readonly successText = input<string | null>(null);
}

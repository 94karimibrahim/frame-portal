import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Indeterminate loading spinner (TailAdmin brand ring). Sized via the `size` input; respects
 * `currentColor` so it inherits the surrounding text colour. Decorative by default — pass a `label`
 * for an accessible name when it stands alone as a page/section busy indicator.
 */
@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="inline-block animate-spin rounded-full border-current border-t-transparent align-[-0.125em]"
      [class.h-4]="size() === 'sm'"
      [class.w-4]="size() === 'sm'"
      [class.border-2]="size() === 'sm'"
      [class.h-6]="size() === 'md'"
      [class.w-6]="size() === 'md'"
      [class.border-[3px]]="size() === 'md'"
      [class.h-10]="size() === 'lg'"
      [class.w-10]="size() === 'lg'"
      [class.border-4]="size() === 'lg'"
      [attr.role]="label() ? 'status' : null"
      [attr.aria-label]="label() || null"
      [attr.aria-hidden]="label() ? null : 'true'"
    ></span>
  `,
})
export class SpinnerComponent {
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly label = input<string>('');
}

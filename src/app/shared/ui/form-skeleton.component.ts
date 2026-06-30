import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { SkeletonComponent } from './skeleton.component';

/**
 * Loading placeholder for a sectioned settings form — the shape of the password-policy page (bordered
 * section cards, each a heading over a two-column grid of label + input fields, with a trailing Save
 * action). Mirrors that layout's `space-y-6` rhythm, card chrome, and `.form-input` field height so the
 * swap on load causes no jump:
 *
 * ```html
 * @if (loading()) { <app-form-skeleton [sections]="2" [fields]="4" /> } @else { … }
 * ```
 *
 * `aria-busy` + a hidden status label announce the load; the bars are decorative.
 */
@Component({
  selector: 'app-form-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, SkeletonComponent],
  template: `
    <div class="space-y-6" aria-busy="true" [attr.aria-label]="'common.loading' | transloco">
      @for (section of sectionSpan(); track $index) {
        <section
          class="rounded-theme-lg border border-gray-200 bg-white p-6 shadow-theme-sm dark:border-gray-800 dark:bg-gray-dark"
        >
          <app-skeleton class="mb-5 h-5 w-40" />
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            @for (field of fieldSpan(); track $index) {
              <div>
                <app-skeleton class="mb-1.5 h-3.5 w-28 max-w-full" />
                <app-skeleton class="h-11 w-full rounded-theme-md" />
              </div>
            }
          </div>
        </section>
      }
      @if (withAction()) {
        <div class="flex justify-end">
          <app-skeleton class="h-11 w-24 rounded-theme-md" />
        </div>
      }
    </div>
  `,
})
export class FormSkeletonComponent {
  /** Number of placeholder section cards (default 2). */
  readonly sections = input(2);
  /** Placeholder fields per section, laid out in a two-column grid (default 4). */
  readonly fields = input(4);
  /** Render a trailing action placeholder (e.g. a Save button). Default true. */
  readonly withAction = input(true);

  protected readonly sectionSpan = computed(() =>
    Array.from({ length: Math.max(1, this.sections()) }),
  );
  protected readonly fieldSpan = computed(() => Array.from({ length: Math.max(1, this.fields()) }));
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { CardComponent } from './card.component';
import { SkeletonComponent } from './skeleton.component';

/**
 * Loading placeholder for a responsive grid of titled list cards — the shape of the permissions catalogue
 * (a card per module, each a heading over a few name/code rows). Mirrors that page's
 * `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3` + `app-card` layout so the swap on load causes no jump:
 *
 * ```html
 * @if (loading()) { <app-card-grid-skeleton [cards]="6" [lines]="4" /> } @else { … }
 * ```
 *
 * `aria-busy` + a hidden status label announce the load; the bars are decorative.
 */
@Component({
  selector: 'app-card-grid-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, CardComponent, SkeletonComponent],
  template: `
    <div
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      aria-busy="true"
      [attr.aria-label]="'common.loading' | transloco"
    >
      @for (card of cardSpan(); track $index) {
        <app-card>
          <app-skeleton class="mb-4 h-5 w-28" />
          <ul class="space-y-3">
            @for (line of lineSpan(); track $index) {
              <li>
                <app-skeleton class="h-4 w-40 max-w-full" />
                <app-skeleton class="mt-1.5 h-3 w-24 max-w-full" />
              </li>
            }
          </ul>
        </app-card>
      }
    </div>
  `,
})
export class CardGridSkeletonComponent {
  /** Number of placeholder cards (default 6). */
  readonly cards = input(6);
  /** Placeholder list rows per card (default 3). */
  readonly lines = input(3);

  protected readonly cardSpan = computed(() => Array.from({ length: Math.max(1, this.cards()) }));
  protected readonly lineSpan = computed(() => Array.from({ length: Math.max(1, this.lines()) }));
}

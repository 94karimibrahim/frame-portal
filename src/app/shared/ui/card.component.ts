import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * The base surface of the TailAdmin visual language: a rounded, bordered panel with a soft theme
 * shadow that reads in both light and dark. Content is projected into the padded body; an optional
 * header slot (`[card-header]`) renders above a divider for titled panels. Set {@link interactive}
 * for links/buttons that should lift on hover. Layout-neutral and direction-agnostic, so callers
 * place it inside any grid/flex and RTL mirrors via their own logical properties.
 */
@Component({
  selector: 'app-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div [class]="surface()">
      <div class="empty:hidden border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <ng-content select="[card-header]" />
      </div>
      <div [class]="padding() ? 'p-5' : ''">
        <ng-content />
      </div>
    </div>
  `,
})
export class CardComponent {
  /** Pad the body (default). Turn off when the projected content manages its own spacing. */
  readonly padding = input(true);
  /** Adds a hover lift + brand border, for cards that act as links or buttons. */
  readonly interactive = input(false);

  protected readonly surface = computed(() => {
    const base =
      'rounded-theme-lg border border-gray-200 bg-white shadow-theme-sm dark:border-gray-800 dark:bg-gray-dark';
    return this.interactive()
      ? `${base} transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-theme-md dark:hover:border-brand-500/50`
      : base;
  });
}

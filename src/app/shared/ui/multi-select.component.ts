import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { TranslocoModule } from '@jsverse/transloco';

/** One selectable option. `group` buckets it under a heading; `hint`/`color` are optional adornments. */
export interface MultiSelectOption {
  value: string;
  label: string;
  group?: string;
  hint?: string;
  color?: string | null;
}

interface OptionGroup {
  group: string | null;
  options: MultiSelectOption[];
}

/**
 * Searchable multi-select (the project's replacement for long checkbox walls and unsearchable `<select multiple>`s).
 * The trigger shows the current selection as removable chips; opening reveals a focus-trapped panel with a live
 * filter, optional group headings, and select-all/clear for the **currently filtered** set. Options carry their
 * own value; selection is a plain `string[]` exposed as a two-way `value` model, so it drops into both reactive
 * forms (via a wrapper) and signal-driven dialogs.
 *
 * Accessibility: the panel is a `listbox`, each row an `option` with `aria-selected`; rows are native checkbox
 * labels so Tab/Shift-Tab move between them and Space toggles, Escape closes, and {@link CdkTrapFocus} with
 * auto-capture moves focus to the search box on open and restores it to the trigger on close.
 */
@Component({
  selector: 'app-multi-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, CdkTrapFocus],
  template: `
    <div class="relative">
      <!-- Trigger -->
      <button
        type="button"
        class="form-input flex min-h-[2.75rem] w-full flex-wrap items-center gap-1.5 text-start"
        [attr.aria-haspopup]="'listbox'"
        [attr.aria-expanded]="open()"
        [attr.aria-label]="ariaLabel() || null"
        (click)="open() ? closePanel() : openPanel()"
      >
        @if (selectedOptions().length === 0) {
          <span class="text-gray-500 dark:text-gray-400">{{ placeholder() }}</span>
        } @else {
          @for (opt of selectedOptions(); track opt.value) {
            <span
              class="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pe-1 ps-2 text-theme-xs font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"
            >
              @if (opt.color) {
                <span
                  class="h-2 w-2 shrink-0 rounded-full"
                  [style.background-color]="opt.color"
                ></span>
              }
              {{ opt.label }}
              <span
                role="button"
                tabindex="0"
                class="flex h-4 w-4 items-center justify-center rounded-full hover:bg-brand-100 dark:hover:bg-brand-500/20"
                [attr.aria-label]="'multiSelect.remove' | transloco: { label: opt.label }"
                (click)="remove(opt.value, $event)"
                (keydown.enter)="remove(opt.value, $event)"
                (keydown.space)="remove(opt.value, $event)"
              >
                <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    d="M6.28 6.28a.75.75 0 0 1 1.06 0L10 8.94l2.66-2.66a.75.75 0 1 1 1.06 1.06L11.06 10l2.66 2.66a.75.75 0 1 1-1.06 1.06L10 11.06l-2.66 2.66a.75.75 0 0 1-1.06-1.06L8.94 10 6.28 7.34a.75.75 0 0 1 0-1.06Z"
                  />
                </svg>
              </span>
            </span>
          }
        }
        <svg
          class="ms-auto h-4 w-4 shrink-0 text-gray-400 transition-transform"
          [class.rotate-180]="open()"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
            clip-rule="evenodd"
          />
        </svg>
      </button>

      @if (open()) {
        <!-- click-away backdrop -->
        <button
          type="button"
          class="fixed inset-0 z-40 cursor-default"
          tabindex="-1"
          [attr.aria-label]="'common.close' | transloco"
          (click)="closePanel()"
        ></button>

        <div
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          tabindex="-1"
          class="absolute z-50 mt-1.5 w-full overflow-hidden rounded-theme-lg border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
          (keydown.escape)="closePanel()"
        >
          <!-- Search -->
          <div class="border-b border-gray-100 p-2 dark:border-gray-800">
            <input
              #search
              type="search"
              class="form-input !py-2"
              [placeholder]="searchPlaceholder() || ('multiSelect.searchPlaceholder' | transloco)"
              [attr.aria-label]="'common.search' | transloco"
              [value]="query()"
              (input)="onSearch($event)"
            />
          </div>

          <!-- Bulk controls -->
          <div
            class="flex items-center justify-between border-b border-gray-100 px-3 py-1.5 text-theme-xs dark:border-gray-800"
          >
            <span class="text-gray-500 dark:text-gray-400">
              {{ 'multiSelect.selected' | transloco: { count: value().length } }}
            </span>
            <span class="flex items-center gap-2">
              <button
                type="button"
                class="font-medium text-brand-600 hover:underline disabled:opacity-50 dark:text-brand-400"
                [disabled]="filteredCount() === 0"
                (click)="selectAllFiltered()"
              >
                {{ 'multiSelect.selectAll' | transloco }}
              </button>
              <button
                type="button"
                class="text-gray-500 hover:underline disabled:opacity-50 dark:text-gray-400"
                [disabled]="value().length === 0"
                (click)="clearAll()"
              >
                {{ 'multiSelect.clear' | transloco }}
              </button>
            </span>
          </div>

          <!-- Options -->
          <div class="max-h-64 overflow-y-auto p-1" role="listbox" aria-multiselectable="true">
            @for (g of grouped(); track g.group) {
              @if (g.group) {
                <p
                  class="px-3 pb-1 pt-2 text-theme-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                >
                  {{ g.group }}
                </p>
              }
              @for (opt of g.options; track opt.value) {
                <label
                  role="option"
                  [attr.aria-selected]="isSelected(opt.value)"
                  class="flex cursor-pointer items-center gap-2.5 rounded-theme-md px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-gray-300 text-brand-500"
                    [checked]="isSelected(opt.value)"
                    (change)="toggle(opt.value)"
                  />
                  @if (opt.color) {
                    <span
                      class="h-2.5 w-2.5 shrink-0 rounded-full"
                      [style.background-color]="opt.color"
                    ></span>
                  }
                  <span class="min-w-0">
                    <span class="block truncate text-theme-sm text-gray-700 dark:text-gray-200">{{
                      opt.label
                    }}</span>
                    @if (opt.hint) {
                      <span class="block truncate text-theme-xs text-gray-500 dark:text-gray-400">{{
                        opt.hint
                      }}</span>
                    }
                  </span>
                </label>
              }
            }
            @if (filteredCount() === 0) {
              <p class="px-3 py-6 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                {{ 'multiSelect.noMatches' | transloco }}
              </p>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class MultiSelectComponent {
  readonly options = input<MultiSelectOption[]>([]);
  /** Selected values; two-way (`[(value)]`) or `[value]`/`(valueChange)`. */
  readonly value = model<string[]>([]);
  readonly placeholder = input<string>('');
  readonly searchPlaceholder = input<string>('');
  /** Accessible name for the trigger when there's no visible label associated. */
  readonly ariaLabel = input<string>('');

  protected readonly open = signal(false);
  protected readonly query = signal('');

  private readonly selectedSet = computed(() => new Set(this.value()));

  /** Selected options in the order they appear in `options`, for stable chip rendering. */
  protected readonly selectedOptions = computed(() => {
    const set = this.selectedSet();
    return this.options().filter((o) => set.has(o.value));
  });

  /** Options matching the current query, bucketed by group (insertion order preserved). */
  protected readonly grouped = computed<OptionGroup[]>(() => {
    const q = this.query().trim().toLowerCase();
    const matches = (o: MultiSelectOption) =>
      !q ||
      o.label.toLowerCase().includes(q) ||
      o.value.toLowerCase().includes(q) ||
      (o.hint?.toLowerCase().includes(q) ?? false) ||
      (o.group?.toLowerCase().includes(q) ?? false);

    const buckets = new Map<string | null, MultiSelectOption[]>();
    for (const option of this.options()) {
      if (!matches(option)) {
        continue;
      }
      const key = option.group ?? null;
      const existing = buckets.get(key);
      if (existing) {
        existing.push(option);
      } else {
        buckets.set(key, [option]);
      }
    }
    return [...buckets.entries()].map(([group, options]) => ({ group, options }));
  });

  protected readonly filteredCount = computed(() =>
    this.grouped().reduce((total, group) => total + group.options.length, 0),
  );

  protected isSelected(value: string): boolean {
    return this.selectedSet().has(value);
  }

  protected toggle(value: string): void {
    const next = new Set(this.value());
    if (next.has(value)) {
      next.delete(value);
    } else {
      next.add(value);
    }
    this.value.set([...next]);
  }

  protected remove(value: string, event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.value.set(this.value().filter((v) => v !== value));
  }

  /** Add every currently-filtered option to the selection (leaves existing picks intact). */
  protected selectAllFiltered(): void {
    const next = new Set(this.value());
    for (const group of this.grouped()) {
      for (const option of group.options) {
        next.add(option.value);
      }
    }
    this.value.set([...next]);
  }

  protected clearAll(): void {
    this.value.set([]);
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected openPanel(): void {
    this.query.set('');
    this.open.set(true);
  }

  protected closePanel(): void {
    this.open.set(false);
  }
}

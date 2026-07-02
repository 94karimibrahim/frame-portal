import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../core/auth/auth.service';
import { CommandPaletteService } from '../core/command-palette/command-palette.service';
import { LocaleService } from '../core/i18n/locale.service';
import { ThemeService } from '../core/theme/theme.service';
import { NAV } from './nav.model';

/** A runnable entry in the palette: a localized label, an icon, a section, and what it does. */
interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: string;
  group: 'navigation' | 'actions';
  run: () => void;
}

/**
 * Global command palette (⌘K / Ctrl-K, or the topbar trigger). A single search box over every place the
 * user can go — the permission-filtered {@link NAV} — plus a handful of app actions (theme, language,
 * sign out). Implements the WAI-ARIA combobox pattern: focus stays in the input while Up/Down move the
 * `aria-activedescendant` highlight, Enter runs it, Escape closes. Focus is trapped and restored to the
 * trigger on close. Mounted once in the authenticated shell.
 */
@Component({
  selector: 'app-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkTrapFocus, TranslocoModule],
  template: `
    @if (palette.opened()) {
      <div
        class="fixed inset-0 z-100 flex items-start justify-center p-4 pt-[12vh]"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'commandPalette.title' | transloco"
      >
        <!-- Backdrop -->
        <button
          type="button"
          class="absolute inset-0 cursor-default bg-gray-900/50 backdrop-blur-[1px]"
          tabindex="-1"
          [attr.aria-label]="'common.close' | transloco"
          (click)="palette.close()"
        ></button>

        <div
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          tabindex="-1"
          class="relative z-10 flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-theme-lg border border-gray-200 bg-white shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
        >
          <!-- Search -->
          <div class="flex items-center gap-3 border-b border-gray-100 px-4 dark:border-gray-800">
            <svg
              class="h-5 w-5 shrink-0 text-gray-400"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <circle cx="9" cy="9" r="6" />
              <path stroke-linecap="round" d="m17 17-3-3" />
            </svg>
            <input
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls="command-palette-list"
              [attr.aria-activedescendant]="flat().length ? 'command-option-' + active() : null"
              [attr.aria-label]="'commandPalette.placeholder' | transloco"
              [placeholder]="'commandPalette.placeholder' | transloco"
              class="w-full bg-transparent py-4 text-theme-sm text-gray-900 placeholder:text-gray-400 focus:outline-hidden dark:text-gray-100"
              [value]="query()"
              (input)="onSearch($event)"
              (keydown.arrowDown)="move(1, $event)"
              (keydown.arrowUp)="move(-1, $event)"
              (keydown.enter)="runActive($event)"
              (keydown.escape)="palette.close()"
            />
          </div>

          <!-- Results -->
          <div id="command-palette-list" role="listbox" class="overflow-y-auto p-2">
            @for (section of groups(); track section.key) {
              <p
                class="px-3 pb-1 pt-2 text-theme-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
              >
                {{ section.label }}
              </p>
              @for (entry of section.items; track entry.cmd.id) {
                <button
                  type="button"
                  [id]="'command-option-' + entry.index"
                  role="option"
                  [attr.aria-selected]="active() === entry.index"
                  class="flex w-full items-center gap-3 rounded-theme-md px-3 py-2.5 text-start"
                  [class]="
                    active() === entry.index
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                      : 'text-gray-700 dark:text-gray-200'
                  "
                  (mouseenter)="active.set(entry.index)"
                  (click)="run(entry.cmd)"
                >
                  <svg
                    class="h-5 w-5 shrink-0 opacity-70"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path [attr.d]="entry.cmd.icon" fill-rule="evenodd" clip-rule="evenodd" />
                  </svg>
                  <span class="min-w-0 flex-1 truncate text-theme-sm">{{ entry.cmd.label }}</span>
                  @if (entry.cmd.hint) {
                    <span class="shrink-0 text-theme-xs text-gray-400 dark:text-gray-500">{{
                      entry.cmd.hint
                    }}</span>
                  }
                </button>
              }
            }
            @if (flat().length === 0) {
              <p class="px-3 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                {{ 'commandPalette.empty' | transloco }}
              </p>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class CommandPaletteComponent {
  protected readonly palette = inject(CommandPaletteService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly theme = inject(ThemeService);
  private readonly locale = inject(LocaleService);
  private readonly i18n = inject(TranslocoService);

  protected readonly query = signal('');
  /** Index of the highlighted command within {@link flat}. */
  protected readonly active = signal(0);

  // 20×20 solid icon paths for the action commands (nav items carry their own).
  private static readonly ACTION_ICONS = {
    theme:
      'M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2ZM10 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM15.657 5.404a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5.404 15.657a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.06 1.06l1.06 1.06ZM10 18a.75.75 0 0 1-.75-.75v-1.5a.75.75 0 0 1 1.5 0v1.5A.75.75 0 0 1 10 18ZM4.343 5.404a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.06 1.06l1.06 1.06ZM4 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 4 10Z',
    language:
      'M10 1a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM7.5 3.69A13.6 13.6 0 0 0 6.2 8h2.05c.04-1.5.27-2.93.66-4.2-.49.11-.96.27-1.41.46ZM3.94 8a7.51 7.51 0 0 1 2.06-3.32A14.9 14.9 0 0 0 4.7 8h-.76Zm-.76 1.5h.95A14.9 14.9 0 0 0 6 13.32 7.51 7.51 0 0 1 3.18 9.5Zm2.27 0h2.05c.06 1.74.4 3.32.92 4.55a7.5 7.5 0 0 1-2.97-4.55Zm3.55 0h1.99a13.6 13.6 0 0 1-1 4.43 13.6 13.6 0 0 1-.99-4.43Zm3.49 0h2.05a7.5 7.5 0 0 1-2.97 4.55c.52-1.23.86-2.81.92-4.55Zm2.05-1.5h-2.05a13.7 13.7 0 0 0-.66-4 7.51 7.51 0 0 1 2.71 4Z',
    logout:
      'M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-.943a.75.75 0 1 0-1.004-1.114l-2.5 2.25a.75.75 0 0 0 0 1.114l2.5 2.25a.75.75 0 1 0 1.004-1.114l-1.048-.943h9.546A.75.75 0 0 0 19 10Z',
  } as const;

  /** Navigation commands: every reachable nav destination, re-filtered when permissions/locale change. */
  private readonly navCommands = computed<Command[]>(() => {
    this.auth.permissions();
    this.locale.culture(); // re-translate labels on language change
    const commands: Command[] = [];
    for (const group of NAV) {
      for (const item of group.items) {
        if (item.permissions && !this.auth.hasAny(item.permissions)) {
          continue;
        }
        commands.push({
          id: 'nav:' + item.link,
          label: this.i18n.translate(item.labelKey),
          hint: group.labelKey ? this.i18n.translate(group.labelKey) : undefined,
          icon: item.icon,
          group: 'navigation',
          run: () => void this.router.navigateByUrl(item.link),
        });
      }
    }
    return commands;
  });

  /** Global actions surfaced in the palette. */
  private readonly actionCommands = computed<Command[]>(() => {
    this.locale.culture();
    const icons = CommandPaletteComponent.ACTION_ICONS;
    const themeLabel = this.i18n.translate('shell.theme');
    return [
      this.themeCommand('light', 'shell.themeLight', themeLabel, icons.theme),
      this.themeCommand('dark', 'shell.themeDark', themeLabel, icons.theme),
      this.themeCommand('system', 'shell.themeSystem', themeLabel, icons.theme),
      {
        id: 'action:language',
        label: this.i18n.translate('commandPalette.switchLanguage'),
        hint: this.locale.culture() === 'ar' ? 'English' : 'العربية',
        icon: icons.language,
        group: 'actions',
        run: () => this.locale.setCulture(this.locale.culture() === 'ar' ? 'en' : 'ar'),
      },
      {
        id: 'action:logout',
        label: this.i18n.translate('nav.logout'),
        icon: icons.logout,
        group: 'actions',
        run: () => this.logout(),
      },
    ];
  });

  /** Filtered commands in display order; the index basis for keyboard navigation. */
  protected readonly flat = computed<Command[]>(() => {
    const q = this.query().trim().toLowerCase();
    const all = [...this.navCommands(), ...this.actionCommands()];
    if (!q) {
      return all;
    }
    return all.filter(
      (c) => c.label.toLowerCase().includes(q) || (c.hint?.toLowerCase().includes(q) ?? false),
    );
  });

  /** Filtered commands bucketed into sections, each item carrying its flat index for `aria-activedescendant`. */
  protected readonly groups = computed(() => {
    const flat = this.flat();
    const withIndex = flat.map((cmd, index) => ({ cmd, index }));
    const sections: { key: Command['group']; label: string }[] = [
      { key: 'navigation', label: this.i18n.translate('commandPalette.navigation') },
      { key: 'actions', label: this.i18n.translate('commandPalette.actions') },
    ];
    return sections
      .map((s) => ({
        key: s.key,
        label: s.label,
        items: withIndex.filter((e) => e.cmd.group === s.key),
      }))
      .filter((s) => s.items.length > 0);
  });

  constructor() {
    // Reset the query and highlight each time the palette opens.
    let wasOpen = false;
    effect(() => {
      const isOpen = this.palette.opened();
      if (isOpen && !wasOpen) {
        this.query.set('');
        this.active.set(0);
      }
      wasOpen = isOpen;
    });
  }

  /** ⌘K / Ctrl-K toggles the palette from anywhere. */
  @HostListener('document:keydown', ['$event'])
  protected onGlobalKey(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.palette.toggle();
    }
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(0);
  }

  protected move(delta: number, event: Event): void {
    event.preventDefault();
    const last = this.flat().length - 1;
    if (last < 0) {
      return;
    }
    this.active.set(Math.min(Math.max(this.active() + delta, 0), last));
  }

  protected runActive(event: Event): void {
    event.preventDefault();
    const command = this.flat()[this.active()];
    if (command) {
      this.run(command);
    }
  }

  protected run(command: Command): void {
    this.palette.close();
    command.run();
  }

  private themeCommand(
    mode: 'light' | 'dark' | 'system',
    labelKey: string,
    prefix: string,
    icon: string,
  ): Command {
    return {
      id: 'action:theme:' + mode,
      label: `${prefix}: ${this.i18n.translate(labelKey)}`,
      icon,
      group: 'actions',
      run: () => this.theme.setMode(mode),
    };
  }

  private logout(): void {
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/auth/login']),
      error: () => void this.router.navigate(['/auth/login']),
    });
  }
}

import { Injectable, signal } from '@angular/core';

/**
 * Shared open/closed state for the global command palette, so the topbar trigger button and the
 * `CommandPaletteComponent` (which owns the ⌘K/Ctrl-K shortcut) drive the same overlay without a parent
 * relationship. Mounted app-wide via the authenticated shell.
 */
@Injectable({ providedIn: 'root' })
export class CommandPaletteService {
  /** Whether the palette overlay is currently shown. */
  readonly opened = signal(false);

  open(): void {
    this.opened.set(true);
  }

  close(): void {
    this.opened.set(false);
  }

  toggle(): void {
    this.opened.update((v) => !v);
  }
}

import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Light/dark theming via the `dark` class on <html> (Tailwind `darkMode: 'class'`). `system` follows the
 * OS preference live. The choice is mirrored to `localStorage` (non-sensitive) for instant application on
 * the next load, and also persisted server-side through user Preferences.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private static readonly KEY = 'frame.theme';
  private readonly doc = inject(DOCUMENT);
  private readonly media = this.doc.defaultView?.matchMedia('(prefers-color-scheme: dark)');

  private readonly _mode = signal<ThemeMode>(this.read());
  readonly mode = this._mode.asReadonly();
  readonly isDark = computed(() => this.resolveDark(this._mode()));

  constructor() {
    // Re-resolve when the OS preference changes while in `system` mode.
    this.media?.addEventListener('change', () => {
      if (this._mode() === 'system') {
        this.applyClass();
      }
    });
  }

  /** Applies the persisted/initial theme to the document. Called once at app start. */
  init(): void {
    this.applyClass();
  }

  setMode(mode: ThemeMode): void {
    this._mode.set(mode);
    try {
      localStorage.setItem(ThemeService.KEY, mode);
    } catch {
      // Non-fatal.
    }
    this.applyClass();
  }

  /** Convenience toggle between explicit light and dark (used by the topbar switch). */
  toggle(): void {
    this.setMode(this.isDark() ? 'light' : 'dark');
  }

  private applyClass(): void {
    this.doc.documentElement.classList.toggle('dark', this.resolveDark(this._mode()));
  }

  private resolveDark(mode: ThemeMode): boolean {
    return mode === 'dark' || (mode === 'system' && !!this.media?.matches);
  }

  private read(): ThemeMode {
    try {
      const saved = localStorage.getItem(ThemeService.KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    } catch {
      // Ignore.
    }
    return 'system';
  }
}

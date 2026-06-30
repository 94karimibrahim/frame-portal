import { Injectable, signal } from '@angular/core';

/**
 * Shared chrome state for the authenticated shell. The topbar toggles it, the sidebar and backdrop read
 * it. Two independent axes:
 *  - `mobileOpen` — the off-canvas drawer on small screens (closed by default; closed again on navigate).
 *  - `collapsed`  — the desktop mini/icon-only rail (persisted, since it's a deliberate workspace choice).
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private static readonly COLLAPSE_KEY = 'frame.sidebar.collapsed';

  private readonly _mobileOpen = signal(false);
  private readonly _collapsed = signal(this.readCollapsed());

  readonly mobileOpen = this._mobileOpen.asReadonly();
  readonly collapsed = this._collapsed.asReadonly();

  openMobile(): void {
    this._mobileOpen.set(true);
  }

  closeMobile(): void {
    this._mobileOpen.set(false);
  }

  toggleMobile(): void {
    this._mobileOpen.update((v) => !v);
  }

  toggleCollapsed(): void {
    const next = !this._collapsed();
    this._collapsed.set(next);
    try {
      localStorage.setItem(LayoutService.COLLAPSE_KEY, String(next));
    } catch {
      // Non-fatal; the in-memory signal still drives the layout this session.
    }
  }

  private readCollapsed(): boolean {
    try {
      return localStorage.getItem(LayoutService.COLLAPSE_KEY) === 'true';
    } catch {
      return false;
    }
  }
}

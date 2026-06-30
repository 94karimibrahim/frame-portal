import { Injectable, signal } from '@angular/core';

export type NotificationKind = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: number;
  kind: NotificationKind;
  title: string;
  text?: string;
  /** Auto-dismiss delay in ms; 0 keeps it until dismissed. */
  timeout: number;
}

/**
 * App-wide toast queue. Services/components push notifications; the toast container component (UI kit)
 * renders the signal. Kept in core so the error interceptor can surface failures without a UI dependency.
 */
/** Internal per-toast auto-dismiss bookkeeping, so a toast can be paused while hovered. */
interface Timer {
  handle: ReturnType<typeof setTimeout>;
  /** Wall-clock time the current countdown started. */
  startedAt: number;
  /** Milliseconds still owed when the countdown last (re)started. */
  remaining: number;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private seq = 0;
  private readonly _items = signal<Notification[]>([]);
  readonly items = this._items.asReadonly();

  /** Active auto-dismiss timers, keyed by notification id. */
  private readonly timers = new Map<number, Timer>();

  success(title: string, text?: string, timeout = 4000): void {
    this.push('success', title, text, timeout);
  }

  error(title: string, text?: string, timeout = 7000): void {
    this.push('error', title, text, timeout);
  }

  warning(title: string, text?: string, timeout = 6000): void {
    this.push('warning', title, text, timeout);
  }

  info(title: string, text?: string, timeout = 4000): void {
    this.push('info', title, text, timeout);
  }

  dismiss(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer.handle);
      this.timers.delete(id);
    }
    this._items.update((items) => items.filter((n) => n.id !== id));
  }

  /** Pause a toast's auto-dismiss while the pointer is over it, banking the time remaining. */
  pause(id: number): void {
    const timer = this.timers.get(id);
    if (!timer) {
      return;
    }
    clearTimeout(timer.handle);
    timer.remaining -= Date.now() - timer.startedAt;
  }

  /** Resume a paused toast's countdown from where it left off. */
  resume(id: number): void {
    const timer = this.timers.get(id);
    if (!timer) {
      return;
    }
    this.arm(id, timer, Math.max(0, timer.remaining));
  }

  private push(
    kind: NotificationKind,
    title: string,
    text: string | undefined,
    timeout: number,
  ): void {
    const id = ++this.seq;
    this._items.update((items) => [...items, { id, kind, title, text, timeout }]);
    if (timeout > 0) {
      this.arm(
        id,
        { handle: 0 as unknown as Timer['handle'], startedAt: 0, remaining: timeout },
        timeout,
      );
    }
  }

  /** (Re)start the countdown for a toast and record it so it can be paused/resumed later. */
  private arm(id: number, timer: Timer, delay: number): void {
    timer.startedAt = Date.now();
    timer.remaining = delay;
    timer.handle = setTimeout(() => this.dismiss(id), delay);
    this.timers.set(id, timer);
  }
}

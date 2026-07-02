import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';

/**
 * Thin top-of-viewport progress bar shown while the router is navigating. Because every feature is
 * lazy-loaded, there's a real async gap between click and render; this gives instant feedback that the app
 * is working. Driven purely by router events — visible from {@link NavigationStart} until the navigation
 * ends, is cancelled, or errors. Decorative (`aria-hidden`); route changes are announced elsewhere.
 */
@Component({
  selector: 'app-route-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (active()) {
      <div
        class="pointer-events-none fixed inset-x-0 top-0 z-110 h-0.5 overflow-hidden bg-brand-500/20"
        aria-hidden="true"
      >
        <div
          class="h-full w-2/5 animate-[route-progress_1.1s_ease-in-out_infinite] bg-brand-500"
        ></div>
      </div>
    }
  `,
})
export class RouteProgressComponent {
  private readonly router = inject(Router);
  protected readonly active = signal(false);

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((e) => {
      if (e instanceof NavigationStart) {
        this.active.set(true);
      } else if (
        e instanceof NavigationEnd ||
        e instanceof NavigationCancel ||
        e instanceof NavigationError
      ) {
        this.active.set(false);
      }
    });
  }
}

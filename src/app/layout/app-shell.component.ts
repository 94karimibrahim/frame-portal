import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { TranslocoModule } from '@jsverse/transloco';
import { prefersReducedMotion, routeFade } from '../shared/animations';
import { CommandPaletteComponent } from './command-palette.component';
import { LayoutService } from './layout.service';
import { RouteProgressComponent } from './route-progress.component';
import { SidebarComponent } from './sidebar.component';
import { TopbarComponent } from './topbar.component';

/**
 * The authenticated application shell: a fixed/off-canvas sidebar, a sticky top bar, and the routed
 * feature content. Mounted as the parent route of every authenticated page (guarded by `authGuard`), so
 * the chrome persists across navigation. Closes the mobile drawer on every successful navigation.
 */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [routeFade],
  imports: [
    RouterOutlet,
    TranslocoModule,
    SidebarComponent,
    TopbarComponent,
    RouteProgressComponent,
    CommandPaletteComponent,
  ],
  template: `
    <app-route-progress />
    <app-command-palette />

    <!-- Skip link: first Tab target, visible only when focused. -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[120] focus:rounded-theme-md focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-theme-sm focus:font-medium focus:text-white focus:shadow-theme-lg"
    >
      {{ 'shell.skipToContent' | transloco }}
    </a>

    <div class="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <app-sidebar />

      @if (layout.mobileOpen()) {
        <button
          type="button"
          class="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-sm lg:hidden"
          [attr.aria-label]="'common.close' | transloco"
          (click)="layout.closeMobile()"
        ></button>
      }

      <div class="flex min-w-0 flex-1 flex-col">
        <app-topbar />
        <main id="main-content" tabindex="-1" class="flex-1 p-4 outline-none sm:p-6">
          <div
            class="mx-auto w-full max-w-7xl"
            [@routeFade]="routeKey(outlet)"
            [@.disabled]="reduceMotion"
          >
            <router-outlet #outlet="outlet" />
          </div>
        </main>
      </div>
    </div>
  `,
})
export class AppShellComponent {
  protected readonly layout = inject(LayoutService);
  private readonly router = inject(Router);

  /** Whether to skip route transitions (honors the OS "reduce motion" setting). */
  protected readonly reduceMotion = prefersReducedMotion();

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.layout.closeMobile());
  }

  /**
   * Animation state key for {@link routeFade}: a value that changes whenever the activated page changes,
   * so the cross-fade re-fires per navigation. The deepest route's path is stable within a page and
   * distinct between pages, which is exactly the trigger we want.
   */
  protected routeKey(outlet: RouterOutlet): string {
    if (!outlet?.isActivated) {
      return '';
    }
    let route = outlet.activatedRoute.snapshot;
    while (route.firstChild) {
      route = route.firstChild;
    }
    return route.pathFromRoot
      .map((r) => r.url.map((s) => s.path).join('/'))
      .filter(Boolean)
      .join('/');
  }
}

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { TranslocoModule } from '@jsverse/transloco';
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
      class="sr-only focus:not-sr-only focus:fixed focus:inset-s-4 focus:top-4 focus:z-120 focus:rounded-theme-md focus:bg-brand-500 focus:px-4 focus:py-2 focus:text-theme-sm focus:font-medium focus:text-white focus:shadow-theme-lg"
    >
      {{ 'shell.skipToContent' | transloco }}
    </a>

    <div class="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <app-sidebar />

      @if (layout.mobileOpen()) {
        <button
          type="button"
          class="fixed inset-0 z-40 bg-gray-900/50 backdrop-blur-xs lg:hidden"
          [attr.aria-label]="'common.close' | transloco"
          (click)="layout.closeMobile()"
        ></button>
      }

      <div class="flex min-w-0 flex-1 flex-col">
        <app-topbar />
        <main id="main-content" tabindex="-1" class="flex-1 p-4 outline-hidden sm:p-6">
          <!-- .route-view names this box for the router's view transitions (see styles.css). -->
          <div class="route-view mx-auto w-full max-w-7xl">
            <router-outlet />
          </div>
        </main>
      </div>
    </div>
  `,
})
export class AppShellComponent {
  protected readonly layout = inject(LayoutService);
  private readonly router = inject(Router);

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.layout.closeMobile());
  }
}

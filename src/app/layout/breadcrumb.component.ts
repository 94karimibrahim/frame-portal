import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { TranslocoModule } from '@jsverse/transloco';

/** A single breadcrumb hop: a localized label key and the URL it navigates to. */
interface Crumb {
  titleKey: string;
  url: string;
}

/**
 * Location breadcrumb for the authenticated shell. Built from the `data.titleKey` already declared on each
 * feature route (see app.routes) — no separate config to keep in sync. Walks the activated-route snapshot on
 * every {@link NavigationEnd}, collecting routes that carry a `titleKey`, and always anchors the trail at the
 * dashboard so users can step back to the start. The last hop is the current page (`aria-current`, not a link).
 * Logical spacing + an RTL-mirrored separator keep it correct in Arabic.
 */
@Component({
  selector: 'app-breadcrumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoModule],
  template: `
    <nav class="flex min-w-0 items-center" [attr.aria-label]="'shell.breadcrumb' | transloco">
      <ol class="flex min-w-0 items-center gap-1.5 text-theme-sm">
        @for (crumb of crumbs(); track crumb.url; let last = $last) {
          <li class="flex min-w-0 items-center gap-1.5">
            @if (last) {
              <span
                class="truncate font-medium text-gray-800 dark:text-gray-100"
                aria-current="page"
              >
                {{ crumb.titleKey | transloco }}
              </span>
            } @else {
              <a
                [routerLink]="crumb.url"
                class="truncate text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {{ crumb.titleKey | transloco }}
              </a>
              <svg
                class="h-4 w-4 shrink-0 text-gray-300 rtl:rotate-180 dark:text-gray-600"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
                />
              </svg>
            }
          </li>
        }
      </ol>
    </nav>
  `,
})
export class BreadcrumbComponent {
  private readonly router = inject(Router);

  /** The active trail; recomputed on every navigation. */
  protected readonly crumbs = signal<Crumb[]>(this.build());

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.crumbs.set(this.build()));
  }

  /** Walk the snapshot, collecting every route that declares a `titleKey`, anchored at the dashboard. */
  private build(): Crumb[] {
    const trail: Crumb[] = [];
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let url = '';
    while (route) {
      const segment = route.url.map((s) => s.path).join('/');
      if (segment) {
        url += '/' + segment;
      }
      const titleKey = route.data?.['titleKey'] as string | undefined;
      // Skip empty-path children that inherit the parent's `titleKey` (Angular's default `emptyOnly`
      // data inheritance), which would otherwise duplicate the trailing crumb (e.g. Users › Users).
      if (titleKey && trail[trail.length - 1]?.url !== url) {
        trail.push({ titleKey, url });
      }
      route = route.firstChild;
    }
    // Always start from the dashboard unless we're already on it, so there's a way back to the top.
    if (trail[0]?.url !== '/dashboard') {
      trail.unshift({ titleKey: 'nav.dashboard', url: '/dashboard' });
    }
    return trail;
  }
}

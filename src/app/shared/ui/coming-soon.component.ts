import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { EmptyStateComponent } from './empty-state.component';

/**
 * Temporary stand-in for feature areas that are routed and permission-gated but not yet built
 * (build-order steps 5–6). Keeping the route live means the sidebar, breadcrumb, and `canMatch`
 * permission guards are all exercisable from the shell milestone; each feature swaps its `loadComponent`
 * for the real one as it lands. The route's `title` (data) names the section being placeheld.
 */
@Component({
  selector: 'app-coming-soon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, EmptyStateComponent],
  template: `
    <div
      class="rounded-theme-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-dark"
    >
      <app-empty-state [title]="title()" [description]="'shell.comingSoonText' | transloco" />
    </div>
  `,
})
export class ComingSoonComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly transloco = inject(TranslocoService);

  protected title(): string {
    const key = this.route.snapshot.data['titleKey'] as string | undefined;
    return key ? this.transloco.translate(key) : '';
  }
}

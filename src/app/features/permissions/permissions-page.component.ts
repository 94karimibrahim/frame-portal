import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { LocaleService } from '../../core/i18n/locale.service';
import { Permission } from '../../core/models';
import { CardComponent } from '../../shared/ui/card.component';
import { CardGridSkeletonComponent } from '../../shared/ui/card-grid-skeleton.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { PermissionService } from './permission.service';
import { groupByModule } from './permission-grouping';

/**
 * Read-only permission catalogue (FRONTEND_PLAN §2.9), grouped by module. The catalogue is fixed in the
 * backend code; roles reference these codes. Display names resolve to the active culture from each
 * permission's translations, falling back to the base name.
 */
@Component({
  selector: 'app-permissions-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    PageHeaderComponent,
    CardComponent,
    CardGridSkeletonComponent,
    EmptyStateComponent,
  ],
  template: `
    <app-page-header
      [title]="'permissions.title' | transloco"
      [subtitle]="'permissions.subtitle' | transloco"
    />

    @if (loading()) {
      <app-card-grid-skeleton [cards]="6" [lines]="4" />
    } @else if (loadError()) {
      <app-empty-state [title]="'permissions.loadError' | transloco">
        <button type="button" class="btn btn-secondary" (click)="load()">
          {{ 'common.retry' | transloco }}
        </button>
      </app-empty-state>
    } @else {
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        @for (group of groups(); track group.module) {
          <app-card>
            <h2
              class="mb-3 text-theme-md font-semibold capitalize text-gray-800 dark:text-gray-100"
            >
              {{ group.module }}
            </h2>
            <ul class="space-y-2.5">
              @for (permission of group.items; track permission.id) {
                <li>
                  <p class="text-theme-sm font-medium text-gray-700 dark:text-gray-200">
                    {{ name(permission) }}
                  </p>
                  <code class="text-theme-xs text-brand-500">{{ permission.code }}</code>
                  @if (description(permission); as d) {
                    <p class="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">{{ d }}</p>
                  }
                </li>
              }
            </ul>
          </app-card>
        }
      </div>
    }
  `,
})
export class PermissionsPageComponent {
  private readonly service = inject(PermissionService);
  private readonly locale = inject(LocaleService);

  private readonly permissions = signal<Permission[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly groups = computed(() => groupByModule(this.permissions()));

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.service.list().subscribe({
      next: (catalogue) => {
        this.permissions.set(catalogue);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  protected name(permission: Permission): string {
    const lang = this.locale.culture();
    return (
      permission.translations.find((t) => t.lang === lang)?.name?.trim() || permission.displayName
    );
  }

  protected description(permission: Permission): string | null {
    const lang = this.locale.culture();
    const translated = permission.translations.find((t) => t.lang === lang)?.description?.trim();
    return translated || permission.description?.trim() || null;
  }
}

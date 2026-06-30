import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { CellContext, injectFlexRenderContext } from '@tanstack/angular-table';
import { LocaleService } from '../../../core/i18n/locale.service';
import { RoleListItem } from '../../../core/models';
import { BadgeComponent } from '../../../shared/ui/badge.component';

/** Grid cell: a role's colour swatch + culture-resolved name, with System / Inactive badges. */
@Component({
  selector: 'app-role-name-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, BadgeComponent],
  template: `
    <div class="flex items-center gap-2">
      @if (role.color) {
        <span
          class="h-2.5 w-2.5 shrink-0 rounded-full"
          [style.background-color]="role.color"
        ></span>
      }
      <span class="font-medium text-gray-800 dark:text-gray-100">{{ name }}</span>
      @if (role.isSystem) {
        <app-badge variant="info">{{ 'roles.system' | transloco }}</app-badge>
      }
      @if (!role.isActive) {
        <app-badge variant="neutral">{{ 'roles.inactive' | transloco }}</app-badge>
      }
    </div>
  `,
})
export class RoleNameCellComponent {
  private readonly ctx = injectFlexRenderContext<CellContext<RoleListItem, unknown>>();
  private readonly locale = inject(LocaleService);

  protected get role(): RoleListItem {
    return this.ctx.row.original;
  }

  protected get name(): string {
    const lang = this.locale.culture();
    return this.role.translations.find((t) => t.lang === lang)?.name?.trim() || this.role.name;
  }
}

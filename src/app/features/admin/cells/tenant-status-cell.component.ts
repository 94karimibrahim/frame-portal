import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { CellContext, injectFlexRenderContext } from '@tanstack/angular-table';
import { TenantListItem } from '../../../core/models';
import { BadgeComponent } from '../../../shared/ui/badge.component';

/** Grid cell: a tenant's active/inactive status as a badge. */
@Component({
  selector: 'app-tenant-status-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, BadgeComponent],
  template: `
    <app-badge [variant]="active ? 'success' : 'neutral'">
      {{ (active ? 'admin.tenants.active' : 'admin.tenants.inactive') | transloco }}
    </app-badge>
  `,
})
export class TenantStatusCellComponent {
  private readonly ctx = injectFlexRenderContext<CellContext<TenantListItem, unknown>>();
  protected readonly active = this.ctx.row.original.isActive;
}

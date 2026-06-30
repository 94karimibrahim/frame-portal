import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { SkeletonComponent } from './skeleton.component';

/**
 * Loading placeholder for the department hierarchy tree. Mirrors {@link DepartmentTreeComponent}'s row
 * rhythm (`space-y-1`, `px-2 py-2`, a 6×6 toggle gutter, and `padding-inline-start` indentation that
 * mirrors under RTL) and fakes a few nesting levels so the shape reads as a tree, not a flat list:
 *
 * ```html
 * @if (loading()) { <app-tree-skeleton [rows]="7" /> } @else { … }
 * ```
 *
 * `aria-busy` + a hidden status label announce the load; the bars are decorative.
 */
@Component({
  selector: 'app-tree-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, SkeletonComponent],
  template: `
    <ul class="space-y-1" aria-busy="true" [attr.aria-label]="'common.loading' | transloco">
      @for (row of rowSpan(); track $index) {
        <li class="flex items-center gap-2 px-2 py-2" [style.padding-inline-start.rem]="row.indent">
          <app-skeleton class="h-6 w-6 shrink-0 rounded-theme-md" />
          <app-skeleton class="h-4" [class]="row.width" />
        </li>
      }
    </ul>
  `,
})
export class TreeSkeletonComponent {
  /** Number of placeholder rows (default 6). */
  readonly rows = input(6);

  // A fixed nesting pattern (depth per row) so the skeleton suggests a hierarchy; narrower bars deeper in.
  private static readonly LEVELS = [0, 1, 1, 2, 0, 1, 2, 1] as const;
  private static readonly WIDTHS = ['w-48', 'w-40', 'w-32'] as const;

  protected readonly rowSpan = computed(() =>
    Array.from({ length: Math.max(1, this.rows()) }, (_, i) => {
      const level = TreeSkeletonComponent.LEVELS[i % TreeSkeletonComponent.LEVELS.length];
      return {
        // Matches the tree's own indentation formula: 0.5rem base + 1.25rem per level.
        indent: 0.5 + level * 1.25,
        width: TreeSkeletonComponent.WIDTHS[level],
      };
    }),
  );
}

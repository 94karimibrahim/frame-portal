import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { Permissions } from '../../core/auth/permissions';
import { LocaleService } from '../../core/i18n/locale.service';
import { DepartmentTreeNode } from '../../core/models';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { resolveName } from './department.service';

/**
 * Renders one level of the department hierarchy and recurses into children (it imports itself). Each row
 * shows the culture-resolved name, an expand/collapse toggle when it has children, and permission-gated
 * actions (add sub-department / edit / delete). Expansion state is local; nodes start expanded so the whole
 * tree is visible. Indentation uses `padding-inline-start` so it mirrors correctly under RTL.
 */
@Component({
  selector: 'app-department-tree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, HasPermissionDirective, DepartmentTreeComponent],
  template: `
    <ul class="space-y-1" role="group">
      @for (node of nodes(); track node.id) {
        <li>
          <div
            class="group flex items-center gap-2 rounded-theme-lg px-2 py-2 transition hover:bg-gray-50 dark:hover:bg-white/5"
            [style.padding-inline-start.rem]="0.5 + level() * 1.25"
          >
            @if (node.children.length) {
              <button
                type="button"
                class="flex h-6 w-6 shrink-0 items-center justify-center rounded-theme-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                [attr.aria-expanded]="!collapsed().has(node.id)"
                [attr.aria-label]="
                  (collapsed().has(node.id) ? 'departments.expand' : 'departments.collapse')
                    | transloco
                "
                (click)="toggle(node.id)"
              >
                <svg
                  class="h-4 w-4 transition-transform rtl:-scale-x-100"
                  [class.rotate-90]="!collapsed().has(node.id)"
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
              </button>
            } @else {
              <span class="h-6 w-6 shrink-0" aria-hidden="true"></span>
            }

            <span
              class="min-w-0 flex-1 truncate text-theme-sm font-medium text-gray-800 dark:text-gray-100"
            >
              {{ name(node) }}
            </span>

            <div
              class="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100"
            >
              <button
                *appHasPermission="perms.create"
                type="button"
                class="rounded-theme-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-500 dark:hover:bg-gray-800"
                [attr.aria-label]="'departments.addChild' | transloco"
                (click)="addChild.emit(node)"
              >
                <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    d="M10 5a.75.75 0 0 1 .75.75v3.5h3.5a.75.75 0 0 1 0 1.5h-3.5v3.5a.75.75 0 0 1-1.5 0v-3.5h-3.5a.75.75 0 0 1 0-1.5h3.5v-3.5A.75.75 0 0 1 10 5Z"
                  />
                </svg>
              </button>
              <button
                *appHasPermission="perms.update"
                type="button"
                class="rounded-theme-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-brand-500 dark:hover:bg-gray-800"
                [attr.aria-label]="'departments.edit' | transloco"
                (click)="edit.emit(node)"
              >
                <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    d="M13.586 3.586a2 2 0 1 1 2.828 2.828l-8.5 8.5a2 2 0 0 1-.878.512l-3 .857a.75.75 0 0 1-.926-.926l.857-3a2 2 0 0 1 .512-.878l8.5-8.5Z"
                  />
                </svg>
              </button>
              <button
                *appHasPermission="perms.delete"
                type="button"
                class="rounded-theme-md p-1.5 text-gray-400 hover:bg-error-50 hover:text-error-500 dark:hover:bg-error-500/10"
                [attr.aria-label]="'common.delete' | transloco"
                (click)="remove.emit(node)"
              >
                <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path
                    fill-rule="evenodd"
                    clip-rule="evenodd"
                    d="M8.75 1a1 1 0 0 0-.96.71L7.4 3H4a1 1 0 0 0 0 2h12a1 1 0 1 0 0-2h-3.4l-.39-1.29A1 1 0 0 0 11.25 1h-2.5ZM6 7a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Zm4 0a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1Z"
                  />
                </svg>
              </button>
            </div>
          </div>

          @if (node.children.length && !collapsed().has(node.id)) {
            <app-department-tree
              [nodes]="node.children"
              [level]="level() + 1"
              (addChild)="addChild.emit($event)"
              (edit)="edit.emit($event)"
              (remove)="remove.emit($event)"
            />
          }
        </li>
      }
    </ul>
  `,
})
export class DepartmentTreeComponent {
  private readonly locale = inject(LocaleService);
  protected readonly perms = Permissions.departments;

  readonly nodes = input.required<DepartmentTreeNode[]>();
  readonly level = input<number>(0);

  readonly addChild = output<DepartmentTreeNode>();
  readonly edit = output<DepartmentTreeNode>();
  readonly remove = output<DepartmentTreeNode>();

  /** Ids of nodes the user has collapsed; everything else is expanded by default. */
  protected readonly collapsed = signal<ReadonlySet<string>>(new Set());

  protected name(node: DepartmentTreeNode): string {
    return resolveName(node, this.locale.culture());
  }

  protected toggle(id: string): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }
}

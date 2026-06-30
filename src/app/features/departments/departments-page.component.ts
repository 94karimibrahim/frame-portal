import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Permissions } from '../../core/auth/permissions';
import { LocaleService } from '../../core/i18n/locale.service';
import { AppError, DepartmentTreeNode } from '../../core/models';
import { NotificationService } from '../../core/notifications/notification.service';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ModalComponent } from '../../shared/ui/modal.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { SpinnerComponent } from '../../shared/ui/spinner.component';
import { TreeSkeletonComponent } from '../../shared/ui/tree-skeleton.component';
import { DepartmentTreeComponent } from './department-tree.component';
import {
  DepartmentDialogInput,
  DepartmentFormDialogComponent,
} from './department-form-dialog.component';
import { DepartmentService, resolveName } from './department.service';

/**
 * Departments management page — the first full CRUD vertical (FRONTEND_PLAN §19.5): a hierarchical tree
 * with create / edit / delete, per-row permission gating, the create/edit dialog, and a delete
 * confirmation. Loads the portal tree (with raw translations) and drives every label through Transloco so
 * it works in both en and ar/RTL.
 */
@Component({
  selector: 'app-departments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    HasPermissionDirective,
    PageHeaderComponent,
    CardComponent,
    SpinnerComponent,
    TreeSkeletonComponent,
    EmptyStateComponent,
    ModalComponent,
    DepartmentTreeComponent,
    DepartmentFormDialogComponent,
  ],
  template: `
    <app-page-header
      [title]="'departments.title' | transloco"
      [subtitle]="'departments.subtitle' | transloco"
    >
      <div actions>
        <button
          *appHasPermission="perms.create"
          type="button"
          class="btn btn-primary"
          (click)="openCreate(null)"
        >
          <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              d="M10 5a.75.75 0 0 1 .75.75v3.5h3.5a.75.75 0 0 1 0 1.5h-3.5v3.5a.75.75 0 0 1-1.5 0v-3.5h-3.5a.75.75 0 0 1 0-1.5h3.5v-3.5A.75.75 0 0 1 10 5Z"
            />
          </svg>
          {{ 'departments.new' | transloco }}
        </button>
      </div>
    </app-page-header>

    <app-card [padding]="false">
      <div class="p-2 sm:p-3">
        @if (loading()) {
          <app-tree-skeleton [rows]="7" />
        } @else if (loadError()) {
          <app-empty-state [title]="'departments.loadError' | transloco">
            <button type="button" class="btn btn-secondary" (click)="load()">
              {{ 'common.retry' | transloco }}
            </button>
          </app-empty-state>
        } @else if (nodes().length === 0) {
          <app-empty-state
            [title]="'departments.empty' | transloco"
            [description]="'departments.emptyHint' | transloco"
          >
            <button
              *appHasPermission="perms.create"
              type="button"
              class="btn btn-primary"
              (click)="openCreate(null)"
            >
              {{ 'departments.new' | transloco }}
            </button>
          </app-empty-state>
        } @else {
          <app-department-tree
            [nodes]="nodes()"
            (addChild)="openCreate($event)"
            (edit)="openEdit($event)"
            (remove)="askDelete($event)"
          />
        }
      </div>
    </app-card>

    @if (dialog(); as input) {
      <app-department-form-dialog
        [data]="input"
        (saved)="onSaved(input.mode)"
        (closed)="closeDialog()"
      />
    }

    @if (pendingDelete(); as target) {
      <app-modal
        [title]="'departments.deleteTitle' | transloco"
        widthClass="max-w-md"
        (closed)="closeDelete()"
      >
        <p class="text-theme-sm text-gray-600 dark:text-gray-300">
          {{ 'departments.deleteConfirm' | transloco: { name: target.name } }}
        </p>
        <div modalFooter class="flex items-center justify-end gap-3">
          <button
            type="button"
            class="btn btn-secondary"
            (click)="closeDelete()"
            [disabled]="deleting()"
          >
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            type="button"
            class="btn btn-danger"
            (click)="confirmDelete()"
            [disabled]="deleting()"
          >
            @if (deleting()) {
              <app-spinner size="sm" />
            }
            {{ 'common.delete' | transloco }}
          </button>
        </div>
      </app-modal>
    }
  `,
})
export class DepartmentsPageComponent {
  private readonly service = inject(DepartmentService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  private readonly locale = inject(LocaleService);
  protected readonly perms = Permissions.departments;

  protected readonly nodes = signal<DepartmentTreeNode[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly dialog = signal<DepartmentDialogInput | null>(null);
  protected readonly pendingDelete = signal<{ id: string; name: string } | null>(null);
  protected readonly deleting = signal(false);

  /**
   * Child-id → parent-id (null for top level) and id → node, derived from the loaded tree. The tree DTO
   * carries no `parentId`, so on edit we look the current parent up here and send it back unchanged —
   * otherwise the backend would treat a missing parent as a move to the root.
   */
  private parentById = new Map<string, string | null>();
  private nodeById = new Map<string, DepartmentTreeNode>();

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.service.getTree().subscribe({
      next: (tree) => {
        this.indexTree(tree, null);
        this.nodes.set(tree);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  private indexTree(nodes: DepartmentTreeNode[], parentId: string | null): void {
    if (parentId === null) {
      this.parentById.clear();
      this.nodeById.clear();
    }
    for (const node of nodes) {
      this.parentById.set(node.id, parentId);
      this.nodeById.set(node.id, node);
      this.indexTree(node.children, node.id);
    }
  }

  /** Open the create dialog, optionally under a parent node (null = top level). */
  protected openCreate(parent: DepartmentTreeNode | null): void {
    this.dialog.set({
      mode: 'create',
      parentId: parent?.id ?? null,
      parentName: parent ? resolveName(parent, this.locale.culture()) : null,
      sortOrder: 0,
    });
  }

  protected openEdit(node: DepartmentTreeNode): void {
    // Preserve the existing parent (reparenting is out of scope for this slice).
    const parentId = this.parentById.get(node.id) ?? null;
    const parent = parentId ? this.nodeById.get(parentId) : null;
    this.dialog.set({
      mode: 'edit',
      id: node.id,
      parentId,
      parentName: parent ? resolveName(parent, this.locale.culture()) : null,
      name: node.name,
      description: node.description,
      sortOrder: node.sortOrder,
      translations: node.translations,
    });
  }

  protected askDelete(node: DepartmentTreeNode): void {
    this.pendingDelete.set({ id: node.id, name: resolveName(node, this.locale.culture()) });
  }

  protected closeDialog(): void {
    this.dialog.set(null);
  }

  protected closeDelete(): void {
    if (!this.deleting()) {
      this.pendingDelete.set(null);
    }
  }

  protected onSaved(mode: 'create' | 'edit'): void {
    this.closeDialog();
    this.notify.success(
      this.transloco.translate(mode === 'edit' ? 'departments.updated' : 'departments.created'),
    );
    this.load();
  }

  /**
   * Optimistic delete: prune the node (and its subtree) from the tree immediately — rebuilding the
   * parent/node index so it stays consistent — and close the dialog, then call the server. On failure,
   * restore the tree and index and surface the reason (nothing else toasts this path).
   */
  protected confirmDelete(): void {
    const target = this.pendingDelete();
    if (!target) {
      return;
    }
    const snapshot = this.nodes();
    const pruned = this.pruneNode(snapshot, target.id);
    this.nodes.set(pruned);
    this.indexTree(pruned, null);
    this.pendingDelete.set(null);
    this.service.remove(target.id).subscribe({
      next: () => this.notify.success(this.transloco.translate('departments.deleted')),
      error: (err: AppError) => {
        this.nodes.set(snapshot);
        this.indexTree(snapshot, null);
        this.notify.error(err?.detail || this.transloco.translate('common.actionFailed'));
      },
    });
  }

  /** Remove a node (and its subtree) from the tree by id, returning a new tree (optimistic helper). */
  private pruneNode(tree: DepartmentTreeNode[], id: string): DepartmentTreeNode[] {
    return tree
      .filter((node) => node.id !== id)
      .map((node) =>
        node.children.length ? { ...node, children: this.pruneNode(node.children, id) } : node,
      );
  }
}

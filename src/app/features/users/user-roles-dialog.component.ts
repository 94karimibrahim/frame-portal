import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { forkJoin } from 'rxjs';
import { RoleListItem } from '../../core/models';
import { ModalComponent } from '../../shared/ui/modal.component';
import { MultiSelectComponent, MultiSelectOption } from '../../shared/ui/multi-select.component';
import { SpinnerComponent } from '../../shared/ui/spinner.component';
import { RoleService } from '../roles/role.service';
import { UserService } from './user.service';

/** Identifies the user whose role membership is being edited. */
export interface UserRolesDialogInput {
  userId: string;
  userName: string;
}

/**
 * Manage which roles a user belongs to (FRONTEND_PLAN role↔user assignment). Loads the full role set and the
 * user's current roles, then on save applies only the diff: assign newly-checked roles, remove unchecked
 * ones (`POST`/`DELETE /roles/{roleId}/users/{userId}`). Requires `roles.assign`, enforced by the backend.
 */
@Component({
  selector: 'app-user-roles-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoModule, ModalComponent, SpinnerComponent, MultiSelectComponent],
  template: `
    <app-modal
      [title]="'users.rolesTitle' | transloco: { name: data().userName }"
      (closed)="closed.emit()"
    >
      @if (loading()) {
        <div class="flex justify-center py-12"><app-spinner size="lg" /></div>
      } @else if (allRoles().length === 0) {
        <p class="py-4 text-theme-sm text-gray-500 dark:text-gray-400">
          {{ 'roles.empty' | transloco }}
        </p>
      } @else {
        <app-multi-select
          [options]="roleOptions()"
          [value]="selectedValues()"
          (valueChange)="onRolesChange($event)"
          [placeholder]="'users.rolesPlaceholder' | transloco"
          [ariaLabel]="'users.rolesTitle' | transloco: { name: data().userName }"
        />
      }

      <div modalFooter class="flex items-center justify-end gap-3">
        <button
          type="button"
          class="btn btn-secondary"
          (click)="closed.emit()"
          [disabled]="saving()"
        >
          {{ 'common.cancel' | transloco }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          (click)="save()"
          [disabled]="saving() || loading()"
        >
          @if (saving()) {
            <app-spinner size="sm" />
          }
          {{ 'common.save' | transloco }}
        </button>
      </div>
    </app-modal>
  `,
})
export class UserRolesDialogComponent implements OnInit {
  private readonly users = inject(UserService);
  private readonly roles = inject(RoleService);

  readonly data = input.required<UserRolesDialogInput>();
  readonly saved = output<void>();
  readonly closed = output<void>();

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly allRoles = signal<RoleListItem[]>([]);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  private original: ReadonlySet<string> = new Set();

  /** Role list as multi-select options (colour swatch carried through). */
  protected readonly roleOptions = computed<MultiSelectOption[]>(() =>
    this.allRoles().map((r) => ({ value: r.id, label: r.name, color: r.color })),
  );
  /** The selection as the array the multi-select consumes. */
  protected readonly selectedValues = computed(() => [...this.selected()]);

  ngOnInit(): void {
    forkJoin({
      all: this.roles.listAll(),
      mine: this.users.getRoles(this.data().userId),
    }).subscribe({
      next: ({ all, mine }) => {
        this.allRoles.set(all.items);
        const current = new Set(mine.map((r) => r.id));
        this.original = current;
        this.selected.set(new Set(current));
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.closed.emit();
      },
    });
  }

  protected onRolesChange(values: string[]): void {
    this.selected.set(new Set(values));
  }

  protected save(): void {
    const userId = this.data().userId;
    const selected = this.selected();
    const toAdd = [...selected].filter((id) => !this.original.has(id));
    const toRemove = [...this.original].filter((id) => !selected.has(id));

    if (toAdd.length === 0 && toRemove.length === 0) {
      this.closed.emit();
      return;
    }

    this.saving.set(true);
    const calls = [
      ...toAdd.map((roleId) => this.roles.assignToUser(roleId, userId)),
      ...toRemove.map((roleId) => this.roles.removeFromUser(roleId, userId)),
    ];
    forkJoin(calls).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }
}

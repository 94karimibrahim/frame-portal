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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Observable, forkJoin } from 'rxjs';
import {
  CreateRoleRequest,
  Role,
  RoleListItem,
  RowTranslation,
  UpdateRoleRequest,
} from '../../core/models';
import { ModalComponent } from '../../shared/ui/modal.component';
import { SpinnerComponent } from '../../shared/ui/spinner.component';
import { FieldFeedbackComponent } from '../../shared/forms/field-feedback.component';
import { ServerFormBase } from '../../shared/forms/server-form.base';
import { PermissionService } from '../permissions/permission.service';
import { PermissionGroup, groupByModule } from '../permissions/permission-grouping';
import { RoleService } from './role.service';

/** Open the editor for a new role, or to edit an existing one (then `role` carries the prefill + codes). */
export interface RoleDialogInput {
  mode: 'create' | 'edit';
  role?: Role;
}

/**
 * Create or edit a role: core fields (name, description, hierarchy [create-only], display order, colour,
 * parent role), the active toggle (edit-only), the grouped permission picker, and the optional Arabic
 * translation. The parent list and permission catalogue are fetched when the dialog opens. Server
 * validation codes map back onto controls via {@link ServerFormBase}.
 */
@Component({
  selector: 'app-role-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslocoModule,
    ModalComponent,
    SpinnerComponent,
    FieldFeedbackComponent,
  ],
  template: `
    <app-modal
      [title]="(data().mode === 'edit' ? 'roles.editTitle' : 'roles.createTitle') | transloco"
      widthClass="max-w-2xl"
      (closed)="closed.emit()"
    >
      @if (loadingMeta()) {
        <div class="flex justify-center py-12"><app-spinner size="lg" /></div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (formError(); as message) {
            <div class="mb-4 alert-error" role="alert">{{ message }}</div>
          }

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <label class="form-label" for="r-name">{{ 'roles.name' | transloco }}</label>
              <input
                id="r-name"
                type="text"
                formControlName="name"
                class="form-input"
                [class.form-input--error]="invalid(form.controls.name)"
                [class.form-input--success]="showSuccess(form.controls.name)"
              />
              <app-field-feedback
                [error]="errorFor(form.controls.name)"
                [success]="showSuccess(form.controls.name)"
              />
            </div>
            <div class="sm:col-span-2">
              <label class="form-label" for="r-description">{{
                'roles.description' | transloco
              }}</label>
              <textarea
                id="r-description"
                rows="2"
                formControlName="description"
                class="form-input"
              ></textarea>
            </div>

            @if (data().mode === 'create') {
              <div>
                <label class="form-label" for="r-hierarchy">{{
                  'roles.hierarchy' | transloco
                }}</label>
                <input
                  id="r-hierarchy"
                  type="number"
                  formControlName="hierarchy"
                  class="form-input"
                  [class.form-input--error]="invalid(form.controls.hierarchy)"
                  [class.form-input--success]="showSuccess(form.controls.hierarchy)"
                />
                <app-field-feedback
                  [error]="errorFor(form.controls.hierarchy)"
                  [success]="showSuccess(form.controls.hierarchy)"
                />
              </div>
            }
            <div>
              <label class="form-label" for="r-displayOrder">{{
                'roles.displayOrder' | transloco
              }}</label>
              <input
                id="r-displayOrder"
                type="number"
                formControlName="displayOrder"
                class="form-input"
              />
            </div>
            <div>
              <label class="form-label" for="r-color">{{ 'roles.color' | transloco }}</label>
              <input
                id="r-color"
                type="text"
                formControlName="color"
                placeholder="#2563eb"
                class="form-input"
              />
              <app-field-feedback [warning]="colorWarning()" />
            </div>
            <div>
              <label class="form-label" for="r-parent">{{ 'roles.parent' | transloco }}</label>
              <select id="r-parent" formControlName="parentRoleId" class="form-input">
                <option value="">{{ 'roles.noParent' | transloco }}</option>
                @for (option of parentOptions(); track option.id) {
                  <option [value]="option.id">{{ option.name }}</option>
                }
              </select>
            </div>

            @if (data().mode === 'edit') {
              <label class="flex items-center gap-2 self-end pb-2.5">
                <input
                  type="checkbox"
                  formControlName="isActive"
                  class="h-4 w-4 rounded-sm border-gray-300 text-brand-500"
                />
                <span class="text-theme-sm text-gray-700 dark:text-gray-200">{{
                  'roles.active' | transloco
                }}</span>
              </label>
            }
          </div>

          <fieldset class="mt-4 rounded-theme-lg border border-gray-200 p-4 dark:border-gray-800">
            <legend class="px-1 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              {{ 'roles.permissions' | transloco }}
            </legend>
            <div class="mt-1 space-y-4">
              @for (group of groups(); track group.module) {
                <div>
                  <label class="flex items-center gap-2">
                    <input
                      type="checkbox"
                      class="h-4 w-4 rounded-sm border-gray-300 text-brand-500"
                      [checked]="isModuleFull(group)"
                      [indeterminate]="isModulePartial(group)"
                      (change)="toggleModule(group, $any($event.target).checked)"
                    />
                    <span
                      class="text-theme-sm font-semibold capitalize text-gray-700 dark:text-gray-200"
                      >{{ group.module }}</span
                    >
                  </label>
                  <div class="mt-2 grid grid-cols-1 gap-1.5 ps-6 sm:grid-cols-2">
                    @for (permission of group.items; track permission.id) {
                      <label class="flex items-center gap-2">
                        <input
                          type="checkbox"
                          class="h-4 w-4 rounded-sm border-gray-300 text-brand-500"
                          [checked]="selected().has(permission.code)"
                          (change)="toggle(permission.code)"
                        />
                        <span class="text-theme-xs text-gray-600 dark:text-gray-300">{{
                          permission.code
                        }}</span>
                      </label>
                    }
                  </div>
                </div>
              }
            </div>
          </fieldset>

          <fieldset class="mt-4 rounded-theme-lg border border-gray-200 p-4 dark:border-gray-800">
            <legend class="px-1 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
              {{ 'roles.translationsHeading' | transloco }}
            </legend>
            <div class="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label class="form-label" for="r-nameAr">{{ 'roles.nameAr' | transloco }}</label>
                <input
                  id="r-nameAr"
                  type="text"
                  dir="rtl"
                  formControlName="nameAr"
                  class="form-input"
                />
              </div>
              <div>
                <label class="form-label" for="r-descriptionAr">{{
                  'roles.descriptionAr' | transloco
                }}</label>
                <input
                  id="r-descriptionAr"
                  type="text"
                  dir="rtl"
                  formControlName="descriptionAr"
                  class="form-input"
                />
              </div>
            </div>
          </fieldset>
        </form>
      }

      <div modalFooter class="flex items-center justify-end gap-3">
        <button
          type="button"
          class="btn btn-secondary"
          (click)="closed.emit()"
          [disabled]="submitting()"
        >
          {{ 'common.cancel' | transloco }}
        </button>
        <button
          type="button"
          class="btn btn-primary"
          (click)="submit()"
          [disabled]="submitting() || loadingMeta()"
        >
          @if (submitting()) {
            <app-spinner size="sm" />
          }
          {{ 'common.save' | transloco }}
        </button>
      </div>
    </app-modal>
  `,
})
export class RoleFormDialogComponent extends ServerFormBase implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly roles = inject(RoleService);
  private readonly permissionsApi = inject(PermissionService);

  readonly data = input.required<RoleDialogInput>();
  readonly saved = output<void>();
  readonly closed = output<void>();

  protected readonly loadingMeta = signal(true);
  protected readonly groups = signal<PermissionGroup[]>([]);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  private readonly allRoles = signal<RoleListItem[]>([]);

  /** Roles eligible as parent: everything except the role being edited (no self-parenting). */
  protected readonly parentOptions = computed(() => {
    const editingId = this.data().role?.id;
    return this.allRoles().filter((r) => r.id !== editingId);
  });

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    description: [''],
    hierarchy: [0, [Validators.required]],
    displayOrder: [0],
    color: [''],
    parentRoleId: [''],
    isActive: [true],
    nameAr: [''],
    descriptionAr: [''],
  });

  ngOnInit(): void {
    const role = this.data().role;
    if (role) {
      this.prime(role);
    }
    forkJoin({ permissions: this.permissionsApi.list(), roles: this.roles.listAll() }).subscribe({
      next: ({ permissions, roles }) => {
        this.groups.set(groupByModule(permissions));
        this.allRoles.set(roles.items);
        this.loadingMeta.set(false);
      },
      error: () => {
        // Surface via the interceptor toast and close — the editor is unusable without its metadata.
        this.loadingMeta.set(false);
        this.closed.emit();
      },
    });
  }

  private prime(role: Role): void {
    const ar = role.translations.find((t) => t.lang === 'ar');
    this.form.patchValue({
      name: role.name,
      description: role.description ?? '',
      displayOrder: role.displayOrder,
      color: role.color ?? '',
      parentRoleId: role.parentRoleId ?? '',
      isActive: role.isActive,
      nameAr: ar?.name ?? '',
      descriptionAr: ar?.description ?? '',
    });
    this.selected.set(new Set(role.permissionCodes));
  }

  /**
   * Non-blocking caution for the colour field: a typed value that isn't a 6-digit hex still submits (the
   * backend tolerates it), but we nudge toward the expected format. Read live in the template.
   */
  protected colorWarning(): string | null {
    const value = this.form.controls.color.value.trim();
    if (!value || /^#[0-9a-f]{6}$/i.test(value)) {
      return null;
    }
    return this.transloco.translate('roles.colorWarning');
  }

  protected toggle(code: string): void {
    this.selected.update((set) => {
      const next = new Set(set);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }

  protected toggleModule(group: PermissionGroup, checked: boolean): void {
    this.selected.update((set) => {
      const next = new Set(set);
      for (const permission of group.items) {
        if (checked) {
          next.add(permission.code);
        } else {
          next.delete(permission.code);
        }
      }
      return next;
    });
  }

  protected isModuleFull(group: PermissionGroup): boolean {
    return group.items.every((p) => this.selected().has(p.code));
  }

  protected isModulePartial(group: PermissionGroup): boolean {
    return !this.isModuleFull(group) && group.items.some((p) => this.selected().has(p.code));
  }

  protected submit(): void {
    this.submitted.set(true);
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const translations = this.buildTranslations(v.nameAr, v.descriptionAr);
    const codes = [...this.selected()];
    this.submitting.set(true);
    const d = this.data();

    const request$: Observable<unknown> =
      d.mode === 'edit' && d.role
        ? this.roles.update(d.role.id, {
            name: v.name.trim(),
            description: v.description.trim() || null,
            permissionCodes: codes,
            isActive: v.isActive,
            displayOrder: Number(v.displayOrder) || 0,
            color: v.color.trim() || null,
            updateParent: true,
            parentRoleId: v.parentRoleId || null,
            translations: translations.length ? translations : null,
          } satisfies UpdateRoleRequest)
        : this.roles.create({
            name: v.name.trim(),
            description: v.description.trim() || null,
            hierarchy: Number(v.hierarchy) || 0,
            permissionCodes: codes,
            displayOrder: Number(v.displayOrder) || 0,
            color: v.color.trim() || null,
            parentRoleId: v.parentRoleId || null,
            translations: translations.length ? translations : null,
          } satisfies CreateRoleRequest);

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
      },
      error: (err) => this.handleError(err, this.form),
    });
  }

  private buildTranslations(nameAr: string, descriptionAr: string): RowTranslation[] {
    const name = nameAr.trim();
    const description = descriptionAr.trim();
    if (!name && !description) {
      return [];
    }
    return [{ lang: 'ar', name: name || null, description: description || null }];
  }
}

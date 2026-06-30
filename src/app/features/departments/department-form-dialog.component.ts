import { ChangeDetectionStrategy, Component, OnInit, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { TranslocoModule } from '@jsverse/transloco';
import {
  CreateDepartmentRequest,
  RowTranslation,
  UpdateDepartmentRequest,
} from '../../core/models';
import { ModalComponent } from '../../shared/ui/modal.component';
import { SpinnerComponent } from '../../shared/ui/spinner.component';
import { FieldFeedbackComponent } from '../../shared/forms/field-feedback.component';
import { ServerFormBase } from '../../shared/forms/server-form.base';
import { DepartmentService } from './department.service';

/** Everything the dialog needs to open in either create or edit mode. */
export interface DepartmentDialogInput {
  mode: 'create' | 'edit';
  /** The node being edited (edit mode only). */
  id?: string;
  /** Parent the node sits under: for create, where the new node is added; null = top level. */
  parentId: string | null;
  /** Parent's display name, for header context; null = top level. */
  parentName: string | null;
  name?: string;
  description?: string | null;
  sortOrder?: number;
  translations?: RowTranslation[];
}

/**
 * Create/edit a single department. Reparenting is intentionally out of scope for this first slice — a
 * node keeps its current parent on edit — so the form stays a flat set of fields plus the optional Arabic
 * translation. Server validation codes map back onto the controls via {@link ServerFormBase}. Emits
 * {@link saved} on success (the page reloads the tree and toasts) and {@link closed} otherwise.
 */
@Component({
  selector: 'app-department-form-dialog',
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
      [title]="
        (data().mode === 'edit' ? 'departments.editTitle' : 'departments.createTitle') | transloco
      "
      (closed)="closed.emit()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (data().parentName) {
          <p class="mb-4 text-theme-xs text-gray-500 dark:text-gray-400">
            {{ 'departments.parent' | transloco }}:
            <span class="font-medium text-gray-700 dark:text-gray-200">{{
              data().parentName
            }}</span>
          </p>
        }

        @if (formError(); as message) {
          <div class="mb-4 alert-error" role="alert">{{ message }}</div>
        }

        <div class="mb-4">
          <label class="form-label" for="dept-name">{{ 'departments.name' | transloco }}</label>
          <input
            id="dept-name"
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

        <div class="mb-4">
          <label class="form-label" for="dept-description">{{
            'departments.description' | transloco
          }}</label>
          <textarea
            id="dept-description"
            rows="2"
            formControlName="description"
            class="form-input"
          ></textarea>
        </div>

        <div class="mb-5">
          <label class="form-label" for="dept-sortOrder">{{
            'departments.sortOrder' | transloco
          }}</label>
          <input
            id="dept-sortOrder"
            type="number"
            formControlName="sortOrder"
            class="form-input"
            [class.form-input--error]="invalid(form.controls.sortOrder)"
            [class.form-input--success]="showSuccess(form.controls.sortOrder)"
          />
          <app-field-feedback
            [error]="errorFor(form.controls.sortOrder)"
            [success]="showSuccess(form.controls.sortOrder)"
          />
        </div>

        <fieldset class="rounded-theme-lg border border-gray-200 p-4 dark:border-gray-800">
          <legend class="px-1 text-theme-xs font-medium text-gray-500 dark:text-gray-400">
            {{ 'departments.translationsHeading' | transloco }}
          </legend>
          <div class="mt-1">
            <label class="form-label" for="dept-nameAr">{{
              'departments.nameAr' | transloco
            }}</label>
            <input
              id="dept-nameAr"
              type="text"
              dir="rtl"
              formControlName="nameAr"
              class="form-input"
            />
          </div>
          <div class="mt-3">
            <label class="form-label" for="dept-descriptionAr">{{
              'departments.descriptionAr' | transloco
            }}</label>
            <textarea
              id="dept-descriptionAr"
              rows="2"
              dir="rtl"
              formControlName="descriptionAr"
              class="form-input"
            ></textarea>
          </div>
        </fieldset>
      </form>

      <div modalFooter class="flex items-center justify-end gap-3">
        <button
          type="button"
          class="btn btn-secondary"
          (click)="closed.emit()"
          [disabled]="submitting()"
        >
          {{ 'common.cancel' | transloco }}
        </button>
        <button type="button" class="btn btn-primary" (click)="submit()" [disabled]="submitting()">
          @if (submitting()) {
            <app-spinner size="sm" />
          }
          {{ 'common.save' | transloco }}
        </button>
      </div>
    </app-modal>
  `,
})
export class DepartmentFormDialogComponent extends ServerFormBase implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(DepartmentService);

  readonly data = input.required<DepartmentDialogInput>();
  /** Emitted after a successful create/update so the host can reload + close. */
  readonly saved = output<void>();
  readonly closed = output<void>();

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    description: [''],
    sortOrder: [0, [Validators.required]],
    nameAr: [''],
    descriptionAr: [''],
  });

  ngOnInit(): void {
    const d = this.data();
    const ar = d.translations?.find((t) => t.lang === 'ar');
    this.form.setValue({
      name: d.name ?? '',
      description: d.description ?? '',
      sortOrder: d.sortOrder ?? 0,
      nameAr: ar?.name ?? '',
      descriptionAr: ar?.description ?? '',
    });
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
    const base = {
      name: v.name.trim(),
      parentId: this.data().parentId,
      sortOrder: Number(v.sortOrder) || 0,
      description: v.description.trim() || null,
      translations: translations.length ? translations : null,
    };

    this.submitting.set(true);
    const d = this.data();
    const request$: Observable<unknown> =
      d.mode === 'edit' && d.id
        ? this.service.update(d.id, base as UpdateDepartmentRequest)
        : this.service.create(base as CreateDepartmentRequest);

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

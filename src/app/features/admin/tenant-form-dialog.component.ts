import { ChangeDetectionStrategy, Component, OnInit, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Observable } from 'rxjs';
import { SUPPORTED_CULTURES } from '../../core/i18n/locale.service';
import { CreateTenantRequest, Tenant, UpdateTenantRequest } from '../../core/models';
import { ModalComponent } from '../../shared/ui/modal.component';
import { SpinnerComponent } from '../../shared/ui/spinner.component';
import { FieldFeedbackComponent } from '../../shared/forms/field-feedback.component';
import { ServerFormBase } from '../../shared/forms/server-form.base';
import { TenantService } from './tenant.service';

/** Open the dialog for a new tenant, or to edit an existing one (then `tenant` carries the prefill). */
export interface TenantDialogInput {
  mode: 'create' | 'edit';
  tenant?: Tenant;
}

/**
 * Create or edit a tenant. Slug and features are set at creation only (the backend's `UpdateTenantRequest`
 * accepts just name / subscription tier / default culture), so those controls are hidden when editing.
 */
@Component({
  selector: 'app-tenant-form-dialog',
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
        (data().mode === 'edit' ? 'admin.tenants.editTitle' : 'admin.tenants.createTitle')
          | transloco
      "
      widthClass="max-w-lg"
      (closed)="closed.emit()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (formError(); as message) {
          <div class="mb-4 alert-error" role="alert">{{ message }}</div>
        }
        <div class="space-y-4">
          <div>
            <label class="form-label" for="t-name">{{ 'admin.tenants.name' | transloco }}</label>
            <input
              id="t-name"
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

          @if (data().mode === 'create') {
            <div>
              <label class="form-label" for="t-slug">{{ 'admin.tenants.slug' | transloco }}</label>
              <input
                id="t-slug"
                type="text"
                formControlName="slug"
                class="form-input"
                [class.form-input--error]="invalid(form.controls.slug)"
                [class.form-input--success]="showSuccess(form.controls.slug)"
              />
              <app-field-feedback
                [error]="errorFor(form.controls.slug)"
                [success]="showSuccess(form.controls.slug)"
              />
            </div>
          }

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="form-label" for="t-tier">{{ 'admin.tenants.tier' | transloco }}</label>
              <input
                id="t-tier"
                type="text"
                formControlName="subscriptionTier"
                class="form-input"
                [class.form-input--error]="invalid(form.controls.subscriptionTier)"
                [class.form-input--success]="showSuccess(form.controls.subscriptionTier)"
              />
              <app-field-feedback
                [error]="errorFor(form.controls.subscriptionTier)"
                [success]="showSuccess(form.controls.subscriptionTier)"
              />
            </div>
            <div>
              <label class="form-label" for="t-culture">{{
                'admin.tenants.defaultCulture' | transloco
              }}</label>
              <select id="t-culture" formControlName="defaultCulture" class="form-input">
                <option value="">{{ 'common.none' | transloco }}</option>
                @for (c of cultures; track c) {
                  <option [value]="c">{{ c }}</option>
                }
              </select>
            </div>
          </div>

          @if (data().mode === 'create') {
            <div>
              <label class="form-label" for="t-features">{{
                'admin.tenants.features' | transloco
              }}</label>
              <input
                id="t-features"
                type="text"
                formControlName="features"
                class="form-input"
                [placeholder]="'admin.tenants.featuresPlaceholder' | transloco"
              />
            </div>
          }
        </div>
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
export class TenantFormDialogComponent extends ServerFormBase implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(TenantService);

  readonly data = input.required<TenantDialogInput>();
  readonly saved = output<void>();
  readonly closed = output<void>();

  protected readonly cultures = SUPPORTED_CULTURES;

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    slug: ['', [Validators.required]],
    subscriptionTier: ['', [Validators.required]],
    defaultCulture: [''],
    features: [''],
  });

  ngOnInit(): void {
    const d = this.data();
    if (d.mode === 'edit') {
      this.form.controls.slug.disable();
      this.form.controls.features.disable();
      if (d.tenant) {
        this.form.patchValue({
          name: d.tenant.name,
          subscriptionTier: d.tenant.subscriptionTier,
          defaultCulture: d.tenant.defaultCulture ?? '',
        });
      }
    }
  }

  protected submit(): void {
    this.submitted.set(true);
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    this.submitting.set(true);
    const d = this.data();
    const request$: Observable<unknown> =
      d.mode === 'edit' && d.tenant
        ? this.service.update(d.tenant.id, {
            name: v.name.trim(),
            subscriptionTier: v.subscriptionTier.trim(),
            defaultCulture: v.defaultCulture || null,
          } satisfies UpdateTenantRequest)
        : this.service.create({
            name: v.name.trim(),
            slug: v.slug.trim(),
            subscriptionTier: v.subscriptionTier.trim(),
            features: v.features
              ? [
                  ...new Set(
                    v.features
                      .split(/[\s,]+/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  ),
                ]
              : null,
            defaultCulture: v.defaultCulture || null,
          } satisfies CreateTenantRequest);

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
      },
      error: (err) => this.handleError(err, this.form),
    });
  }
}

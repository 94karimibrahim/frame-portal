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
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { CreateDelegationRequest, UserListItem } from '../../core/models';
import { ModalComponent } from '../../shared/ui/modal.component';
import { MultiSelectComponent, MultiSelectOption } from '../../shared/ui/multi-select.component';
import { SpinnerComponent } from '../../shared/ui/spinner.component';
import { FieldFeedbackComponent } from '../../shared/forms/field-feedback.component';
import { ServerFormBase } from '../../shared/forms/server-form.base';
import { DelegationService } from './delegation.service';
import { CodeGroup, groupCodesByModule } from './delegation-grouping';

/** Inputs for the create dialog: the assignable users (when the caller can list them) + that flag. */
export interface DelegationDialogInput {
  users: UserListItem[];
  canListUsers: boolean;
}

/** Cross-field check: the end of the window must be after its start. */
function windowOrder(group: AbstractControl): ValidationErrors | null {
  const start = group.get('startsAt')?.value;
  const end = group.get('expiresAt')?.value;
  return start && end && new Date(end) <= new Date(start) ? { windowOrder: true } : null;
}

/**
 * Create a permission delegation. The delegate is picked from a dropdown when the caller can list users,
 * otherwise entered as a user id. Only the caller's **own** effective permissions can be delegated, so the
 * picker is built from `AuthService.permissions()` (no catalogue read required).
 */
@Component({
  selector: 'app-delegation-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslocoModule,
    ModalComponent,
    SpinnerComponent,
    FieldFeedbackComponent,
    MultiSelectComponent,
  ],
  template: `
    <app-modal
      [title]="'delegations.createTitle' | transloco"
      widthClass="max-w-xl"
      (closed)="closed.emit()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (formError(); as message) {
          <div class="mb-4 alert-error" role="alert">{{ message }}</div>
        }

        <div class="space-y-4">
          <div>
            <label class="form-label" for="d-to">{{ 'delegations.delegateTo' | transloco }}</label>
            @if (data().canListUsers) {
              <select
                id="d-to"
                formControlName="delegatedToId"
                class="form-input"
                [class.form-input--error]="invalid(form.controls.delegatedToId)"
                [class.form-input--success]="showSuccess(form.controls.delegatedToId)"
              >
                <option value="">{{ 'delegations.selectUser' | transloco }}</option>
                @for (u of data().users; track u.id) {
                  <option [value]="u.id">{{ u.fullName }} · {{ u.email }}</option>
                }
              </select>
            } @else {
              <input
                id="d-to"
                type="text"
                formControlName="delegatedToId"
                class="form-input"
                [placeholder]="'delegations.userIdPlaceholder' | transloco"
                [class.form-input--error]="invalid(form.controls.delegatedToId)"
                [class.form-input--success]="showSuccess(form.controls.delegatedToId)"
              />
            }
            <app-field-feedback
              [error]="errorFor(form.controls.delegatedToId)"
              [success]="showSuccess(form.controls.delegatedToId)"
            />
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="form-label" for="d-start">{{
                'delegations.startsAt' | transloco
              }}</label>
              <input
                id="d-start"
                type="datetime-local"
                formControlName="startsAt"
                class="form-input"
                [class.form-input--error]="invalid(form.controls.startsAt)"
                [class.form-input--success]="showSuccess(form.controls.startsAt)"
              />
              <app-field-feedback
                [error]="errorFor(form.controls.startsAt)"
                [success]="showSuccess(form.controls.startsAt)"
              />
            </div>
            <div>
              <label class="form-label" for="d-end">{{
                'delegations.expiresAt' | transloco
              }}</label>
              <input
                id="d-end"
                type="datetime-local"
                formControlName="expiresAt"
                class="form-input"
                [class.form-input--error]="invalid(form.controls.expiresAt) || showWindowError()"
                [class.form-input--success]="
                  showSuccess(form.controls.expiresAt) && !showWindowError()
                "
              />
              <app-field-feedback
                [error]="
                  showWindowError()
                    ? ('delegations.windowOrder' | transloco)
                    : errorFor(form.controls.expiresAt)
                "
                [success]="showSuccess(form.controls.expiresAt) && !showWindowError()"
              />
            </div>
          </div>

          <div>
            <span class="form-label">{{ 'delegations.permissions' | transloco }}</span>
            @if (groups().length === 0) {
              <p class="text-theme-sm text-gray-500 dark:text-gray-400">
                {{ 'delegations.noDelegatable' | transloco }}
              </p>
            } @else {
              @if (showPermError()) {
                <p class="form-error mb-2">{{ 'delegations.pickOne' | transloco }}</p>
              }
              <app-multi-select
                [options]="permOptions()"
                [value]="selectedPerms()"
                (valueChange)="onPermsChange($event)"
                [placeholder]="'delegations.permissionsPlaceholder' | transloco"
                [ariaLabel]="'delegations.permissions' | transloco"
              />
            }
          </div>
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
        <button
          type="button"
          class="btn btn-primary"
          (click)="submit()"
          [disabled]="submitting() || groups().length === 0"
        >
          @if (submitting()) {
            <app-spinner size="sm" />
          }
          {{ 'common.create' | transloco }}
        </button>
      </div>
    </app-modal>
  `,
})
export class DelegationFormDialogComponent extends ServerFormBase implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(DelegationService);
  private readonly auth = inject(AuthService);

  readonly data = input.required<DelegationDialogInput>();
  readonly saved = output<void>();
  readonly closed = output<void>();

  protected readonly groups = signal<CodeGroup[]>([]);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());

  /** Delegatable permission codes as grouped multi-select options (group = module). */
  protected readonly permOptions = computed<MultiSelectOption[]>(() =>
    this.groups().flatMap((g) =>
      g.codes.map((code) => ({ value: code, label: code, group: g.module })),
    ),
  );
  protected readonly selectedPerms = computed(() => [...this.selected()]);

  protected readonly form = this.fb.nonNullable.group(
    {
      delegatedToId: ['', [Validators.required]],
      startsAt: ['', [Validators.required]],
      expiresAt: ['', [Validators.required]],
    },
    { validators: windowOrder },
  );

  ngOnInit(): void {
    this.groups.set(groupCodesByModule([...this.auth.permissions()]));
  }

  protected onPermsChange(codes: string[]): void {
    this.selected.set(new Set(codes));
  }

  protected showWindowError(): boolean {
    return (
      (this.form.controls.expiresAt.touched || this.submitted()) &&
      this.form.errors?.['windowOrder'] === true
    );
  }

  protected showPermError(): boolean {
    return this.submitted() && this.selected().size === 0;
  }

  protected submit(): void {
    this.submitted.set(true);
    this.formError.set(null);
    if (this.form.invalid || this.selected().size === 0) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const request: CreateDelegationRequest = {
      delegatedToId: v.delegatedToId.trim(),
      permissionSet: [...this.selected()],
      startsAt: new Date(v.startsAt).toISOString(),
      expiresAt: new Date(v.expiresAt).toISOString(),
    };

    this.submitting.set(true);
    this.service.create(request).subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
      },
      error: (err) => this.handleError(err, this.form),
    });
  }
}

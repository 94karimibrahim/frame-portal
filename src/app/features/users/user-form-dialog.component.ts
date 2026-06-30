import { ChangeDetectionStrategy, Component, OnInit, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Observable } from 'rxjs';
import {
  CreateUserRequest,
  GENDER_LABEL,
  Gender,
  UpdateUserRequest,
  User,
} from '../../core/models';
import { DrawerComponent } from '../../shared/ui/drawer.component';
import { SpinnerComponent } from '../../shared/ui/spinner.component';
import { FieldFeedbackComponent } from '../../shared/forms/field-feedback.component';
import { ServerFormBase } from '../../shared/forms/server-form.base';
import { UserService } from './user.service';

/** Open the dialog for a new user, or to edit an existing one's profile (then `user` carries the prefill). */
export interface UserDialogInput {
  mode: 'create' | 'edit';
  user?: User;
}

const GENDER_OPTIONS = [Gender.Male, Gender.Female, Gender.Other, Gender.Unspecified].map(
  (value) => ({
    value,
    label: GENDER_LABEL[value],
  }),
);

/**
 * Create a user (name + email + phone; the user sets their own password via an emailed link) or edit an
 * existing user's profile (name, phone, and the optional demographic/contact fields the backend's
 * `UpdateUserRequest` accepts — email is not editable here). Server validation codes map back onto controls
 * via {@link ServerFormBase}.
 */
@Component({
  selector: 'app-user-form-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslocoModule,
    DrawerComponent,
    SpinnerComponent,
    FieldFeedbackComponent,
  ],
  template: `
    <app-drawer
      [title]="(data().mode === 'edit' ? 'users.editTitle' : 'users.createTitle') | transloco"
      widthClass="max-w-xl"
      (closed)="closed.emit()"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (formError(); as message) {
          <div class="mb-4 alert-error" role="alert">{{ message }}</div>
        }

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="form-label" for="u-firstName">{{ 'users.firstName' | transloco }}</label>
            <input
              id="u-firstName"
              type="text"
              formControlName="firstName"
              class="form-input"
              [class.form-input--error]="invalid(form.controls.firstName)"
              [class.form-input--success]="showSuccess(form.controls.firstName)"
            />
            <app-field-feedback
              [error]="errorFor(form.controls.firstName)"
              [success]="showSuccess(form.controls.firstName)"
            />
          </div>
          <div>
            <label class="form-label" for="u-lastName">{{ 'users.lastName' | transloco }}</label>
            <input
              id="u-lastName"
              type="text"
              formControlName="lastName"
              class="form-input"
              [class.form-input--error]="invalid(form.controls.lastName)"
              [class.form-input--success]="showSuccess(form.controls.lastName)"
            />
            <app-field-feedback
              [error]="errorFor(form.controls.lastName)"
              [success]="showSuccess(form.controls.lastName)"
            />
          </div>

          @if (data().mode === 'create') {
            <div>
              <label class="form-label" for="u-email">{{ 'users.email' | transloco }}</label>
              <input
                id="u-email"
                type="email"
                autocomplete="off"
                formControlName="email"
                class="form-input"
                [class.form-input--error]="invalid(form.controls.email)"
                [class.form-input--success]="showSuccess(form.controls.email)"
              />
              <app-field-feedback
                [error]="errorFor(form.controls.email)"
                [success]="showSuccess(form.controls.email)"
              />
            </div>
            <div class="sm:col-span-2">
              <p class="text-theme-xs text-gray-500 dark:text-gray-400" role="note">
                {{ 'users.setPasswordHint' | transloco }}
              </p>
            </div>
          }

          <div>
            <label class="form-label" for="u-phone">{{ 'users.phoneNumber' | transloco }}</label>
            <input id="u-phone" type="tel" formControlName="phoneNumber" class="form-input" />
          </div>

          @if (data().mode === 'edit') {
            <div>
              <label class="form-label" for="u-gender">{{ 'users.gender' | transloco }}</label>
              <select id="u-gender" formControlName="gender" class="form-input">
                <option value="">{{ 'common.none' | transloco }}</option>
                @for (g of genderOptions; track g.value) {
                  <option [value]="g.value">{{ g.label | transloco }}</option>
                }
              </select>
            </div>
            <div>
              <label class="form-label" for="u-dob">{{ 'users.dateOfBirth' | transloco }}</label>
              <input id="u-dob" type="date" formControlName="dateOfBirth" class="form-input" />
            </div>
            <div>
              <label class="form-label" for="u-timezone">{{ 'users.timeZone' | transloco }}</label>
              <input id="u-timezone" type="text" formControlName="timeZone" class="form-input" />
            </div>
            <div>
              <label class="form-label" for="u-country">{{ 'users.country' | transloco }}</label>
              <input id="u-country" type="text" formControlName="country" class="form-input" />
            </div>
            <div>
              <label class="form-label" for="u-city">{{ 'users.city' | transloco }}</label>
              <input id="u-city" type="text" formControlName="city" class="form-input" />
            </div>
            <div>
              <label class="form-label" for="u-postal">{{ 'users.postalCode' | transloco }}</label>
              <input id="u-postal" type="text" formControlName="postalCode" class="form-input" />
            </div>
            <div class="sm:col-span-2">
              <label class="form-label" for="u-address">{{ 'users.address' | transloco }}</label>
              <input id="u-address" type="text" formControlName="address" class="form-input" />
            </div>
          }
        </div>
      </form>

      <div drawerfooter class="flex items-center justify-end gap-3">
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
    </app-drawer>
  `,
})
export class UserFormDialogComponent extends ServerFormBase implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(UserService);

  readonly data = input.required<UserDialogInput>();
  readonly saved = output<void>();
  readonly closed = output<void>();

  protected readonly genderOptions = GENDER_OPTIONS;

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phoneNumber: [''],
    gender: [''],
    dateOfBirth: [''],
    timeZone: [''],
    country: [''],
    city: [''],
    address: [''],
    postalCode: [''],
  });

  ngOnInit(): void {
    const d = this.data();
    if (d.mode === 'edit') {
      // Email isn't editable; disable it so it doesn't block submit.
      this.form.controls.email.disable();
      if (d.user) {
        this.prime(d.user);
      }
    }
  }

  private prime(user: User): void {
    this.form.patchValue({
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber ?? '',
      gender: user.gender === null || user.gender === undefined ? '' : String(user.gender),
      dateOfBirth: user.dateOfBirth ? user.dateOfBirth.substring(0, 10) : '',
      timeZone: user.timeZone ?? '',
      country: user.country ?? '',
      city: user.city ?? '',
      address: user.address ?? '',
      postalCode: user.postalCode ?? '',
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
    this.submitting.set(true);
    const d = this.data();
    const request$: Observable<unknown> =
      d.mode === 'edit' && d.user
        ? this.service.update(d.user.id, this.toUpdate(v))
        : this.service.create(this.toCreate(v));

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
      },
      error: (err) => this.handleError(err, this.form),
    });
  }

  private toCreate(v: ReturnType<typeof this.form.getRawValue>): CreateUserRequest {
    return {
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      email: v.email.trim(),
      // No password: the user sets their own via the emailed set-password link.
      phoneNumber: v.phoneNumber.trim() || null,
    };
  }

  private toUpdate(v: ReturnType<typeof this.form.getRawValue>): UpdateUserRequest {
    return {
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      phoneNumber: v.phoneNumber.trim() || null,
      // Not edited here — echo the existing value so a profile save doesn't clear the avatar.
      avatarUrl: this.data().user?.avatarUrl ?? null,
      dateOfBirth: v.dateOfBirth || null,
      gender: v.gender === '' ? null : (Number(v.gender) as Gender),
      timeZone: v.timeZone.trim() || null,
      country: v.country.trim() || null,
      city: v.city.trim() || null,
      address: v.address.trim() || null,
      postalCode: v.postalCode.trim() || null,
    };
  }
}

import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Observable } from 'rxjs';
import { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import {
  CreateUserRequest,
  GENDER_LABEL,
  Gender,
  UpdateUserRequest,
  User,
} from '../../core/models';
import { NotificationService } from '../../core/notifications/notification.service';
import { FieldFeedbackComponent } from '../../shared/forms/field-feedback.component';
import { ServerFormBase } from '../../shared/forms/server-form.base';
import { CardComponent } from '../../shared/ui/card.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { FormSkeletonComponent } from '../../shared/ui/form-skeleton.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { SpinnerComponent } from '../../shared/ui/spinner.component';
import { UserService } from './user.service';

const GENDER_OPTIONS = [Gender.Male, Gender.Female, Gender.Other, Gender.Unspecified].map(
  (value) => ({
    value,
    label: GENDER_LABEL[value],
  }),
);

/**
 * Create a user (name + email + phone; the user sets their own password via an emailed link) or edit an
 * existing user's profile — as a routed **page** (replaces the former form drawer). Edit mode is chosen by
 * the presence of a `:id` route param, fetching the full record to prime the form. Guards in-app navigation
 * away from unsaved edits via {@link HasUnsavedChanges} + `unsavedChangesGuard`. Server validation codes map
 * back onto controls via {@link ServerFormBase}. On success it toasts and returns to the list.
 */
@Component({
  selector: 'app-user-form-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslocoModule,
    PageHeaderComponent,
    CardComponent,
    SpinnerComponent,
    FormSkeletonComponent,
    EmptyStateComponent,
    FieldFeedbackComponent,
  ],
  template: `
    <app-page-header
      [title]="(mode() === 'edit' ? 'users.editTitle' : 'users.createTitle') | transloco"
    />

    @if (loading()) {
      <app-form-skeleton [sections]="1" [fields]="6" />
    } @else if (mode() === 'edit' && !user()) {
      <app-empty-state [title]="'users.detailError' | transloco">
        <button type="button" class="btn btn-secondary" (click)="cancel()">
          {{ 'common.back' | transloco }}
        </button>
      </app-empty-state>
    } @else {
      <app-card>
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (formError(); as message) {
            <div class="mb-4 alert-error" role="alert">{{ message }}</div>
          }

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="form-label" for="u-firstName">{{
                'users.firstName' | transloco
              }}</label>
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

            @if (mode() === 'create') {
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

            @if (mode() === 'edit') {
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
                <label class="form-label" for="u-timezone">{{
                  'users.timeZone' | transloco
                }}</label>
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
                <label class="form-label" for="u-postal">{{
                  'users.postalCode' | transloco
                }}</label>
                <input id="u-postal" type="text" formControlName="postalCode" class="form-input" />
              </div>
              <div class="sm:col-span-2">
                <label class="form-label" for="u-address">{{ 'users.address' | transloco }}</label>
                <input id="u-address" type="text" formControlName="address" class="form-input" />
              </div>
            }
          </div>

          <div
            class="mt-8 flex items-center justify-end gap-3 border-t border-gray-100 pt-5 dark:border-gray-800"
          >
            <button
              type="button"
              class="btn btn-secondary"
              (click)="cancel()"
              [disabled]="submitting()"
            >
              {{ 'common.cancel' | transloco }}
            </button>
            <button type="submit" class="btn btn-primary" [disabled]="submitting()">
              @if (submitting()) {
                <app-spinner size="sm" />
              }
              {{ 'common.save' | transloco }}
            </button>
          </div>
        </form>
      </app-card>
    }
  `,
})
export class UserFormPageComponent extends ServerFormBase implements HasUnsavedChanges {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(UserService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(TranslocoService);

  protected readonly genderOptions = GENDER_OPTIONS;

  private readonly id = this.route.snapshot.paramMap.get('id');
  protected readonly mode = computed<'create' | 'edit'>(() => (this.id ? 'edit' : 'create'));

  /** Loaded record in edit mode (also drives the not-found empty state). */
  protected readonly user = signal<User | null>(null);
  /** True while fetching the record to edit (create mode never loads). */
  protected readonly loading = signal(!!this.id);

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

  constructor() {
    super();
    if (this.id) {
      // Email isn't editable; disable it so it doesn't block submit.
      this.form.controls.email.disable();
      this.service.get(this.id).subscribe({
        next: (u) => {
          this.user.set(u);
          this.prime(u);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }

  /** Guards navigation away from unsaved edits (see `unsavedChangesGuard`). */
  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.submitting();
  }

  /** Hard browser navigation (reload/close/external link): pairs the guard with the unload prompt. */
  @HostListener('window:beforeunload', ['$event'])
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
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
    const editing = this.user();
    const request$: Observable<unknown> = editing
      ? this.service.update(editing.id, this.toUpdate(v))
      : this.service.create(this.toCreate(v));

    request$.subscribe({
      next: () => {
        this.submitting.set(false);
        this.form.markAsPristine(); // clear the unsaved-changes guard before navigating away
        this.notify.success(this.i18n.translate(editing ? 'users.updated' : 'users.created'));
        this.router.navigate(['/users']);
      },
      error: (err) => this.handleError(err, this.form),
    });
  }

  protected cancel(): void {
    this.router.navigate(['/users']);
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
      avatarUrl: this.user()?.avatarUrl ?? null,
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

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { FieldFeedbackComponent } from '../../shared/forms/field-feedback.component';
import { AuthFormBase } from './auth-form.base';

/** Cross-field check: the confirmation must equal the password. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { passwordMismatch: true } : null;
}

/**
 * Self-service account creation. On success the screen switches to a "check your inbox" confirmation
 * (the backend emails a verification link); no session is established here.
 */
@Component({
  selector: 'app-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoModule, FieldFeedbackComponent],
  template: `
    @if (done()) {
      <div class="text-center">
        <h1 class="text-title-sm font-semibold text-gray-900 dark:text-white">
          {{ 'auth.registerDoneTitle' | transloco }}
        </h1>
        <div class="mt-4 alert-success" role="status">{{ 'auth.checkEmail' | transloco }}</div>
        <a routerLink="/auth/login" class="mt-6 inline-block auth-link">
          {{ 'auth.backToSignIn' | transloco }}
        </a>
      </div>
    } @else {
      <div class="mb-6">
        <h1 class="text-title-sm font-semibold text-gray-900 dark:text-white">
          {{ 'auth.signUpTitle' | transloco }}
        </h1>
      </div>

      @if (formError(); as message) {
        <div class="mb-4 alert-error" role="alert">{{ message }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="form-label" for="firstName">{{ 'auth.firstName' | transloco }}</label>
            <input
              id="firstName"
              type="text"
              autocomplete="given-name"
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
            <label class="form-label" for="lastName">{{ 'auth.lastName' | transloco }}</label>
            <input
              id="lastName"
              type="text"
              autocomplete="family-name"
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
        </div>

        <div class="mb-4">
          <label class="form-label" for="email">{{ 'auth.email' | transloco }}</label>
          <input
            id="email"
            type="email"
            autocomplete="email"
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

        <div class="mb-4">
          <label class="form-label" for="phoneNumber">{{ 'auth.phoneNumber' | transloco }}</label>
          <input
            id="phoneNumber"
            type="tel"
            autocomplete="tel"
            formControlName="phoneNumber"
            class="form-input"
          />
        </div>

        <div class="mb-4">
          <label class="form-label" for="password">{{ 'auth.password' | transloco }}</label>
          <input
            id="password"
            type="password"
            autocomplete="new-password"
            formControlName="password"
            class="form-input"
            [class.form-input--error]="invalid(form.controls.password)"
            [class.form-input--success]="showSuccess(form.controls.password)"
          />
          <app-field-feedback
            [error]="errorFor(form.controls.password)"
            [success]="showSuccess(form.controls.password)"
          />
        </div>

        <div class="mb-5">
          <label class="form-label" for="confirmPassword">{{
            'auth.confirmPassword' | transloco
          }}</label>
          <input
            id="confirmPassword"
            type="password"
            autocomplete="new-password"
            formControlName="confirmPassword"
            class="form-input"
            [class.form-input--error]="showMismatch()"
          />
          <app-field-feedback
            [error]="showMismatch() ? ('validation.passwordMismatch' | transloco) : null"
          />
        </div>

        <button type="submit" class="btn btn-primary btn-block" [disabled]="submitting()">
          @if (submitting()) {
            <span
              class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            ></span>
          }
          {{ 'auth.signUp' | transloco }}
        </button>
      </form>

      <p class="mt-6 text-center text-theme-sm text-gray-500 dark:text-gray-400">
        {{ 'auth.haveAccount' | transloco }}
        <a routerLink="/auth/login" class="auth-link">{{ 'auth.signInCta' | transloco }}</a>
      </p>
    }
  `,
})
export class RegisterComponent extends AuthFormBase {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  protected readonly done = signal(false);

  protected readonly form = this.fb.nonNullable.group(
    {
      firstName: ['', [Validators.required]],
      lastName: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: [''],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  protected showMismatch(): boolean {
    const confirm = this.form.controls.confirmPassword;
    return (
      (confirm.touched || this.submitted()) &&
      !confirm.errors?.['required'] &&
      this.form.errors?.['passwordMismatch'] === true
    );
  }

  protected submit(): void {
    this.submitted.set(true);
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { firstName, lastName, email, password, phoneNumber } = this.form.getRawValue();
    this.submitting.set(true);
    this.auth
      .register({ firstName, lastName, email, password, phoneNumber: phoneNumber || null })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.done.set(true);
        },
        error: (err) => this.handleError(err, this.form),
      });
  }
}

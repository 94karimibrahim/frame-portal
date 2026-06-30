import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
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

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { passwordMismatch: true } : null;
}

/**
 * Completes a password reset using the `token` from the email link (bound from the query string). With no
 * token the form is replaced by an "invalid link" notice; on success it shows a sign-in prompt.
 */
@Component({
  selector: 'app-reset-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoModule, FieldFeedbackComponent],
  template: `
    <div class="mb-6">
      <h1 class="text-title-sm font-semibold text-gray-900 dark:text-white">
        {{ 'auth.resetTitle' | transloco }}
      </h1>
    </div>

    @if (!token()) {
      <div class="alert-error" role="alert">{{ 'auth.resetInvalidLink' | transloco }}</div>
      <p class="mt-6 text-center text-theme-sm">
        <a routerLink="/auth/forgot-password" class="auth-link">{{
          'auth.forgotTitle' | transloco
        }}</a>
      </p>
    } @else if (done()) {
      <div class="alert-success" role="status">{{ 'auth.resetDone' | transloco }}</div>
      <a routerLink="/auth/login" class="mt-6 inline-block w-full text-center auth-link">
        {{ 'auth.backToSignIn' | transloco }}
      </a>
    } @else {
      @if (formError(); as message) {
        <div class="mb-4 alert-error" role="alert">{{ message }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
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
          {{ 'common.save' | transloco }}
        </button>
      </form>
    }
  `,
})
export class ResetPasswordComponent extends AuthFormBase {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  /** Bound from the `token` query param by `withComponentInputBinding`. */
  readonly token = input<string | null>(null);

  protected readonly done = signal(false);

  protected readonly form = this.fb.nonNullable.group(
    {
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
    const token = this.token();
    if (this.form.invalid || !token) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.auth.resetPassword(token, this.form.controls.password.value).subscribe({
      next: () => {
        this.submitting.set(false);
        this.done.set(true);
      },
      error: (err) => this.handleError(err, this.form),
    });
  }
}

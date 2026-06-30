import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { FieldFeedbackComponent } from '../../shared/forms/field-feedback.component';
import { AuthFormBase } from './auth-form.base';

/** Credentials carried from the login page via router state (kept out of the URL). */
interface TwoFactorState {
  email?: string;
  password?: string;
}

/**
 * Second step of a 2FA login: re-submits the credentials plus the TOTP/backup code to `/auth/login/2fa`.
 * Reached only from {@link LoginComponent}; a direct visit (no carried credentials) bounces to login.
 */
@Component({
  selector: 'app-two-factor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoModule, FieldFeedbackComponent],
  template: `
    <div class="mb-6">
      <h1 class="text-title-sm font-semibold text-gray-900 dark:text-white">
        {{ 'auth.twoFactorTitle' | transloco }}
      </h1>
      <p class="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
        {{ 'auth.twoFactorSubtitle' | transloco }}
      </p>
    </div>

    @if (formError(); as message) {
      <div class="mb-4 alert-error" role="alert">{{ message }}</div>
    }

    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="mb-5">
        <label class="form-label" for="code">{{ 'auth.code' | transloco }}</label>
        <input
          id="code"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          formControlName="code"
          class="form-input tracking-[0.3em]"
          [class.form-input--error]="invalid(form.controls.code)"
        />
        <app-field-feedback [error]="errorFor(form.controls.code)" />
      </div>

      <button type="submit" class="btn btn-primary btn-block" [disabled]="submitting()">
        @if (submitting()) {
          <span
            class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          ></span>
        }
        {{ 'auth.verify' | transloco }}
      </button>
    </form>

    <p class="mt-6 text-center text-theme-sm">
      <a routerLink="/auth/login" class="auth-link">{{ 'auth.backToSignIn' | transloco }}</a>
    </p>
  `,
})
export class TwoFactorComponent extends AuthFormBase implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly creds = (history.state ?? {}) as TwoFactorState;

  protected readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required]],
  });

  ngOnInit(): void {
    if (!this.creds.email || !this.creds.password) {
      void this.router.navigate(['/auth/login']);
    }
  }

  protected submit(): void {
    this.submitted.set(true);
    this.formError.set(null);
    if (this.form.invalid || !this.creds.email || !this.creds.password) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.auth
      .loginTwoFactor({
        email: this.creds.email,
        password: this.creds.password,
        code: this.form.controls.code.value.trim(),
      })
      .subscribe({
        next: () => this.router.navigateByUrl('/'),
        error: (err) => this.handleError(err, this.form),
      });
  }
}

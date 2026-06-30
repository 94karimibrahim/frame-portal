import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AppError } from '../../core/models';
import { AuthService } from '../../core/auth/auth.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { FieldFeedbackComponent } from '../../shared/forms/field-feedback.component';
import { AuthFormBase } from './auth-form.base';

/**
 * Email/password sign-in. On a `403 Auth.TwoFactorRequired` it forwards the credentials to the 2FA
 * challenge via router state (never the URL). A `reason=session-expired` query shows the expiry notice.
 * The optional workspace field sets the pre-login `X-Tenant` slug (FRONTEND_PLAN §5).
 */
@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoModule, FieldFeedbackComponent],
  template: `
    <div class="mb-6">
      <h1 class="text-title-sm font-semibold text-gray-900 dark:text-white">
        {{ 'auth.signInTitle' | transloco }}
      </h1>
      <p class="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
        {{ 'auth.signInSubtitle' | transloco }}
      </p>
    </div>

    @if (reason() === 'session-expired') {
      <div class="mb-4 alert-error" role="status">{{ 'auth.sessionExpired' | transloco }}</div>
    }
    @if (formError(); as message) {
      <div class="mb-4 alert-error" role="alert">
        {{ message }}
        @if (locked(); as email) {
          <a
            [routerLink]="['/auth/request-account-unlock']"
            [queryParams]="{ email }"
            class="mt-2 block font-medium underline"
          >
            {{ 'auth.requestUnlock' | transloco }}
          </a>
        }
      </div>
    }

    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <div class="mb-4">
        <label class="form-label" for="email">{{ 'auth.email' | transloco }}</label>
        <input
          id="email"
          type="email"
          autocomplete="username"
          formControlName="email"
          class="form-input"
          [class.form-input--error]="invalid(form.controls.email)"
        />
        <app-field-feedback [error]="errorFor(form.controls.email)" />
      </div>

      <div class="mb-4">
        <div class="flex items-center justify-between">
          <label class="form-label" for="password">{{ 'auth.password' | transloco }}</label>
          <a routerLink="/auth/forgot-password" class="text-theme-xs auth-link">
            {{ 'auth.forgotPassword' | transloco }}
          </a>
        </div>
        <input
          id="password"
          type="password"
          autocomplete="current-password"
          formControlName="password"
          class="form-input"
          [class.form-input--error]="invalid(form.controls.password)"
        />
        <app-field-feedback [error]="errorFor(form.controls.password)" />
      </div>

      <div class="mb-5">
        <label class="form-label" for="workspace">{{ 'auth.tenant' | transloco }}</label>
        <input
          id="workspace"
          type="text"
          autocomplete="organization"
          formControlName="workspace"
          class="form-input"
        />
      </div>

      <button type="submit" class="btn btn-primary btn-block" [disabled]="submitting()">
        @if (submitting()) {
          <span
            class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          ></span>
        }
        {{ 'auth.signIn' | transloco }}
      </button>
    </form>

    <p class="mt-6 text-center text-theme-sm text-gray-500 dark:text-gray-400">
      {{ 'auth.noAccount' | transloco }}
      <a routerLink="/auth/register" class="auth-link">{{ 'auth.createAccountCta' | transloco }}</a>
    </p>
  `,
})
export class LoginComponent extends AuthFormBase {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly tenant = inject(TenantService);
  private readonly router = inject(Router);

  /** Bound from the `returnUrl` query param by `withComponentInputBinding`. */
  readonly returnUrl = input('/');
  /** Bound from the `reason` query param (e.g. `session-expired`). */
  readonly reason = input<string | null>(null);

  /** Holds the locked-out email so the banner can offer a pre-filled "request unlock" link. */
  protected readonly locked = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    workspace: [this.tenant.slug()],
  });

  protected submit(): void {
    this.submitted.set(true);
    this.formError.set(null);
    this.locked.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password, workspace } = this.form.getRawValue();
    if (workspace) {
      this.tenant.setSlug(workspace);
    }

    this.submitting.set(true);
    this.auth.login({ email, password }).subscribe({
      next: () => this.router.navigateByUrl(this.returnUrl() || '/'),
      error: (err: AppError) => {
        if (err.status === 403 && err.code === 'Auth.TwoFactorRequired') {
          this.submitting.set(false);
          this.router.navigate(['/auth/login/2fa'], { state: { email, password } });
          return;
        }
        if (err.status === 403 && err.code === 'Auth.AccountLocked') {
          // Locked after too many attempts: keep the user here, show the reason, and offer a
          // pre-filled link to request a self-service unlock email.
          this.submitting.set(false);
          this.formError.set(
            this.msg('Auth.AccountLocked', this.transloco.translate('errors.title')),
          );
          this.locked.set(email);
          return;
        }
        if (err.status === 403 && err.code === 'Auth.ForcePasswordChange') {
          // The account must be claimed via the emailed set-password link before it can sign in.
          // Keep the user on the login page (the "Forgot password?" link can resend the link) and
          // show a clear banner rather than binding the message to a field.
          this.submitting.set(false);
          this.formError.set(
            this.msg('Auth.ForcePasswordChange', this.transloco.translate('errors.title')),
          );
          return;
        }
        this.handleError(err, this.form);
      },
    });
  }
}

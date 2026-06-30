import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { FieldFeedbackComponent } from '../../shared/forms/field-feedback.component';
import { AuthFormBase } from './auth-form.base';

/**
 * Requests a self-service account-unlock email for a locked-out account. Like forgot-password, the backend
 * always responds 204 (no account enumeration), so on success the screen always switches to the neutral
 * "check your email" state. The locked email may be pre-filled from the login screen via the query string.
 */
@Component({
  selector: 'app-request-account-unlock',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoModule, FieldFeedbackComponent],
  template: `
    @if (done()) {
      <div class="text-center">
        <h1 class="text-title-sm font-semibold text-gray-900 dark:text-white">
          {{ 'auth.unlockTitle' | transloco }}
        </h1>
        <div class="mt-4 alert-success" role="status">{{ 'auth.checkEmail' | transloco }}</div>
        <a routerLink="/auth/login" class="mt-6 inline-block auth-link">
          {{ 'auth.backToSignIn' | transloco }}
        </a>
      </div>
    } @else {
      <div class="mb-6">
        <h1 class="text-title-sm font-semibold text-gray-900 dark:text-white">
          {{ 'auth.unlockTitle' | transloco }}
        </h1>
        <p class="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
          {{ 'auth.unlockSubtitle' | transloco }}
        </p>
      </div>

      @if (formError(); as message) {
        <div class="mb-4 alert-error" role="alert">{{ message }}</div>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="mb-5">
          <label class="form-label" for="email">{{ 'auth.email' | transloco }}</label>
          <input
            id="email"
            type="email"
            autocomplete="email"
            formControlName="email"
            class="form-input"
            [class.form-input--error]="invalid(form.controls.email)"
          />
          <app-field-feedback [error]="errorFor(form.controls.email)" />
        </div>

        <button type="submit" class="btn btn-primary btn-block" [disabled]="submitting()">
          @if (submitting()) {
            <span
              class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            ></span>
          }
          {{ 'auth.requestUnlock' | transloco }}
        </button>
      </form>

      <p class="mt-6 text-center text-theme-sm">
        <a routerLink="/auth/login" class="auth-link">{{ 'auth.backToSignIn' | transloco }}</a>
      </p>
    }
  `,
})
export class RequestAccountUnlockComponent extends AuthFormBase implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  /** Bound from the `email` query param by `withComponentInputBinding` (e.g. pre-filled from login). */
  readonly email = input<string | null>(null);

  protected readonly done = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  ngOnInit(): void {
    const prefill = this.email();
    if (prefill) {
      this.form.controls.email.setValue(prefill);
    }
  }

  protected submit(): void {
    this.submitted.set(true);
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.auth.requestAccountUnlock(this.form.controls.email.value).subscribe({
      next: () => {
        this.submitting.set(false);
        this.done.set(true);
      },
      error: (err) => this.handleError(err, this.form),
    });
  }
}

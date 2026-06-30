import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AppError } from '../../core/models';
import { AuthService } from '../../core/auth/auth.service';
import { FieldFeedbackComponent } from '../../shared/forms/field-feedback.component';
import { AuthFormBase } from './auth-form.base';

type ConfirmState = 'verifying' | 'done' | 'failed';

/**
 * Confirms an email from the link `token` (bound from the query string), auto-running on load. On failure
 * it offers to resend a confirmation email to an entered address.
 */
@Component({
  selector: 'app-confirm-email',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, TranslocoModule, FieldFeedbackComponent],
  template: `
    @switch (state()) {
      @case ('verifying') {
        <div class="flex flex-col items-center gap-4 py-6 text-center">
          <span
            class="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500"
          ></span>
          <p class="text-theme-sm text-gray-600 dark:text-gray-300">
            {{ 'auth.confirmEmailTitle' | transloco }}
          </p>
        </div>
      }
      @case ('done') {
        <div class="text-center">
          <div class="alert-success" role="status">{{ 'auth.confirmEmailDone' | transloco }}</div>
          <a routerLink="/auth/login" class="mt-6 inline-block auth-link">
            {{ 'auth.backToSignIn' | transloco }}
          </a>
        </div>
      }
      @case ('failed') {
        <div class="mb-6 text-center">
          <div class="alert-error" role="alert">{{ 'auth.confirmEmailFailed' | transloco }}</div>
        </div>

        @if (resent()) {
          <div class="alert-success" role="status">{{ 'auth.checkEmail' | transloco }}</div>
        } @else {
          <form [formGroup]="form" (ngSubmit)="resend()" novalidate>
            <div class="mb-4">
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
              {{ 'auth.resendConfirmation' | transloco }}
            </button>
          </form>
        }

        <p class="mt-6 text-center text-theme-sm">
          <a routerLink="/auth/login" class="auth-link">{{ 'auth.backToSignIn' | transloco }}</a>
        </p>
      }
    }
  `,
})
export class ConfirmEmailComponent extends AuthFormBase implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  /** Bound from the `token` query param by `withComponentInputBinding`. */
  readonly token = input<string | null>(null);

  protected readonly state = signal<ConfirmState>('verifying');
  protected readonly resent = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  ngOnInit(): void {
    const token = this.token();
    if (!token) {
      this.state.set('failed');
      return;
    }
    this.auth.confirmEmail(token).subscribe({
      next: () => this.state.set('done'),
      error: () => this.state.set('failed'),
    });
  }

  protected resend(): void {
    this.submitted.set(true);
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.auth.sendEmailConfirmation(this.form.controls.email.value).subscribe({
      next: () => {
        this.submitting.set(false);
        this.resent.set(true);
      },
      error: (err: AppError) => this.handleError(err, this.form),
    });
  }
}

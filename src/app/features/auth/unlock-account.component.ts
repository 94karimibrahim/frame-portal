import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { AuthFormBase } from './auth-form.base';

type UnlockState = 'verifying' | 'done' | 'failed';

/**
 * Unlocks an account from the link `token` (bound from the query string), auto-running on load. With no
 * token, or when the token is invalid/expired, it shows a notice with a path back to request a fresh
 * unlock email.
 */
@Component({
  selector: 'app-unlock-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoModule],
  template: `
    <div class="mb-6">
      <h1 class="text-title-sm font-semibold text-gray-900 dark:text-white">
        {{ 'auth.unlockTitle' | transloco }}
      </h1>
    </div>

    @switch (state()) {
      @case ('verifying') {
        <div class="flex flex-col items-center gap-4 py-6 text-center">
          <span
            class="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500"
          ></span>
          <p class="text-theme-sm text-gray-600 dark:text-gray-300">
            {{ 'auth.unlockVerifying' | transloco }}
          </p>
        </div>
      }
      @case ('done') {
        <div class="text-center">
          <div class="alert-success" role="status">{{ 'auth.unlockDone' | transloco }}</div>
          <a routerLink="/auth/login" class="mt-6 inline-block auth-link">
            {{ 'auth.backToSignIn' | transloco }}
          </a>
        </div>
      }
      @case ('failed') {
        <div class="alert-error" role="alert">{{ 'auth.unlockInvalidLink' | transloco }}</div>
        <p class="mt-6 text-center text-theme-sm">
          <a routerLink="/auth/request-account-unlock" class="auth-link">{{
            'auth.requestUnlock' | transloco
          }}</a>
        </p>
        <p class="mt-2 text-center text-theme-sm">
          <a routerLink="/auth/login" class="auth-link">{{ 'auth.backToSignIn' | transloco }}</a>
        </p>
      }
    }
  `,
})
export class UnlockAccountComponent extends AuthFormBase implements OnInit {
  private readonly auth = inject(AuthService);

  /** Bound from the `token` query param by `withComponentInputBinding`. */
  readonly token = input<string | null>(null);

  protected readonly state = signal<UnlockState>('verifying');

  ngOnInit(): void {
    const token = this.token();
    if (!token) {
      this.state.set('failed');
      return;
    }
    this.auth.unlockAccount(token).subscribe({
      next: () => this.state.set('done'),
      error: () => this.state.set('failed'),
    });
  }
}

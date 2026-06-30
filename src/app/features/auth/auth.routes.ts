import { Routes } from '@angular/router';
import { AuthShellComponent } from './auth-shell.component';
import { ConfirmEmailComponent } from './confirm-email.component';
import { ForgotPasswordComponent } from './forgot-password.component';
import { LoginComponent } from './login.component';
import { RegisterComponent } from './register.component';
import { RequestAccountUnlockComponent } from './request-account-unlock.component';
import { ResetPasswordComponent } from './reset-password.component';
import { TwoFactorComponent } from './two-factor.component';
import { UnlockAccountComponent } from './unlock-account.component';

/**
 * Public auth routes, all hosted inside {@link AuthShellComponent}. Lazy-loaded as one chunk from the root
 * routes behind `guestGuard`. Components are referenced directly (not per-route lazy) so the slice ships as
 * a single, small bundle.
 */
export const AUTH_ROUTES: Routes = [
  {
    path: '',
    component: AuthShellComponent,
    children: [
      { path: 'login', component: LoginComponent },
      { path: 'login/2fa', component: TwoFactorComponent },
      { path: 'register', component: RegisterComponent },
      { path: 'forgot-password', component: ForgotPasswordComponent },
      { path: 'reset-password', component: ResetPasswordComponent },
      { path: 'request-account-unlock', component: RequestAccountUnlockComponent },
      { path: 'unlock-account', component: UnlockAccountComponent },
      { path: 'confirm-email', component: ConfirmEmailComponent },
      { path: '', redirectTo: 'login', pathMatch: 'full' },
    ],
  },
];

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AppError, AuthResult } from '../../core/models';
import { LoginComponent } from './login.component';

const authResult: AuthResult = {
  accessToken: 'a',
  refreshToken: 'r',
  refreshTokenExpiresAt: '2099-01-01T00:00:00Z',
  userId: 'u1',
  email: 'user@example.com',
  fullName: 'Test User',
};

function transloco() {
  return TranslocoTestingModule.forRoot({
    langs: { en: {}, ar: {} },
    translocoConfig: { availableLangs: ['en', 'ar'], defaultLang: 'en' },
    preloadLangs: true,
  });
}

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let auth: jasmine.SpyObj<AuthService>;
  let router: Router;

  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['login']);

    await TestBed.configureTestingModule({
      imports: [LoginComponent, transloco()],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture.detectChanges();
  });

  function form() {
    return (component as unknown as { form: import('@angular/forms').FormGroup }).form;
  }
  function submit() {
    (component as unknown as { submit: () => void }).submit();
  }

  it('does not call login when the form is invalid', () => {
    submit();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('navigates to the return url on a successful login', () => {
    auth.login.and.returnValue(of(authResult));
    form().patchValue({ email: 'user@example.com', password: 'secret12' });

    submit();

    expect(auth.login).toHaveBeenCalledOnceWith({
      email: 'user@example.com',
      password: 'secret12',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('forwards credentials to the 2FA challenge on Auth.TwoFactorRequired', () => {
    const err: AppError = {
      status: 403,
      code: 'Auth.TwoFactorRequired',
      detail: null,
      fieldErrors: null,
      retryAfterSeconds: null,
      correlationId: null,
    };
    auth.login.and.returnValue(throwError(() => err));
    form().patchValue({ email: 'user@example.com', password: 'secret12' });

    submit();

    expect(router.navigate).toHaveBeenCalledWith(['/auth/login/2fa'], {
      state: { email: 'user@example.com', password: 'secret12' },
    });
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('binds server field errors onto controls', () => {
    const err: AppError = {
      status: 400,
      code: 'Validation',
      detail: null,
      fieldErrors: { Email: ['Email.Invalid'] },
      retryAfterSeconds: null,
      correlationId: null,
    };
    auth.login.and.returnValue(throwError(() => err));
    form().patchValue({ email: 'bad@example.com', password: 'secret12' });

    submit();

    expect(form().controls['email'].errors?.['server']).toBe('Email.Invalid');
  });
});

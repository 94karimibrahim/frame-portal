import { TestBed } from '@angular/core/testing';
import { UrlSegment, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { authGuard, guestGuard } from './auth.guard';
import { hasAnyPermission } from './permission.guard';

/** Minimal AuthService stub exposing only what the guards touch. */
function provideAuth(auth: Partial<AuthService>): void {
  TestBed.configureTestingModule({
    providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
  });
}

const seg = (path: string): UrlSegment => new UrlSegment(path, {});

describe('authGuard', () => {
  it('allows an authenticated user', () => {
    provideAuth({ isAuthenticated: (() => true) as AuthService['isAuthenticated'] });
    const result = TestBed.runInInjectionContext(() => authGuard({} as never, [], {} as never));
    expect(result).toBe(true);
  });

  it('redirects an anonymous user to login with a returnUrl', () => {
    provideAuth({ isAuthenticated: (() => false) as AuthService['isAuthenticated'] });
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, [seg('users')], {} as never),
    );
    expect(result instanceof UrlTree).toBeTrue();
    const tree = (result as UrlTree).toString();
    expect(tree).toContain('/auth/login');
    expect(tree).toContain('returnUrl');
  });
});

describe('guestGuard', () => {
  it('sends an authenticated user to the dashboard', () => {
    provideAuth({ isAuthenticated: (() => true) as AuthService['isAuthenticated'] });
    const result = TestBed.runInInjectionContext(() => guestGuard({} as never, [], {} as never));
    expect(result instanceof UrlTree).toBeTrue();
  });

  it('lets an anonymous user reach a public page', () => {
    provideAuth({ isAuthenticated: (() => false) as AuthService['isAuthenticated'] });
    const result = TestBed.runInInjectionContext(() => guestGuard({} as never, [], {} as never));
    expect(result).toBe(true);
  });
});

describe('hasAnyPermission', () => {
  it('lets a permitted user through', () => {
    provideAuth({
      isAuthenticated: (() => true) as AuthService['isAuthenticated'],
      hasAny: () => true,
    });
    const guard = hasAnyPermission(['users.list']);
    expect(TestBed.runInInjectionContext(() => guard({} as never, [], {} as never))).toBe(true);
  });

  it('sends an authenticated-but-unauthorized user to /forbidden', () => {
    provideAuth({
      isAuthenticated: (() => true) as AuthService['isAuthenticated'],
      hasAny: () => false,
    });
    const guard = hasAnyPermission(['users.list']);
    const result = TestBed.runInInjectionContext(() => guard({} as never, [], {} as never));
    expect((result as UrlTree).toString()).toContain('/forbidden');
  });

  it('sends an anonymous user to login', () => {
    provideAuth({
      isAuthenticated: (() => false) as AuthService['isAuthenticated'],
      hasAny: () => false,
    });
    const guard = hasAnyPermission(['users.list']);
    const result = TestBed.runInInjectionContext(() => guard({} as never, [], {} as never));
    expect((result as UrlTree).toString()).toContain('/auth/login');
  });
});

import type { MockedObject } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import { AuthService, Identity } from '../../core/auth/auth.service';
import { RoleListItem, User, UserStatus } from '../../core/models';
import { NotificationService } from '../../core/notifications/notification.service';
import { UserDetailsPageComponent } from './user-details-page.component';
import { UserService } from './user.service';

const baseUser: User = {
  id: 'u1',
  firstName: 'Amina',
  lastName: 'Hassan',
  fullName: 'Amina Hassan',
  email: 'amina@example.com',
  phoneNumber: '+201000000000',
  status: UserStatus.Active,
  isSystem: false,
  emailConfirmed: true,
  phoneConfirmed: false,
  twoFactorEnabled: false,
  isLockedOut: true,
  lockoutEnd: '2099-01-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
};

const role: RoleListItem = {
  id: 'r1',
  name: 'Admin',
  description: null,
  isSystem: false,
  isActive: true,
  hierarchy: 1,
  parentRoleId: null,
  displayOrder: 0,
  color: null,
  translations: [],
};

const identity: Identity = {
  userId: 'me',
  email: 'me@example.com',
  fullName: 'Me',
  tenantId: null,
  roles: [],
  isSuperAdmin: false,
};

function transloco() {
  return TranslocoTestingModule.forRoot({
    langs: { en: {}, ar: {} },
    translocoConfig: { availableLangs: ['en', 'ar'], defaultLang: 'en' },
    preloadLangs: true,
  });
}

/** The protected members the tests drive, accessed via a typed cast (house style, see login spec). */
interface DetailsApi {
  user: () => User | null;
  loadingUser: () => boolean;
  guarded: () => boolean;
  guardTitle: () => string | null;
  confirmUnlock: () => void;
  confirmDelete: () => void;
}

describe('UserDetailsPageComponent', () => {
  let fixture: ComponentFixture<UserDetailsPageComponent>;
  let api: DetailsApi;
  let service: MockedObject<UserService>;
  let notify: MockedObject<NotificationService>;
  let router: Router;

  beforeEach(() => {
    service = {
      get: vi.fn().mockName('UserService.get'),
      getRoles: vi.fn().mockName('UserService.getRoles'),
      unlock: vi.fn().mockName('UserService.unlock'),
      resetPassword: vi.fn().mockName('UserService.resetPassword'),
      remove: vi.fn().mockName('UserService.remove'),
    } as unknown as MockedObject<UserService>;
    service.get.mockReturnValue(of(baseUser));
    service.getRoles.mockReturnValue(of([role]));
    notify = {
      success: vi.fn().mockName('NotificationService.success'),
      error: vi.fn().mockName('NotificationService.error'),
    } as unknown as MockedObject<NotificationService>;

    // Minimal AuthService: what the page (guarded/guardTitle) and *appHasPermission consume.
    const auth = {
      identity: signal<Identity | null>(identity),
      permissions: signal<ReadonlySet<string>>(new Set<string>()),
      hasAny: () => true,
    };

    TestBed.configureTestingModule({
      imports: [UserDetailsPageComponent, transloco()],
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: service },
        { provide: NotificationService, useValue: notify },
        { provide: AuthService, useValue: auth },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'u1' }) } },
        },
      ],
    });
  });

  /** Instantiates after the per-test spy arrangement (the constructor loads immediately). */
  function create(): void {
    fixture = TestBed.createComponent(UserDetailsPageComponent);
    api = fixture.componentInstance as unknown as DetailsApi;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  }

  it('loads the user + roles from the route id and renders the header', () => {
    create();

    expect(service.get).toHaveBeenCalledWith('u1');
    expect(service.getRoles).toHaveBeenCalledWith('u1');
    expect(api.loadingUser()).toBe(false);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Amina Hassan');
    expect(text).toContain('amina@example.com');
    expect(text).toContain('Admin'); // assigned-role badge
  });

  it('shows the error empty state when the user cannot be loaded (bad deep link)', () => {
    service.get.mockReturnValue(throwError(() => new Error('404')));
    service.getRoles.mockReturnValue(throwError(() => new Error('404')));
    create();

    expect(api.user()).toBeNull();
    expect(api.loadingUser()).toBe(false);
    // Missing i18n keys render as the key itself under TranslocoTestingModule.
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('users.detailError');
  });

  it('guards admin actions on system accounts, with the explaining tooltip', () => {
    service.get.mockReturnValue(of({ ...baseUser, isSystem: true }));
    create();

    expect(api.guarded()).toBe(true);
    expect(api.guardTitle()).toBe('users.systemUserHint');
  });

  it('guards admin actions on your own account', () => {
    service.get.mockReturnValue(of({ ...baseUser, id: 'me' }));
    create();

    expect(api.guarded()).toBe(true);
    expect(api.guardTitle()).toBe('users.selfActionHint');
  });

  it('unlock clears the lockout locally (badge + action drop away) and toasts', () => {
    service.unlock.mockReturnValue(of(undefined));
    create();
    expect(api.user()?.isLockedOut).toBe(true);

    api.confirmUnlock();

    expect(service.unlock).toHaveBeenCalledWith('u1');
    expect(api.user()?.isLockedOut).toBe(false);
    expect(api.user()?.lockoutEnd).toBeNull();
    expect(notify.success).toHaveBeenCalled();
  });

  it('delete removes the user and returns to the list', () => {
    service.remove.mockReturnValue(of(undefined));
    create();

    api.confirmDelete();

    expect(service.remove).toHaveBeenCalledWith('u1');
    expect(router.navigate).toHaveBeenCalledWith(['/users']);
    expect(notify.success).toHaveBeenCalled();
  });
});

import type { MockedObject } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import { AppError, User, UserStatus } from '../../core/models';
import { NotificationService } from '../../core/notifications/notification.service';
import { UserFormPageComponent } from './user-form-page.component';
import { UserService } from './user.service';

const existing: User = {
  id: 'u7',
  firstName: 'Amina',
  lastName: 'Hassan',
  fullName: 'Amina Hassan',
  email: 'amina@example.com',
  phoneNumber: '+201000000000',
  status: UserStatus.Active,
  isSystem: false,
  emailConfirmed: true,
  phoneConfirmed: false,
  avatarUrl: 'https://cdn.example.com/a.png',
  gender: null,
  twoFactorEnabled: false,
  isLockedOut: false,
  createdAt: '2026-01-01T00:00:00Z',
};

function transloco() {
  return TranslocoTestingModule.forRoot({
    langs: { en: {}, ar: {} },
    translocoConfig: { availableLangs: ['en', 'ar'], defaultLang: 'en' },
    preloadLangs: true,
  });
}

/** The protected members the tests drive, accessed via a typed cast (house style, see login spec). */
interface FormApi {
  form: FormGroup;
  mode: () => 'create' | 'edit';
  user: () => User | null;
  loading: () => boolean;
  submit: () => void;
}

describe('UserFormPageComponent', () => {
  let fixture: ComponentFixture<UserFormPageComponent>;
  let component: UserFormPageComponent;
  let api: FormApi;
  let service: MockedObject<UserService>;
  let notify: MockedObject<NotificationService>;
  let router: Router;

  /**
   * Builds the page in create (`id: null`) or edit (`id` set) mode. `arrange` runs after the spies are
   * created but before the component is constructed (the constructor fetches immediately in edit mode).
   */
  function setup(id: string | null, arrange?: () => void): void {
    service = {
      get: vi.fn().mockName('UserService.get'),
      create: vi.fn().mockName('UserService.create'),
      update: vi.fn().mockName('UserService.update'),
    } as unknown as MockedObject<UserService>;
    service.get.mockReturnValue(of(existing));
    notify = {
      success: vi.fn().mockName('NotificationService.success'),
      error: vi.fn().mockName('NotificationService.error'),
    } as unknown as MockedObject<NotificationService>;
    arrange?.();

    TestBed.configureTestingModule({
      imports: [UserFormPageComponent, transloco()],
      providers: [
        provideRouter([]),
        { provide: UserService, useValue: service },
        { provide: NotificationService, useValue: notify },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
      ],
    });

    fixture = TestBed.createComponent(UserFormPageComponent);
    component = fixture.componentInstance;
    api = component as unknown as FormApi;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.detectChanges();
  }

  it('create mode: does not call the API while the form is invalid', () => {
    setup(null);
    expect(api.mode()).toBe('create');

    api.submit();

    expect(service.create).not.toHaveBeenCalled();
  });

  it('create mode: trims values, posts, toasts, and returns to the list', () => {
    setup(null);
    service.create.mockReturnValue(of('new-id'));
    // Names are trimmed on submit; the email must already be clean or Validators.email blocks it.
    api.form.patchValue({
      firstName: '  Amina ',
      lastName: ' Hassan ',
      email: 'amina@example.com',
    });
    api.form.markAsDirty();

    api.submit();

    expect(service.create).toHaveBeenCalledTimes(1);

    expect(service.create).toHaveBeenCalledWith({
      firstName: 'Amina',
      lastName: 'Hassan',
      email: 'amina@example.com',
      phoneNumber: null,
    });
    expect(notify.success).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/users']);
    // The form was marked pristine before navigating, so the unsaved-changes guard lets it pass.
    expect(component.hasUnsavedChanges()).toBe(false);
  });

  it('edit mode: primes the form from the fetched user and disables email', () => {
    setup('u7');

    expect(api.mode()).toBe('edit');
    expect(service.get).toHaveBeenCalledWith('u7');
    expect(api.loading()).toBe(false);
    expect(api.form.controls['firstName'].value).toBe('Amina');
    expect(api.form.controls['email'].disabled).toBe(true);
  });

  it('edit mode: submits the update (echoing avatarUrl) and returns to the list', () => {
    setup('u7');
    service.update.mockReturnValue(of(undefined));
    api.form.patchValue({ lastName: 'Hassan-Ali' });
    api.form.markAsDirty();

    api.submit();

    expect(service.update).toHaveBeenCalledTimes(1);

    expect(service.update).toHaveBeenCalledWith(
      'u7',
      expect.objectContaining({
        firstName: 'Amina',
        lastName: 'Hassan-Ali',
        phoneNumber: '+201000000000',
        avatarUrl: 'https://cdn.example.com/a.png', // not edited here — echoed so a save keeps it
        gender: null,
      }),
    );
    expect(router.navigate).toHaveBeenCalledWith(['/users']);
  });

  it('edit mode: shows the error empty state when the record cannot be fetched', () => {
    setup('missing', () => service.get.mockReturnValue(throwError(() => new Error('404'))));

    expect(api.user()).toBeNull();
    expect(api.loading()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('users.detailError');
  });

  it('binds server field errors onto the matching controls', () => {
    setup(null);
    const err: AppError = {
      status: 400,
      code: 'Validation',
      detail: null,
      fieldErrors: { FirstName: ['Name.Empty'] },
      retryAfterSeconds: null,
      correlationId: null,
    };
    service.create.mockReturnValue(throwError(() => err));
    api.form.patchValue({ firstName: 'A', lastName: 'B', email: 'a@example.com' });

    api.submit();

    expect(api.form.controls['firstName'].errors?.['server']).toBe('Name.Empty');
  });

  it('reports unsaved changes only while dirty and not submitting', () => {
    setup(null);
    expect(component.hasUnsavedChanges()).toBe(false);

    api.form.markAsDirty();
    expect(component.hasUnsavedChanges()).toBe(true);
  });

  it('blocks a hard unload (refresh/close) only while edits are unsaved', () => {
    setup(null);
    // Call the handler directly: dispatching a real beforeunload on window makes the Karma client
    // believe the page is reloading and it disconnects the browser.
    const handler = component as unknown as {
      onBeforeUnload(event: Event): void;
    };
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true });
      handler.onBeforeUnload(event);
      return event.defaultPrevented;
    };

    expect(unload()).toBe(false);

    api.form.markAsDirty();
    expect(unload()).toBe(true);
  });
});

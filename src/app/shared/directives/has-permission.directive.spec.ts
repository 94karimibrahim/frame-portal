import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import { HasPermissionDirective } from './has-permission.directive';

@Component({
  standalone: true,
  imports: [HasPermissionDirective],
  template: `<span *appHasPermission="'users.list'">SECRET</span>`,
})
class HostComponent {}

describe('HasPermissionDirective', () => {
  const perms = signal<ReadonlySet<string>>(new Set());

  beforeEach(() => {
    perms.set(new Set());
    const auth = {
      permissions: perms.asReadonly(),
      hasAny: (codes: readonly string[]) => codes.some((c) => perms().has(c)),
    };
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [{ provide: AuthService, useValue: auth }],
    });
  });

  it('hides content when the user lacks the permission', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('SECRET');
  });

  it('reveals content once the permission is granted', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    perms.set(new Set(['users.list']));
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('SECRET');
  });
});

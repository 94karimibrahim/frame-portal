import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';

/**
 * Structural directive that renders its content only when the user holds **any** of the given permission
 * codes (super-admin always passes, mirroring the backend). Display gating only — the server still
 * enforces every call; this just hides controls the user can't action.
 *
 * @example
 *   <button *appHasPermission="[Permissions.users.create]">New user</button>
 *   <a *appHasPermission="Permissions.roles.list">Roles</a>
 */
@Directive({ selector: '[appHasPermission]' })
export class HasPermissionDirective {
  private readonly auth = inject(AuthService);
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);

  /** A single code or a list; the content shows if the user holds at least one. */
  readonly appHasPermission = input.required<string | readonly string[]>();

  private rendered = false;

  constructor() {
    // Re-evaluates whenever the permission set or the requested codes change (e.g. after switch-tenant).
    effect(() => {
      const codes = this.appHasPermission();
      // Touch the signal so the effect re-runs when permissions reload.
      this.auth.permissions();
      const allowed = this.auth.hasAny(Array.isArray(codes) ? codes : [codes as string]);
      this.toggle(allowed);
    });
  }

  private toggle(show: boolean): void {
    if (show && !this.rendered) {
      this.container.createEmbeddedView(this.template);
      this.rendered = true;
    } else if (!show && this.rendered) {
      this.container.clear();
      this.rendered = false;
    }
  }
}

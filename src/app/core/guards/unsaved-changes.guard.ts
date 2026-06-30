import { inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

/**
 * Implemented by routed components that hold editable, not-yet-persisted state. The guard asks the
 * component whether leaving now would lose work; the component owns the definition of "dirty" (typically
 * `form.dirty && !saving`).
 */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Blocks in-app navigation away from a form with unsaved edits until the user confirms. Uses the native
 * confirm dialog deliberately: it's synchronous, it can't be missed, and it's the one prompt that also
 * reads naturally if the component additionally guards the hard browser unload (`beforeunload`). The
 * message is localized through Transloco. Pair on the route with `canDeactivate: [unsavedChangesGuard]`.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) => {
  if (!component?.hasUnsavedChanges?.()) {
    return true;
  }
  const i18n = inject(TranslocoService);
  return window.confirm(i18n.translate('common.unsavedChanges'));
};

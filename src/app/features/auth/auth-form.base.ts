import { Directive } from '@angular/core';
import { ServerFormBase } from '../../shared/forms/server-form.base';

/**
 * Base for the public auth reactive forms. All behaviour now lives in the shared {@link ServerFormBase};
 * this alias is kept so the auth components read naturally and so auth-specific helpers can be added here
 * later without touching the shared base.
 */
@Directive()
export abstract class AuthFormBase extends ServerFormBase {}

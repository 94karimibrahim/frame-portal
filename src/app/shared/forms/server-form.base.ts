import { Directive, inject, signal } from '@angular/core';
import { AbstractControl, FormGroup } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';
import { AppError } from '../../core/models';

/**
 * Shared behaviour for reactive forms that submit to the API: submit/loading flags, a top-level error
 * banner message, per-control message resolution, and mapping the server's `ValidationProblemDetails`
 * codes back onto the matching controls (FRONTEND_PLAN §7). Lives as a base `@Directive()` so subclasses
 * get DI; it carries no template of its own.
 *
 * Message lookup is code-first: a stable backend code (e.g. `Email.Invalid`, `Name.Empty`) is resolved
 * via Transloco `validation.<code>` then `errors.<code>`, never shown raw to the user.
 */
@Directive()
export abstract class ServerFormBase {
  protected readonly transloco = inject(TranslocoService);

  /** True while a request is in flight (disables the submit button, shows a spinner). */
  protected readonly submitting = signal(false);
  /** Flipped on first submit so validation messages show even for untouched controls. */
  protected readonly submitted = signal(false);
  /** Resolved, localized top-level failure message rendered in the form's alert banner. */
  protected readonly formError = signal<string | null>(null);

  /** The localized error message for a control, or `null` when it shouldn't be shown yet. */
  protected errorFor(control: AbstractControl | null): string | null {
    if (!control || (!control.touched && !this.submitted())) {
      return null;
    }
    const errors = control.errors;
    if (!errors) {
      return null;
    }
    if (typeof errors['server'] === 'string') {
      return this.msg(errors['server'], this.t('errors.title'));
    }
    if (errors['required']) {
      return this.t('validation.required');
    }
    if (errors['email']) {
      return this.t('validation.email');
    }
    if (errors['minlength']) {
      return this.t('validation.minlength');
    }
    if (errors['maxlength']) {
      return this.t('validation.maxlength');
    }
    return this.t('errors.title');
  }

  /** Convenience for `[class.form-input--error]` bindings. */
  protected invalid(control: AbstractControl | null): boolean {
    return this.errorFor(control) !== null;
  }

  /**
   * Whether to surface a positive (valid) state for a control. True only when the user has engaged with it
   * (touched or dirty), it carries validators (so there's actually a rule it passed), it isn't mid-async,
   * and it holds a value — so optional, pristine, and empty fields stay neutral rather than going green.
   * Drives `[class.form-input--success]` and the success row of {@link FieldFeedbackComponent}.
   */
  protected showSuccess(control: AbstractControl | null): boolean {
    if (!control || control.invalid || control.pending || !control.validator) {
      return false;
    }
    if (!control.touched && !control.dirty) {
      return false;
    }
    const value = control.value;
    return value !== null && value !== undefined && value !== '';
  }

  /**
   * Normalizes a failed request: clears the loading flag, binds any per-field codes to their controls, and
   * sets the top-level banner message. Pass the `form` so field-level codes can be applied.
   */
  protected handleError(error: unknown, form?: FormGroup): void {
    this.submitting.set(false);
    const appError = error as AppError;
    if (form) {
      this.applyServerErrors(form, appError);
    }
    this.formError.set(this.resolveMessage(appError));
  }

  /** Binds `ValidationProblemDetails.errors` onto matching controls (case-insensitive name match). */
  protected applyServerErrors(form: FormGroup, error: AppError): boolean {
    if (!error?.fieldErrors) {
      return false;
    }
    let applied = false;
    for (const [field, codes] of Object.entries(error.fieldErrors)) {
      const control = this.findControl(form, field);
      if (control && codes?.length) {
        control.setErrors({ ...(control.errors ?? {}), server: codes[0] });
        control.markAsTouched();
        applied = true;
      }
    }
    return applied;
  }

  private resolveMessage(error: AppError | undefined): string {
    const fallback = this.t('errors.Client.Unknown');
    if (!error) {
      return fallback;
    }
    const fromCode = error.code ? this.msg(error.code, '') : '';
    let message = fromCode || error.detail || fallback;
    if (error.code === 'Client.RateLimited' && error.retryAfterSeconds) {
      message = `${message} (${error.retryAfterSeconds}s)`;
    }
    return message;
  }

  /** Resolve a stable code via `validation.<code>` then `errors.<code>`, falling back to `fallback`. */
  protected msg(code: string, fallback = ''): string {
    return this.t(`validation.${code}`) || this.t(`errors.${code}`) || fallback;
  }

  /** Translate, returning `''` for a missing key so callers can chain fallbacks. */
  private t(key: string): string {
    const value = this.transloco.translate(key);
    return value && value !== key ? value : '';
  }

  private findControl(form: FormGroup, field: string): AbstractControl | null {
    if (form.get(field)) {
      return form.get(field);
    }
    const target = field.toLowerCase();
    for (const name of Object.keys(form.controls)) {
      if (name.toLowerCase() === target) {
        return form.controls[name];
      }
    }
    return null;
  }
}

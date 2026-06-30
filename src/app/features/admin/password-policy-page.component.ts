import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import { PasswordPolicy } from '../../core/models';
import { Permissions } from '../../core/auth/permissions';
import { NotificationService } from '../../core/notifications/notification.service';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { FormSkeletonComponent } from '../../shared/ui/form-skeleton.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { SpinnerComponent } from '../../shared/ui/spinner.component';
import { PasswordPolicyService } from './password-policy.service';

const TOGGLES = [
  { key: 'requireDigit', labelKey: 'admin.passwordPolicy.requireDigit' },
  { key: 'requireSpecial', labelKey: 'admin.passwordPolicy.requireSpecial' },
  { key: 'requireUpper', labelKey: 'admin.passwordPolicy.requireUpper' },
  { key: 'requireLower', labelKey: 'admin.passwordPolicy.requireLower' },
] as const;

const NUMBERS = [
  { key: 'minLength', labelKey: 'admin.passwordPolicy.minLength', min: 1 },
  { key: 'maxAgeDays', labelKey: 'admin.passwordPolicy.maxAgeDays', min: 0 },
  { key: 'historyCount', labelKey: 'admin.passwordPolicy.historyCount', min: 0 },
  { key: 'lockoutThreshold', labelKey: 'admin.passwordPolicy.lockoutThreshold', min: 0 },
  { key: 'lockoutMinutes', labelKey: 'admin.passwordPolicy.lockoutMinutes', min: 0 },
] as const;

/**
 * Per-tenant password policy (FRONTEND_PLAN §2.12 / §9.3): a single upsertable resource. Holders of
 * `passwordpolicies.view` see it; the Save action requires `passwordpolicies.upsert`. The server is
 * authoritative — this is the tenant-wide rule set new/changed passwords are validated against.
 */
@Component({
  selector: 'app-password-policy-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslocoModule,
    HasPermissionDirective,
    PageHeaderComponent,
    SpinnerComponent,
    FormSkeletonComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="mx-auto max-w-2xl">
      <app-page-header
        [title]="'admin.passwordPolicy.title' | transloco"
        [subtitle]="'admin.passwordPolicy.subtitle' | transloco"
      />

      @if (loading()) {
        <app-form-skeleton [sections]="2" [fields]="4" />
      } @else if (loadError()) {
        <app-empty-state [title]="'admin.passwordPolicy.loadError' | transloco">
          <button type="button" class="btn btn-secondary" (click)="load()">
            {{ 'common.retry' | transloco }}
          </button>
        </app-empty-state>
      } @else {
        <form [formGroup]="form" (ngSubmit)="save()" novalidate class="space-y-6">
          <section
            class="rounded-theme-lg border border-gray-200 bg-white p-6 shadow-theme-sm dark:border-gray-800 dark:bg-gray-dark"
          >
            <h2 class="mb-4 text-theme-md font-semibold text-gray-800 dark:text-gray-100">
              {{ 'admin.passwordPolicy.complexity' | transloco }}
            </h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="form-label" for="pp-minLength">{{
                  'admin.passwordPolicy.minLength' | transloco
                }}</label>
                <input
                  id="pp-minLength"
                  type="number"
                  min="1"
                  formControlName="minLength"
                  class="form-input"
                />
              </div>
            </div>
            <div class="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
              @for (t of toggles; track t.key) {
                <label class="flex items-center justify-between gap-4 py-3">
                  <span class="text-theme-sm text-gray-700 dark:text-gray-200">{{
                    t.labelKey | transloco
                  }}</span>
                  <input
                    type="checkbox"
                    [formControlName]="t.key"
                    class="h-4 w-4 rounded border-gray-300 text-brand-500"
                  />
                </label>
              }
            </div>
          </section>

          <section
            class="rounded-theme-lg border border-gray-200 bg-white p-6 shadow-theme-sm dark:border-gray-800 dark:bg-gray-dark"
          >
            <h2 class="mb-4 text-theme-md font-semibold text-gray-800 dark:text-gray-100">
              {{ 'admin.passwordPolicy.lifecycle' | transloco }}
            </h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              @for (n of numbers; track n.key) {
                <div>
                  <label class="form-label" [attr.for]="'pp-' + n.key">{{
                    n.labelKey | transloco
                  }}</label>
                  <input
                    [id]="'pp-' + n.key"
                    type="number"
                    [min]="n.min"
                    [formControlName]="n.key"
                    class="form-input"
                  />
                </div>
              }
            </div>
          </section>

          <div *appHasPermission="perms.upsert" class="flex justify-end">
            <button type="submit" class="btn btn-primary" [disabled]="saving()">
              @if (saving()) {
                <app-spinner size="sm" />
              }
              {{ 'common.save' | transloco }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class PasswordPolicyPageComponent implements HasUnsavedChanges {
  private readonly service = inject(PasswordPolicyService);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(TranslocoService);
  private readonly fb = inject(FormBuilder);
  protected readonly perms = Permissions.passwordPolicies;
  protected readonly toggles = TOGGLES;
  protected readonly numbers = NUMBERS;

  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    minLength: 8,
    requireDigit: true,
    requireSpecial: false,
    requireUpper: true,
    requireLower: true,
    maxAgeDays: 0,
    historyCount: 0,
    lockoutThreshold: 5,
    lockoutMinutes: 15,
  });

  constructor() {
    this.load();
  }

  /** Edited but not yet persisted? Drives both the in-app guard and the browser-unload prompt below. */
  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.saving();
  }

  /** Hard browser navigation (reload/close/external link): a non-empty return value triggers the prompt. */
  @HostListener('window:beforeunload', ['$event'])
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) {
      event.preventDefault();
    }
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.service.get().subscribe({
      next: (policy) => {
        this.form.patchValue(policy);
        this.form.markAsPristine();
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  protected save(): void {
    const v = this.form.getRawValue();
    const policy: PasswordPolicy = {
      minLength: Number(v.minLength) || 1,
      requireDigit: v.requireDigit,
      requireSpecial: v.requireSpecial,
      requireUpper: v.requireUpper,
      requireLower: v.requireLower,
      maxAgeDays: Number(v.maxAgeDays) || 0,
      historyCount: Number(v.historyCount) || 0,
      lockoutThreshold: Number(v.lockoutThreshold) || 0,
      lockoutMinutes: Number(v.lockoutMinutes) || 0,
    };
    this.saving.set(true);
    this.service.upsert(policy).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.markAsPristine();
        this.notify.success(this.i18n.translate('admin.passwordPolicy.saved'));
      },
      error: () => this.saving.set(false),
    });
  }
}

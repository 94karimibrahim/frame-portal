import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  API_KEY_STATUS_LABEL,
  ApiKey,
  ApiKeyCreated,
  CreateApiKeyRequest,
} from '../../../core/models';
import { Permissions } from '../../../core/auth/permissions';
import { NotificationService } from '../../../core/notifications/notification.service';
import { HasPermissionDirective } from '../../../shared/directives/has-permission.directive';
import { BadgeComponent } from '../../../shared/ui/badge.component';
import { ConfirmDialogComponent } from '../../../shared/ui/confirm-dialog.component';
import { ModalComponent } from '../../../shared/ui/modal.component';
import { SpinnerComponent } from '../../../shared/ui/spinner.component';
import { FieldFeedbackComponent } from '../../../shared/forms/field-feedback.component';
import { ServerFormBase } from '../../../shared/forms/server-form.base';
import { ApiKeyService } from '../api-key.service';

/** Splits a comma/whitespace-separated input into a trimmed, de-duplicated list. */
function toList(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[\s,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
}

/**
 * Security-center section: API-key management. Lists the caller's keys and supports create / rotate (each
 * returning the secret exactly once, shown in a copy-then-dismiss modal) and revoke. Sub-actions are
 * permission-gated; the section itself is only mounted when the user holds `apikeys.list` (page-level).
 */
@Component({
  selector: 'app-api-keys-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslocoModule,
    HasPermissionDirective,
    SpinnerComponent,
    BadgeComponent,
    ModalComponent,
    ConfirmDialogComponent,
    FieldFeedbackComponent,
  ],
  template: `
    <section
      class="rounded-theme-lg border border-gray-200 bg-white p-6 shadow-theme-sm dark:border-gray-800 dark:bg-gray-dark"
    >
      <div class="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 class="text-theme-md font-semibold text-gray-800 dark:text-gray-100">
            {{ 'security.apiKeys.title' | transloco }}
          </h2>
          <p class="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
            {{ 'security.apiKeys.subtitle' | transloco }}
          </p>
        </div>
        <button
          *appHasPermission="perms.create"
          type="button"
          class="btn btn-primary px-3 py-1.5"
          (click)="openCreate()"
        >
          {{ 'security.apiKeys.new' | transloco }}
        </button>
      </div>

      @if (loading()) {
        <div class="flex justify-center py-8"><app-spinner /></div>
      } @else if (loadError()) {
        <p class="py-4 text-theme-sm text-error-500">{{ 'security.loadError' | transloco }}</p>
      } @else if (keys().length === 0) {
        <p class="py-4 text-theme-sm text-gray-500 dark:text-gray-400">
          {{ 'security.apiKeys.empty' | transloco }}
        </p>
      } @else {
        <ul class="divide-y divide-gray-100 dark:divide-gray-800">
          @for (k of keys(); track k.id) {
            <li class="flex items-center justify-between gap-4 py-3">
              <div class="min-w-0">
                <p
                  class="flex items-center gap-2 truncate text-theme-sm font-medium text-gray-700 dark:text-gray-200"
                >
                  {{ k.name }}
                  <app-badge [variant]="k.status === 0 ? 'success' : 'neutral'">{{
                    statusLabel(k) | transloco
                  }}</app-badge>
                </p>
                <p class="truncate text-theme-xs text-gray-500 dark:text-gray-400">
                  <code>{{ k.prefix }}…</code> · {{ k.scopes.length }}
                  {{ 'security.apiKeys.scopes' | transloco }}
                </p>
              </div>
              <div class="flex shrink-0 gap-2">
                <button
                  *appHasPermission="perms.update"
                  type="button"
                  class="btn btn-secondary px-3 py-1.5"
                  (click)="pendingRotate.set(k)"
                >
                  {{ 'security.apiKeys.rotate' | transloco }}
                </button>
                <button
                  *appHasPermission="perms.delete"
                  type="button"
                  class="btn btn-secondary px-3 py-1.5"
                  (click)="pendingDelete.set(k)"
                >
                  {{ 'common.delete' | transloco }}
                </button>
              </div>
            </li>
          }
        </ul>
      }
    </section>

    <!-- Create -->
    @if (createOpen()) {
      <app-modal
        [title]="'security.apiKeys.createTitle' | transloco"
        widthClass="max-w-lg"
        (closed)="createOpen.set(false)"
      >
        <form [formGroup]="form" (ngSubmit)="create()" novalidate>
          @if (formError(); as message) {
            <div class="mb-4 alert-error" role="alert">{{ message }}</div>
          }
          <div class="space-y-4">
            <div>
              <label class="form-label" for="ak-name">{{
                'security.apiKeys.name' | transloco
              }}</label>
              <input
                id="ak-name"
                type="text"
                formControlName="name"
                class="form-input"
                [class.form-input--error]="invalid(form.controls.name)"
                [class.form-input--success]="showSuccess(form.controls.name)"
              />
              <app-field-feedback
                [error]="errorFor(form.controls.name)"
                [success]="showSuccess(form.controls.name)"
              />
            </div>
            <div>
              <label class="form-label" for="ak-scopes">{{
                'security.apiKeys.scopesLabel' | transloco
              }}</label>
              <textarea
                id="ak-scopes"
                rows="2"
                formControlName="scopes"
                class="form-input"
                [placeholder]="'security.apiKeys.scopesPlaceholder' | transloco"
              ></textarea>
            </div>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="form-label" for="ak-expires">{{
                  'security.apiKeys.expiresAt' | transloco
                }}</label>
                <input id="ak-expires" type="date" formControlName="expiresAt" class="form-input" />
              </div>
              <div>
                <label class="form-label" for="ak-ips">{{
                  'security.apiKeys.ipBindings' | transloco
                }}</label>
                <input
                  id="ak-ips"
                  type="text"
                  formControlName="ipBindings"
                  class="form-input"
                  [placeholder]="'security.apiKeys.ipPlaceholder' | transloco"
                />
              </div>
            </div>
          </div>
        </form>
        <div modalFooter class="flex items-center justify-end gap-3">
          <button
            type="button"
            class="btn btn-secondary"
            (click)="createOpen.set(false)"
            [disabled]="submitting()"
          >
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            type="button"
            class="btn btn-primary"
            (click)="create()"
            [disabled]="submitting()"
          >
            @if (submitting()) {
              <app-spinner size="sm" />
            }
            {{ 'common.create' | transloco }}
          </button>
        </div>
      </app-modal>
    }

    <!-- Reveal-once secret -->
    @if (secret(); as created) {
      <app-modal
        [title]="'security.apiKeys.secretTitle' | transloco"
        widthClass="max-w-lg"
        (closed)="secret.set(null)"
      >
        <p class="mb-3 text-theme-sm text-error-600 dark:text-error-500">
          {{ 'security.apiKeys.secretHint' | transloco }}
        </p>
        <code
          class="block break-all rounded-theme-md bg-gray-50 px-3 py-3 font-mono text-theme-sm text-gray-800 dark:bg-gray-800 dark:text-gray-100"
          >{{ created.apiKey }}</code
        >
        <div modalFooter class="flex items-center justify-end gap-3">
          <button type="button" class="btn btn-secondary" (click)="copy(created.apiKey)">
            {{ 'common.copy' | transloco }}
          </button>
          <button type="button" class="btn btn-primary" (click)="secret.set(null)">
            {{ 'common.close' | transloco }}
          </button>
        </div>
      </app-modal>
    }

    @if (pendingRotate(); as k) {
      <app-confirm-dialog
        [title]="'security.apiKeys.rotateTitle' | transloco"
        [message]="'security.apiKeys.rotateConfirm' | transloco: { name: k.name }"
        [confirmLabel]="'security.apiKeys.rotate' | transloco"
        [busy]="acting()"
        (confirmed)="rotate(k)"
        (cancelled)="pendingRotate.set(null)"
      />
    }
    @if (pendingDelete(); as k) {
      <app-confirm-dialog
        [title]="'security.apiKeys.deleteTitle' | transloco"
        [message]="'security.apiKeys.deleteConfirm' | transloco: { name: k.name }"
        [confirmLabel]="'common.delete' | transloco"
        [danger]="true"
        [busy]="acting()"
        (confirmed)="remove(k)"
        (cancelled)="pendingDelete.set(null)"
      />
    }
  `,
})
export class ApiKeysSectionComponent extends ServerFormBase {
  private readonly service = inject(ApiKeyService);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(TranslocoService);
  private readonly fb = inject(FormBuilder);
  protected readonly perms = Permissions.apiKeys;

  protected readonly keys = signal<ApiKey[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly createOpen = signal(false);
  protected readonly secret = signal<ApiKeyCreated | null>(null);
  protected readonly pendingRotate = signal<ApiKey | null>(null);
  protected readonly pendingDelete = signal<ApiKey | null>(null);
  protected readonly acting = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    scopes: [''],
    expiresAt: [''],
    ipBindings: [''],
  });

  constructor() {
    super();
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.service.list().subscribe({
      next: (list) => {
        this.keys.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  protected openCreate(): void {
    this.form.reset();
    this.formError.set(null);
    this.submitted.set(false);
    this.createOpen.set(true);
  }

  protected create(): void {
    this.submitted.set(true);
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const request: CreateApiKeyRequest = {
      name: v.name.trim(),
      scopes: toList(v.scopes),
      expiresAt: v.expiresAt || null,
      ipBindings: v.ipBindings ? toList(v.ipBindings) : null,
    };
    this.submitting.set(true);
    this.service.create(request).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.createOpen.set(false);
        this.secret.set(created);
        this.load();
      },
      error: (err) => this.handleError(err, this.form),
    });
  }

  protected rotate(key: ApiKey): void {
    this.acting.set(true);
    this.service.rotate(key.id).subscribe({
      next: (created) => {
        this.acting.set(false);
        this.pendingRotate.set(null);
        this.secret.set(created);
        this.load();
      },
      error: () => this.acting.set(false),
    });
  }

  protected remove(key: ApiKey): void {
    this.acting.set(true);
    this.service.revoke(key.id).subscribe({
      next: () => {
        this.acting.set(false);
        this.pendingDelete.set(null);
        this.notify.success(this.i18n.translate('security.apiKeys.revoked'));
        this.load();
      },
      error: () => this.acting.set(false),
    });
  }

  protected statusLabel(key: ApiKey): string {
    return API_KEY_STATUS_LABEL[key.status];
  }

  protected copy(value: string): void {
    void navigator.clipboard
      ?.writeText(value)
      .then(() => this.notify.success(this.i18n.translate('common.copied')));
  }
}

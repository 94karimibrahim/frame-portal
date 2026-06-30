import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AppError, CreateIpFilterRequest, IpFilter, IpFilterType } from '../../core/models';
import { Permissions } from '../../core/auth/permissions';
import { NotificationService } from '../../core/notifications/notification.service';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { BadgeComponent } from '../../shared/ui/badge.component';
import { CardComponent } from '../../shared/ui/card.component';
import { ConfirmDialogComponent } from '../../shared/ui/confirm-dialog.component';
import { ListSkeletonComponent } from '../../shared/ui/list-skeleton.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { SpinnerComponent } from '../../shared/ui/spinner.component';
import { FieldFeedbackComponent } from '../../shared/forms/field-feedback.component';
import { ServerFormBase } from '../../shared/forms/server-form.base';
import { IpFilterService } from './ip-filter.service';
import { ipFilterTypeLabel, ipFilterTypeVariant } from './ip-filter.util';

/**
 * Per-tenant IP filtering (FRONTEND_PLAN §2.12 / §9.4): allow/block CIDR rules. Lists the current rules and,
 * for holders of `ipfilters.create`, adds new ones inline; `ipfilters.delete` removes them. A blocked
 * address is rejected by the backend before MVC, so this is a sensitive control — order/precedence is the
 * server's concern.
 */
@Component({
  selector: 'app-ip-filters-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslocoModule,
    HasPermissionDirective,
    PageHeaderComponent,
    CardComponent,
    SpinnerComponent,
    ListSkeletonComponent,
    BadgeComponent,
    ConfirmDialogComponent,
    FieldFeedbackComponent,
  ],
  template: `
    <div class="mx-auto max-w-3xl">
      <app-page-header
        [title]="'admin.ipFilters.title' | transloco"
        [subtitle]="'admin.ipFilters.subtitle' | transloco"
      />

      <app-card *appHasPermission="perms.create" class="mb-6">
        <form [formGroup]="form" (ngSubmit)="add()" novalidate>
          @if (formError(); as message) {
            <div class="mb-4 alert-error" role="alert">{{ message }}</div>
          }
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
            <div class="sm:col-span-5">
              <label class="form-label" for="f-cidr">{{
                'admin.ipFilters.address' | transloco
              }}</label>
              <input
                id="f-cidr"
                type="text"
                formControlName="ipAddressOrCidr"
                class="form-input"
                placeholder="10.0.0.0/24"
                [class.form-input--error]="invalid(form.controls.ipAddressOrCidr)"
                [class.form-input--success]="showSuccess(form.controls.ipAddressOrCidr)"
              />
              <app-field-feedback
                [error]="errorFor(form.controls.ipAddressOrCidr)"
                [success]="showSuccess(form.controls.ipAddressOrCidr)"
              />
            </div>
            <div class="sm:col-span-3">
              <label class="form-label" for="f-type">{{
                'admin.ipFilters.type' | transloco
              }}</label>
              <select id="f-type" formControlName="type" class="form-input">
                <option [value]="allow">{{ 'admin.ipFilters.allow' | transloco }}</option>
                <option [value]="block">{{ 'admin.ipFilters.block' | transloco }}</option>
              </select>
            </div>
            <div class="sm:col-span-4">
              <label class="form-label" for="f-desc">{{
                'admin.ipFilters.description' | transloco
              }}</label>
              <input id="f-desc" type="text" formControlName="description" class="form-input" />
            </div>
          </div>
          <div class="mt-4 flex justify-end">
            <button type="submit" class="btn btn-primary" [disabled]="submitting()">
              @if (submitting()) {
                <app-spinner size="sm" />
              }
              {{ 'admin.ipFilters.add' | transloco }}
            </button>
          </div>
        </form>
      </app-card>

      <app-card [padding]="false">
        <div class="p-2 sm:p-3">
          @if (loading()) {
            <app-list-skeleton [rows]="4" />
          } @else if (loadError()) {
            <p class="py-6 text-center text-theme-sm text-error-500">
              {{ 'admin.ipFilters.loadError' | transloco }}
            </p>
          } @else if (filters().length === 0) {
            <p class="py-6 text-center text-theme-sm text-gray-500 dark:text-gray-400">
              {{ 'admin.ipFilters.empty' | transloco }}
            </p>
          } @else {
            <ul class="divide-y divide-gray-100 dark:divide-gray-800">
              @for (f of filters(); track f.id) {
                <li class="flex items-center justify-between gap-4 px-2 py-3">
                  <div class="min-w-0">
                    <p
                      class="flex items-center gap-2 text-theme-sm font-medium text-gray-700 dark:text-gray-200"
                    >
                      <app-badge [variant]="typeVariant(f)">{{
                        typeLabel(f) | transloco
                      }}</app-badge>
                      <code>{{ f.ipAddressOrCidr }}</code>
                    </p>
                    @if (f.description) {
                      <p class="mt-0.5 truncate text-theme-xs text-gray-500 dark:text-gray-400">
                        {{ f.description }}
                      </p>
                    }
                  </div>
                  <button
                    *appHasPermission="perms.delete"
                    type="button"
                    class="btn btn-secondary px-3 py-1.5"
                    (click)="pendingDelete.set(f)"
                  >
                    {{ 'common.delete' | transloco }}
                  </button>
                </li>
              }
            </ul>
          }
        </div>
      </app-card>
    </div>

    @if (pendingDelete(); as f) {
      <app-confirm-dialog
        [title]="'admin.ipFilters.deleteTitle' | transloco"
        [message]="'admin.ipFilters.deleteConfirm' | transloco: { value: f.ipAddressOrCidr }"
        [confirmLabel]="'common.delete' | transloco"
        [danger]="true"
        [busy]="deleting()"
        (confirmed)="remove(f)"
        (cancelled)="pendingDelete.set(null)"
      />
    }
  `,
})
export class IpFiltersPageComponent extends ServerFormBase {
  private readonly service = inject(IpFilterService);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(TranslocoService);
  private readonly fb = inject(FormBuilder);
  protected readonly perms = Permissions.ipFilters;
  protected readonly allow = IpFilterType.Allow;
  protected readonly block = IpFilterType.Block;

  protected readonly filters = signal<IpFilter[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly pendingDelete = signal<IpFilter | null>(null);
  protected readonly deleting = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    ipAddressOrCidr: ['', [Validators.required]],
    type: [String(IpFilterType.Allow)],
    description: [''],
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
        this.filters.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  protected add(): void {
    this.submitted.set(true);
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const request: CreateIpFilterRequest = {
      ipAddressOrCidr: v.ipAddressOrCidr.trim(),
      type: Number(v.type) as IpFilterType,
      description: v.description.trim() || null,
    };
    this.submitting.set(true);
    this.service.create(request).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitted.set(false);
        this.form.reset({ ipAddressOrCidr: '', type: String(IpFilterType.Allow), description: '' });
        this.notify.success(this.i18n.translate('admin.ipFilters.added'));
        this.load();
      },
      error: (err) => this.handleError(err, this.form),
    });
  }

  /**
   * Optimistic delete: drop the rule from the list immediately and close the dialog, then call the server.
   * On failure, restore the list and surface the reason (nothing else toasts this path).
   */
  protected remove(filter: IpFilter): void {
    const snapshot = this.filters();
    this.filters.update((list) => list.filter((f) => f.id !== filter.id));
    this.pendingDelete.set(null);
    this.service.remove(filter.id).subscribe({
      next: () => this.notify.success(this.i18n.translate('admin.ipFilters.deleted')),
      error: (err: AppError) => {
        this.filters.set(snapshot);
        this.notify.error(err?.detail || this.i18n.translate('common.actionFailed'));
      },
    });
  }

  protected typeLabel(filter: IpFilter): string {
    return ipFilterTypeLabel(filter.type);
  }

  protected typeVariant(filter: IpFilter): ReturnType<typeof ipFilterTypeVariant> {
    return ipFilterTypeVariant(filter.type);
  }
}

import { ChangeDetectionStrategy, Component, HostListener, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { HasUnsavedChanges } from '../../core/guards/unsaved-changes.guard';
import { SUPPORTED_CULTURES } from '../../core/i18n/locale.service';
import { LocaleService } from '../../core/i18n/locale.service';
import { ThemeMode, ThemeService } from '../../core/theme/theme.service';
import { NotificationService } from '../../core/notifications/notification.service';
import { Preferences, UpdatePreferencesRequest } from '../../core/models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { SpinnerComponent } from '../../shared/ui/spinner.component';
import { PreferencesService } from './preferences.service';

/** Boolean preference controls, grouped for display; `key` is the form control + DTO field name. */
const TOGGLE_GROUPS = [
  {
    titleKey: 'preferences.notificationsGroup',
    fields: [
      { key: 'notifications', labelKey: 'preferences.notifications' },
      { key: 'emailNotificationsEnabled', labelKey: 'preferences.email' },
      { key: 'smsNotificationsEnabled', labelKey: 'preferences.sms' },
      { key: 'pushNotificationsEnabled', labelKey: 'preferences.push' },
      { key: 'inAppNotificationsEnabled', labelKey: 'preferences.inApp' },
      { key: 'marketingEmailsEnabled', labelKey: 'preferences.marketing' },
    ],
  },
  {
    titleKey: 'preferences.privacyGroup',
    fields: [
      { key: 'showOnlineStatus', labelKey: 'preferences.showOnlineStatus' },
      { key: 'showLastSeen', labelKey: 'preferences.showLastSeen' },
      { key: 'profilePublic', labelKey: 'preferences.profilePublic' },
    ],
  },
  {
    titleKey: 'preferences.securityGroup',
    fields: [{ key: 'requirePasswordOnSensitiveActions', labelKey: 'preferences.requirePassword' }],
  },
] as const;

/**
 * The signed-in user's preferences (FRONTEND_PLAN §2.13). Loads the full set, edits it as a grouped form,
 * and on save persists via `PUT /preferences`. Language and theme are also applied to the running app
 * immediately (LocaleService / ThemeService), so the choice takes effect without a reload while the server
 * preference becomes authoritative for next sign-in.
 */
@Component({
  selector: 'app-preferences-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    TranslocoModule,
    PageHeaderComponent,
    SpinnerComponent,
    EmptyStateComponent,
  ],
  template: `
    <div class="mx-auto max-w-3xl">
      <app-page-header
        [title]="'preferences.title' | transloco"
        [subtitle]="'preferences.subtitle' | transloco"
      />

      @if (loading()) {
        <div class="flex justify-center py-16">
          <app-spinner size="lg" [label]="'common.loading' | transloco" />
        </div>
      } @else if (loadError()) {
        <app-empty-state [title]="'preferences.loadError' | transloco">
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
              {{ 'preferences.generalGroup' | transloco }}
            </h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="form-label" for="p-language">{{
                  'preferences.language' | transloco
                }}</label>
                <select id="p-language" formControlName="language" class="form-input">
                  @for (c of cultures; track c) {
                    <option [value]="c">{{ 'preferences.lang.' + c | transloco }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="form-label" for="p-theme">{{
                  'preferences.theme' | transloco
                }}</label>
                <select id="p-theme" formControlName="theme" class="form-input">
                  @for (t of themes; track t) {
                    <option [value]="t">{{ 'preferences.themeOption.' + t | transloco }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="form-label" for="p-timezone">{{
                  'preferences.timezone' | transloco
                }}</label>
                <input
                  id="p-timezone"
                  type="text"
                  formControlName="timezone"
                  placeholder="UTC"
                  class="form-input"
                />
              </div>
              <div>
                <label class="form-label" for="p-dateFormat">{{
                  'preferences.dateFormat' | transloco
                }}</label>
                <input
                  id="p-dateFormat"
                  type="text"
                  formControlName="dateFormat"
                  placeholder="yyyy-MM-dd"
                  class="form-input"
                />
              </div>
              <div>
                <label class="form-label" for="p-timeFormat">{{
                  'preferences.timeFormat' | transloco
                }}</label>
                <input
                  id="p-timeFormat"
                  type="text"
                  formControlName="timeFormat"
                  placeholder="HH:mm"
                  class="form-input"
                />
              </div>
            </div>
          </section>

          @for (group of toggleGroups; track group.titleKey) {
            <section
              class="rounded-theme-lg border border-gray-200 bg-white p-6 shadow-theme-sm dark:border-gray-800 dark:bg-gray-dark"
            >
              <h2 class="mb-3 text-theme-md font-semibold text-gray-800 dark:text-gray-100">
                {{ group.titleKey | transloco }}
              </h2>
              <div class="divide-y divide-gray-100 dark:divide-gray-800">
                @for (field of group.fields; track field.key) {
                  <label class="flex items-center justify-between gap-4 py-3">
                    <span class="text-theme-sm text-gray-700 dark:text-gray-200">{{
                      field.labelKey | transloco
                    }}</span>
                    <input
                      type="checkbox"
                      [formControlName]="field.key"
                      class="h-4 w-4 rounded border-gray-300 text-brand-500"
                    />
                  </label>
                }
              </div>
            </section>
          }

          <section
            class="rounded-theme-lg border border-gray-200 bg-white p-6 shadow-theme-sm dark:border-gray-800 dark:bg-gray-dark"
          >
            <h2 class="mb-4 text-theme-md font-semibold text-gray-800 dark:text-gray-100">
              {{ 'preferences.sessionGroup' | transloco }}
            </h2>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="form-label" for="p-autoLogout">{{
                  'preferences.autoLogoutMinutes' | transloco
                }}</label>
                <input
                  id="p-autoLogout"
                  type="number"
                  min="0"
                  formControlName="autoLogoutMinutes"
                  class="form-input"
                />
              </div>
              <div>
                <label class="form-label" for="p-maxSessions">{{
                  'preferences.maxActiveSessions' | transloco
                }}</label>
                <input
                  id="p-maxSessions"
                  type="number"
                  min="1"
                  formControlName="maxActiveSessions"
                  class="form-input"
                />
              </div>
            </div>
          </section>

          <div class="flex justify-end">
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
export class PreferencesPageComponent implements HasUnsavedChanges {
  private readonly service = inject(PreferencesService);
  private readonly locale = inject(LocaleService);
  private readonly theme = inject(ThemeService);
  private readonly notify = inject(NotificationService);
  private readonly i18n = inject(TranslocoService);
  private readonly fb = inject(FormBuilder);

  protected readonly cultures = SUPPORTED_CULTURES;
  protected readonly themes: ThemeMode[] = ['light', 'dark', 'system'];
  protected readonly toggleGroups = TOGGLE_GROUPS;

  protected readonly loading = signal(true);
  protected readonly loadError = signal(false);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    language: 'en',
    theme: 'system',
    timezone: 'UTC',
    dateFormat: '',
    timeFormat: '',
    notifications: true,
    emailNotificationsEnabled: true,
    smsNotificationsEnabled: false,
    pushNotificationsEnabled: false,
    inAppNotificationsEnabled: true,
    marketingEmailsEnabled: false,
    showOnlineStatus: true,
    showLastSeen: true,
    profilePublic: false,
    requirePasswordOnSensitiveActions: false,
    autoLogoutMinutes: 0,
    maxActiveSessions: 5,
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
      next: (prefs) => {
        this.form.patchValue(prefs);
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
    const request: UpdatePreferencesRequest = {
      ...(v as Preferences),
      autoLogoutMinutes: Number(v.autoLogoutMinutes) || 0,
      maxActiveSessions: Number(v.maxActiveSessions) || 1,
    };

    this.saving.set(true);
    this.service.update(request).subscribe({
      next: () => {
        this.saving.set(false);
        this.form.markAsPristine();
        // Apply the visual choices immediately; the server preference now wins on next sign-in.
        this.locale.setCulture(v.language);
        this.theme.setMode(v.theme as ThemeMode);
        this.notify.success(this.i18n.translate('preferences.saved'));
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }
}

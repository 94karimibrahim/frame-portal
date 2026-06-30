import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { Permissions } from '../../core/auth/permissions';
import { HasPermissionDirective } from '../../shared/directives/has-permission.directive';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { ApiKeysSectionComponent } from './sections/api-keys-section.component';
import { DevicesSectionComponent } from './sections/devices-section.component';
import { SessionsSectionComponent } from './sections/sessions-section.component';
import { SocialAccountsSectionComponent } from './sections/social-accounts-section.component';
import { TwoFactorSectionComponent } from './sections/two-factor-section.component';

/**
 * Security center (`account/security`) — composes the self-service security sections: two-factor, sessions,
 * known devices, social accounts, and (only for holders of `apikeys.list`) API keys. Each section owns its
 * own data and state; this page just lays them out.
 */
@Component({
  selector: 'app-security-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TranslocoModule,
    HasPermissionDirective,
    PageHeaderComponent,
    TwoFactorSectionComponent,
    SessionsSectionComponent,
    DevicesSectionComponent,
    SocialAccountsSectionComponent,
    ApiKeysSectionComponent,
  ],
  template: `
    <div class="mx-auto max-w-3xl">
      <app-page-header
        [title]="'security.title' | transloco"
        [subtitle]="'security.subtitle' | transloco"
      />

      <div class="space-y-6">
        <app-two-factor-section />
        <app-sessions-section />
        <app-devices-section />
        <app-social-accounts-section />
        <app-api-keys-section *appHasPermission="apiKeysList" />
      </div>
    </div>
  `,
})
export class SecurityPageComponent {
  protected readonly apiKeysList = Permissions.apiKeys.list;
}

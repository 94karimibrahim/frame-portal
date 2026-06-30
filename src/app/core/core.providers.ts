import { EnvironmentProviders, Provider, inject, provideAppInitializer } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth/auth.service';
import { LocaleService } from './i18n/locale.service';
import { ThemeService } from './theme/theme.service';
import { provideAppTransloco } from './i18n/transloco.providers';
import { authTenantInterceptor } from './interceptors/auth-tenant.interceptor';
import { refreshInterceptor } from './interceptors/refresh.interceptor';
import { errorInterceptor } from './interceptors/error.interceptor';

/**
 * Single composition root for the core singletons. Interceptor order matters: error (outermost) →
 * refresh → auth/tenant (innermost), so a 401 is transparently refreshed-and-retried before any error
 * mapping, and the retry picks up the freshly attached token.
 */
export function provideCore(): (Provider | EnvironmentProviders)[] {
  return [
    provideHttpClient(
      withInterceptors([errorInterceptor, refreshInterceptor, authTenantInterceptor]),
    ),
    ...provideAppTransloco(),
    provideAppInitializer(async () => {
      const locale = inject(LocaleService);
      const theme = inject(ThemeService);
      const auth = inject(AuthService);
      const transloco = inject(TranslocoService);

      // Apply theme + direction/lang immediately so there is no flash before first paint.
      locale.init();
      theme.init();

      // Preload the active language dictionary, then restore any prior session. Restoration never
      // throws — a failure just leaves the user signed out at the login page.
      await Promise.all([
        firstValueFrom(transloco.load(locale.culture())),
        firstValueFrom(auth.restoreSession()).catch(() => false),
      ]);
    }),
  ];
}

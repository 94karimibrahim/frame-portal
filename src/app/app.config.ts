import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import {
  PreloadAllModules,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withPreloading,
} from '@angular/router';

import { routes } from './app.routes';
import { provideCore } from './core/core.providers';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      // Eagerly fetch lazy feature chunks in the background after the first paint, so navigating to
      // any page after load is instant. Cheap for an app this size; revisit with a network-aware
      // strategy if the bundle grows.
      withPreloading(PreloadAllModules),
    ),
    provideAnimations(),
    ...provideCore(),
  ],
};

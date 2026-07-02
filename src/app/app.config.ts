import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import {
  PreloadAllModules,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withPreloading,
  withViewTransitions,
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
      // Native route transitions (View Transitions API). The routed content's cross-fade/lift is
      // scoped via `view-transition-name` in styles.css; browsers without support just skip the
      // animation. Replaces the old @angular/animations routeFade trigger.
      withViewTransitions({ skipInitialTransition: true }),
    ),
    ...provideCore(),
  ],
};

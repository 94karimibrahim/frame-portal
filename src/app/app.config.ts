import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
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
    // Zoneless change detection: the app is 100% OnPush + signals, so nothing needs zone.js's
    // monkey-patching. zone.js stays a dev-only test polyfill because the interceptor/auth specs
    // use fakeAsync/tick (see angular.json's test polyfills); the Playwright suite exercises the
    // real zoneless build.
    provideZonelessChangeDetection(),
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

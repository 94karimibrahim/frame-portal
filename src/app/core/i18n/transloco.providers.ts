import { Provider } from '@angular/core';
import { provideTransloco } from '@jsverse/transloco';
import { environment } from '../../../environments/environment';
import { SUPPORTED_CULTURES, DEFAULT_CULTURE } from './locale.service';
import { TranslocoHttpLoader } from './transloco-loader';

/** Transloco configuration: en/ar, runtime switch, JSON loader. */
export function provideAppTransloco(): Provider[] {
  return [
    provideTransloco({
      config: {
        availableLangs: [...SUPPORTED_CULTURES],
        defaultLang: DEFAULT_CULTURE,
        fallbackLang: DEFAULT_CULTURE,
        reRenderOnLangChange: true,
        prodMode: environment.production,
        missingHandler: { allowEmpty: true, logMissingKey: !environment.production },
      },
      loader: TranslocoHttpLoader,
    }),
  ];
}

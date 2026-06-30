import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Translation, TranslocoLoader } from '@jsverse/transloco';

/**
 * Loads translation dictionaries from `/i18n/{lang}.json` (served from `public/i18n`). Uses `HttpBackend`
 * directly so i18n fetches bypass the app interceptors (no auth/tenant headers on static assets).
 */
@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  private readonly http = new HttpClient(inject(HttpBackend));

  getTranslation(lang: string) {
    return this.http.get<Translation>(`/i18n/${lang}.json`);
  }
}

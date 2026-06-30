import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

/** Cultures the backend serves (`GET /api/localization/cultures`). `ar` is RTL. */
export const SUPPORTED_CULTURES = ['en', 'ar'] as const;
export type Culture = (typeof SUPPORTED_CULTURES)[number];
export const DEFAULT_CULTURE: Culture = 'en';
const RTL_CULTURES: readonly string[] = ['ar'];

/**
 * Owns the active culture and keeps the document, Transloco, and the `Accept-Language` header in sync.
 * Direction (`dir`) flips to `rtl` for Arabic; every shared component relies on Tailwind logical
 * properties so this single attribute change drives the whole layout.
 */
@Injectable({ providedIn: 'root' })
export class LocaleService {
  private static readonly KEY = 'frame.lang';
  private readonly doc = inject(DOCUMENT);
  private readonly transloco = inject(TranslocoService);

  private readonly _culture = signal<Culture>(this.read());
  readonly culture = this._culture.asReadonly();
  readonly isRtl = computed(() => RTL_CULTURES.includes(this._culture()));
  readonly dir = computed<'rtl' | 'ltr'>(() => (this.isRtl() ? 'rtl' : 'ltr'));

  /** Applies the persisted/initial culture to Transloco + the document. Called once at app start. */
  init(): void {
    this.apply(this._culture());
  }

  /** Switches culture at runtime (language switcher / saved preference) and persists the choice. */
  setCulture(culture: string): void {
    const next: Culture = (SUPPORTED_CULTURES as readonly string[]).includes(culture)
      ? (culture as Culture)
      : DEFAULT_CULTURE;
    this._culture.set(next);
    try {
      localStorage.setItem(LocaleService.KEY, next);
    } catch {
      // Non-fatal.
    }
    this.apply(next);
  }

  /** Value for the `Accept-Language` request header. */
  acceptLanguage(): string {
    return this._culture();
  }

  private apply(culture: Culture): void {
    this.transloco.setActiveLang(culture);
    const html = this.doc.documentElement;
    html.setAttribute('lang', culture);
    html.setAttribute('dir', RTL_CULTURES.includes(culture) ? 'rtl' : 'ltr');
  }

  private read(): Culture {
    try {
      const saved = localStorage.getItem(LocaleService.KEY);
      if (saved && (SUPPORTED_CULTURES as readonly string[]).includes(saved)) {
        return saved as Culture;
      }
    } catch {
      // Ignore storage errors.
    }
    return DEFAULT_CULTURE;
  }
}

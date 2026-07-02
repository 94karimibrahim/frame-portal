import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { LocaleService } from './locale.service';

function transloco() {
  return TranslocoTestingModule.forRoot({
    langs: { en: {}, ar: {} },
    translocoConfig: { availableLangs: ['en', 'ar'], defaultLang: 'en' },
    preloadLangs: true,
  });
}

describe('LocaleService', () => {
  let service: LocaleService;
  let doc: Document;

  beforeEach(() => {
    localStorage.removeItem('frame.lang');
    TestBed.configureTestingModule({ imports: [transloco()] });
    service = TestBed.inject(LocaleService);
    doc = TestBed.inject(DOCUMENT);
  });

  it('defaults to English, left-to-right', () => {
    expect(service.culture()).toBe('en');
    expect(service.isRtl()).toBe(false);
    expect(service.dir()).toBe('ltr');
  });

  it('switches Arabic to RTL and reflects it on the document (RTL render check)', () => {
    service.setCulture('ar');
    expect(service.isRtl()).toBe(true);
    expect(service.dir()).toBe('rtl');
    expect(doc.documentElement.getAttribute('dir')).toBe('rtl');
    expect(doc.documentElement.getAttribute('lang')).toBe('ar');
  });

  it('persists the choice and falls back to the default for an unknown culture', () => {
    service.setCulture('ar');
    expect(localStorage.getItem('frame.lang')).toBe('ar');
    service.setCulture('fr');
    expect(service.culture()).toBe('en');
    expect(service.dir()).toBe('ltr');
  });
});

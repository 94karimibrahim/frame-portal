import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { PaginationComponent } from './pagination.component';

function transloco() {
  return TranslocoTestingModule.forRoot({
    langs: {
      en: {
        pagination: { range: '{{from}}-{{to}} of {{total}}' },
        common: { previous: 'Previous', next: 'Next' },
      },
      ar: {},
    },
    translocoConfig: { availableLangs: ['en', 'ar'], defaultLang: 'en' },
    preloadLangs: true,
  });
}

describe('PaginationComponent', () => {
  function render(inputs: {
    pageNumber: number;
    pageSize: number;
    totalCount: number;
    hasPrevious: boolean;
    hasNext: boolean;
  }) {
    const fixture = TestBed.createComponent(PaginationComponent);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [transloco()] });
  });

  it('shows the 1-based range for the current page', () => {
    const fixture = render({
      pageNumber: 2,
      pageSize: 10,
      totalCount: 35,
      hasPrevious: true,
      hasNext: true,
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('11-20 of 35');
  });

  it('clamps the upper bound to the total on the last page', () => {
    const fixture = render({
      pageNumber: 4,
      pageSize: 10,
      totalCount: 35,
      hasPrevious: true,
      hasNext: false,
    });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('31-35 of 35');
  });

  it('disables Previous on the first page and emits the next page on Next', () => {
    const fixture = render({
      pageNumber: 1,
      pageSize: 10,
      totalCount: 35,
      hasPrevious: false,
      hasNext: true,
    });
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);

    let emitted: number | undefined;
    fixture.componentInstance.pageChange.subscribe((p) => (emitted = p));
    (buttons[1] as HTMLButtonElement).click();
    expect(emitted).toBe(2);
  });
});

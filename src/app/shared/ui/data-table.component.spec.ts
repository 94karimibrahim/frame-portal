import { TestBed } from '@angular/core/testing';
import { ColumnDef } from '@tanstack/angular-table';
import { DataTableComponent } from './data-table.component';

interface Row {
  name: string;
  email: string;
}

describe('DataTableComponent', () => {
  function render(columns: ColumnDef<Row, unknown>[], data: Row[]) {
    const fixture = TestBed.createComponent<DataTableComponent<Row>>(DataTableComponent);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const columns: ColumnDef<Row, unknown>[] = [
    { accessorKey: 'name', header: () => 'Name' },
    { accessorKey: 'email', header: () => 'Email' },
  ];

  it('renders a header cell per column', () => {
    const el = render(columns, []);
    const headers = Array.from(el.querySelectorAll('thead th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual(['Name', 'Email']);
  });

  it('renders one row per data item with accessor values', () => {
    const el = render(columns, [
      { name: 'Ada', email: 'ada@example.com' },
      { name: 'Linus', email: 'linus@example.com' },
    ]);
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.textContent).toContain('Ada');
    expect(el.textContent).toContain('linus@example.com');
  });

  it('renders no body rows for empty data', () => {
    const el = render(columns, []);
    expect(el.querySelectorAll('tbody tr').length).toBe(0);
  });
});

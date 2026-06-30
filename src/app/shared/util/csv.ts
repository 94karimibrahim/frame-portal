/**
 * Minimal, dependency-free CSV export. A column is a header plus a value accessor, so the exported shape
 * is decoupled from however the row renders on screen (formatted dates, resolved labels, etc.). Kept here
 * as a shared util so every list page exports the same way instead of each rolling its own.
 */
export interface CsvColumn<TRow> {
  /** Column heading in the output file's first row (already translated by the caller). */
  header: string;
  /** Extracts/formats the cell value for a row; nullish becomes an empty cell. */
  value: (row: TRow) => string | number | boolean | null | undefined;
}

/** UTF-8 byte-order mark — prepended so Excel reads non-ASCII (e.g. Arabic) as UTF-8, not mojibake. */
const UTF8_BOM = String.fromCharCode(0xfeff);

/** RFC-4180 field escaping: quote anything containing a comma, quote, or newline; double inner quotes. */
function escapeField(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Serialize rows to a CSV string (CRLF line endings, for the widest spreadsheet compatibility). */
export function toCsv<TRow>(rows: readonly TRow[], columns: readonly CsvColumn<TRow>[]): string {
  const header = columns.map((c) => escapeField(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => escapeField(c.value(row))).join(','));
  return [header, ...body].join('\r\n');
}

/**
 * Trigger a client-side download of `csv` as `filename`. Revokes the object URL once the click is
 * dispatched.
 */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([UTF8_BOM + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** A filename-friendly timestamp, `YYYY-MM-DD`, for naming exports. */
export function exportDateStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

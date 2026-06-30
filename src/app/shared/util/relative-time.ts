/**
 * Formats a date as a short relative phrase for recent days (Today / Yesterday / N days ago) and falls
 * back to a localized absolute date beyond {@link MAX_RELATIVE_DAYS}. Built on `Intl` so both the relative
 * phrasing and the absolute date localize (en/ar, RTL-safe) without hand-written strings. Day deltas are
 * computed on calendar boundaries — not raw elapsed time — so "yesterday" means the prior calendar day,
 * not "24h ago".
 */
const MAX_RELATIVE_DAYS = 30;

const startOfDay = (d: Date): number =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

export function relativeDate(value: string | Date, culture: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const days = Math.round((startOfDay(date) - startOfDay(new Date())) / 86_400_000);
  if (Math.abs(days) <= MAX_RELATIVE_DAYS) {
    return new Intl.RelativeTimeFormat(culture, { numeric: 'auto' }).format(days, 'day');
  }
  return date.toLocaleDateString(culture);
}

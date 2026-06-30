/**
 * Up to two uppercase initials for an avatar placeholder: first letters of the first and last words, or
 * the first two letters of a single word. Returns `?` for empty/whitespace input.
 */
export function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

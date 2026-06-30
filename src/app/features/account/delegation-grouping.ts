/** A permission module and the dotted codes under it, for grouping a flat code list in the picker. */
export interface CodeGroup {
  module: string;
  codes: string[];
}

/**
 * Groups dotted permission codes (`module.action`) by their module prefix, sorting modules and codes
 * alphabetically. Used by the delegation picker, which works from the caller's own effective codes (a
 * normal user may not be able to read the full permission catalogue).
 */
export function groupCodesByModule(codes: readonly string[]): CodeGroup[] {
  const byModule = new Map<string, string[]>();
  for (const code of codes) {
    const module = code.includes('.') ? code.slice(0, code.indexOf('.')) : code;
    const bucket = byModule.get(module);
    if (bucket) {
      bucket.push(code);
    } else {
      byModule.set(module, [code]);
    }
  }
  return [...byModule.entries()]
    .map(([module, list]) => ({ module, codes: [...list].sort((a, b) => a.localeCompare(b)) }))
    .sort((a, b) => a.module.localeCompare(b.module));
}

// Coverage regression gate.
//
// The `@angular/build:karma` builder ignores karma-coverage's `check` thresholds and only emits an HTML
// report plus an istanbul `text-summary` to the console (no lcov/json file). So we gate on that summary:
// pass the captured test output as argv[2] (or pipe it on stdin) and this fails if any global metric is
// below its floor. Thresholds sit just under current coverage (a ratchet against regression) and are
// measured over the files the specs load — Angular only instruments files reachable from a spec. Raise
// them as coverage grows; the security-critical core (auth, interceptors, token-store) is covered.
//
//   npm run test:coverage | node tools/check-coverage.mjs
//   node tools/check-coverage.mjs coverage-output.txt
import { readFileSync } from 'node:fs';

// Ratcheted 2026-07 after the users-page store extraction added 13 specs over the page's query/paging/
// mutation logic (measured ~65/66/57/59).
const THRESHOLDS = { Statements: 63, Lines: 64, Functions: 54, Branches: 56 };

const input = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : readFileSync(0, 'utf8'); // fd 0 = stdin

const failures = [];
let parsedAny = false;

for (const [metric, min] of Object.entries(THRESHOLDS)) {
  // Matches istanbul text-summary lines, e.g. "Lines        : 69.65% ( 404/580 )".
  const match = input.match(new RegExp(`${metric}\\s*:\\s*([\\d.]+)%`));
  if (!match) {
    continue;
  }
  parsedAny = true;
  const pct = parseFloat(match[1]);
  const ok = pct >= min;
  console.log(`${ok ? '✓' : '✖'} ${metric.padEnd(11)} ${pct.toFixed(2)}%  (min ${min}%)`);
  if (!ok) {
    failures.push(`${metric} ${pct.toFixed(2)}% < ${min}%`);
  }
}

if (!parsedAny) {
  console.error(
    '✖ No coverage summary found in the input.\n' +
      '  Run tests with coverage and feed the output in, e.g.:\n' +
      '  npm run test:coverage | node tools/check-coverage.mjs',
  );
  process.exit(1);
}

if (failures.length) {
  console.error(`\n✖ Coverage gate failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\n✓ Coverage gate passed.');

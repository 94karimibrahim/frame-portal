// Karma config. This box has no Chrome, but Edge is Chromium-based and works with
// karma-chrome-launcher when CHROME_BIN points at the Edge executable, e.g.:
//   $env:CHROME_BIN = (Get-Command msedge).Source ; npm run test:ci
// The ChromeHeadlessNoSandbox launcher adds the flags CI/headless environments need.
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular/build/plugins/karma'),
    ],
    reporters: ['progress', 'kjhtml'],
    browsers: ['Chrome'],
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      },
    },
    // Coverage is emitted only with `--code-coverage`. The builder writes an HTML report and prints an
    // istanbul text-summary to the console; the regression gate (tools/check-coverage.mjs, run in CI)
    // parses that summary, because `@angular/build:karma` honors neither karma-coverage's `check`
    // thresholds nor file reporters like lcov/json-summary.
    coverageReporter: {
      reporters: [{ type: 'html' }, { type: 'text-summary' }],
    },
    restartOnFileChange: true,
  });
};

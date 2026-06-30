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
    restartOnFileChange: true,
  });
};

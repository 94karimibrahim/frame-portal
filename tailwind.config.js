/**
 * Tailwind config — design tokens extracted from the TailAdmin Free design system.
 *
 * - `darkMode: 'class'` so the theme is toggled by adding/removing `dark` on <html>
 *   (driven by ThemeService), independent of OS preference.
 * - RTL is handled in components via Tailwind **logical properties** (ps-/pe-, ms-/me-,
 *   start-/end-) and the `rtl:`/`ltr:` variants; no separate RTL stylesheet.
 * - `content` globs are tight so production CSS is fully purged.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // TailAdmin brand scale.
        brand: {
          25: '#f2f7ff',
          50: '#ecf3ff',
          100: '#dde9ff',
          200: '#c2d6ff',
          300: '#9cb9ff',
          400: '#7592ff',
          500: '#465fff',
          600: '#3641f5',
          700: '#2a31d8',
          800: '#252dae',
          900: '#262e89',
          950: '#161950',
        },
        gray: {
          25: '#fcfcfd',
          50: '#f9fafb',
          100: '#f2f4f7',
          200: '#e4e7ec',
          300: '#d0d5dd',
          400: '#98a2b3',
          500: '#667085',
          600: '#475467',
          700: '#344054',
          800: '#1d2939',
          900: '#101828',
          950: '#0c111d',
          dark: '#1a2231',
        },
        success: {
          50: '#ecfdf3',
          100: '#d1fadf',
          500: '#12b76a',
          600: '#039855',
          700: '#027a48',
        },
        error: {
          50: '#fef3f2',
          100: '#fee4e2',
          500: '#f04438',
          600: '#d92d20',
          700: '#b42318',
        },
        warning: {
          50: '#fffaeb',
          100: '#fef0c7',
          500: '#f79009',
          600: '#dc6803',
          700: '#b54708',
        },
        // Informational accent — distinct from the primary brand so "info" reads as a status, not an action.
        info: {
          50: '#eff8ff',
          100: '#d1e9ff',
          500: '#2e90fa',
          600: '#1570ef',
          700: '#175cd3',
        },
      },
      fontFamily: {
        sans: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'theme-xs': ['0.75rem', { lineHeight: '1.125rem' }],
        'theme-sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'theme-md': ['1rem', { lineHeight: '1.5rem' }],
        'theme-lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'title-sm': ['1.25rem', { lineHeight: '1.75rem' }],
        'title-md': ['1.5rem', { lineHeight: '2rem' }],
        'title-lg': ['2.25rem', { lineHeight: '2.75rem' }],
      },
      boxShadow: {
        'theme-xs': '0 1px 2px 0 rgba(16, 24, 40, 0.05)',
        'theme-sm': '0 1px 3px 0 rgba(16, 24, 40, 0.1), 0 1px 2px -1px rgba(16, 24, 40, 0.1)',
        'theme-md': '0 4px 8px -2px rgba(16, 24, 40, 0.1), 0 2px 4px -2px rgba(16, 24, 40, 0.06)',
        'theme-lg': '0 12px 16px -4px rgba(16, 24, 40, 0.08), 0 4px 6px -2px rgba(16, 24, 40, 0.03)',
      },
      borderRadius: {
        'theme-sm': '0.375rem',
        'theme-md': '0.5rem',
        'theme-lg': '0.75rem',
      },
      zIndex: {
        99: '99',
        999: '999',
        9999: '9999',
        99999: '99999',
        999999: '999999',
      },
    },
  },
  plugins: [],
};

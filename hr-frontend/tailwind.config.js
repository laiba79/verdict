/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Neutral surfaces — deep slate-navy, warmer and less "corporate cobalt"
        ink: {
          950: '#0A1418',
          900: '#0E1B20',
          800: '#16262C',
          700: '#1F343B',
          600: '#2C4750',
        },
        // Primary — deep teal-slate, drawn from the Coastal Retreat / AWSM palettes
        primary: {
          50: '#EEF4F4',
          100: '#DCE9EA',
          400: '#5C8C89',
          500: '#335765',
          600: '#274652',
          700: '#1D363F',
        },
        // Secondary accent — warm clay, used sparingly (the one "risk" color)
        clay: {
          50: '#F7EFE9',
          400: '#9C6B4E',
          500: '#7F543D',
          600: '#663F2D',
        },
        // Decision states — the app's real vocabulary is approve/pending/reject
        approve: {
          50: '#EAFAF3',
          400: '#34C98C',
          500: '#1F9D6B',
          600: '#177D55',
        },
        pending: {
          50: '#FDF6E8',
          400: '#F0B23D',
          500: '#D98E1B',
          600: '#B1730F',
        },
        reject: {
          50: '#FCEDEF',
          400: '#F0637E',
          500: '#E0435C',
          600: '#B92F45',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(14, 27, 32, 0.04), 0 8px 24px -12px rgba(14, 27, 32, 0.12)',
        softer: '0 1px 2px rgba(14, 27, 32, 0.03)',
        glow: '0 0 0 1px rgba(92, 140, 137, 0.25), 0 12px 32px -8px rgba(51, 87, 101, 0.28)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        growBar: {
          '0%': { transform: 'scaleX(0)' },
          '100%': { transform: 'scaleX(1)' },
        },
        floatSlow: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '50%': { transform: 'translate(18px, -24px)' },
        },
        floatDrift: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%': { transform: 'translate(-22px, 16px) scale(1.05)' },
          '66%': { transform: 'translate(14px, 26px) scale(0.97)' },
        },
      },
      animation: {
        fadeUp: 'fadeUp 0.35s ease-out both',
        growBar: 'growBar 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
        floatSlow: 'floatSlow 9s ease-in-out infinite',
        floatSlower: 'floatSlow 13s ease-in-out infinite',
        floatDrift: 'floatDrift 17s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

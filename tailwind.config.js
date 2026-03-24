/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        body:    ['"DM Sans"', 'sans-serif'],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',   // primary purple
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
        surface: {
          0:   '#ffffff',
          50:  '#fafafa',
          100: '#f4f4f6',
          200: '#e8e8ed',
          300: '#d0d0db',
          400: '#9898aa',
          500: '#6b6b80',
          600: '#4f4f62',
          700: '#3a3a4a',
          800: '#252533',
          900: '#16161f',
          950: '#0c0c12',
        },
        accent: {
          amber:  '#f59e0b',
          green:  '#10b981',
          red:    '#ef4444',
          teal:   '#0d9488',
        }
      },
      boxShadow: {
        'card':       '0 1px 3px rgba(0,0,0,.05), 0 4px 16px rgba(0,0,0,.06)',
        'card-hover': '0 4px 8px rgba(0,0,0,.07), 0 12px 32px rgba(0,0,0,.10)',
        'modal':      '0 8px 30px rgba(0,0,0,.12), 0 32px 80px rgba(0,0,0,.08)',
        'glow':       '0 0 24px rgba(168,85,247,.18)',
      },
      borderRadius: { 'xl2': '1.25rem' },
      animation: {
        'fade-in':  'fadeIn .35s ease both',
        'slide-up': 'slideUp .4s cubic-bezier(.16,1,.3,1) both',
        'scale-in': 'scaleIn .25s cubic-bezier(.16,1,.3,1) both',
        'shimmer':  'shimmer 1.4s infinite linear',
      },
      keyframes: {
        fadeIn:  { from: { opacity: '0' },                                to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { from: { opacity: '0', transform: 'scale(.97)' },       to: { opacity: '1', transform: 'scale(1)' } },
        shimmer: { from: { backgroundPosition: '-200% 0' },               to:  { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
}

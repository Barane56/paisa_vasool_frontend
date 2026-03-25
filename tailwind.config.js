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
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },

        status: {
          success: '#059669',
          error:   '#dc2626',
          warning: '#d97706',
          info:    '#0ea5e9',
        },
        surface: {
          0:   '#ffffff',
          50:  '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#030712',
        }
      },
      boxShadow: {
        'card':       '0 1px 3px rgba(0,0,0,.05), 0 4px 16px rgba(0,0,0,.06)',
        'card-hover': '0 4px 8px rgba(0,0,0,.07), 0 12px 32px rgba(0,0,0,.10)',
        'modal':      '0 8px 30px rgba(0,0,0,.12), 0 32px 80px rgba(0,0,0,.08)',
        'glow':       '0 0 20px rgba(99,102,241,.20)',
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

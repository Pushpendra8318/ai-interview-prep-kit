import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-heading)', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f2f1fe',
          100: '#e6e4fd',
          200: '#cfcafb',
          300: '#aca3f7',
          400: '#8b7ef2',
          500: '#6d5aeb',
          600: '#5a3fdb',
          700: '#4b31bd',
          800: '#3d2999',
          900: '#33257c',
        },
        accent: {
          50: '#fdf2f8',
          100: '#fce7f3',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(24, 24, 60, 0.04), 0 8px 24px -8px rgba(24, 24, 60, 0.10)',
        card: '0 1px 3px rgba(24, 24, 60, 0.06), 0 1px 2px rgba(24, 24, 60, 0.04)',
        glow: '0 0 0 1px rgba(109, 90, 235, 0.08), 0 8px 30px -6px rgba(109, 90, 235, 0.35)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #6d5aeb 0%, #8b7ef2 50%, #ec4899 100%)',
        'brand-gradient-soft': 'linear-gradient(135deg, #f2f1fe 0%, #fdf2f8 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.35s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
};

export default config;

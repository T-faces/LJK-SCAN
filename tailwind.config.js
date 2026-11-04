/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
      colors: {
        ink: { 950: '#171347', 900: '#1E1A5C', 800: '#2A2475', 700: '#3B3496', 100: '#E7E5FA' },
        primary: { DEFAULT: '#5B4FD1', soft: '#ECEAFB', fg: '#FFFFFF' },
        sun: { DEFAULT: '#F2B134', soft: '#FFF3D6', ink: '#8A5A00' },
        sky: { DEFAULT: '#62CDE0', soft: '#DFF6FA', ink: '#0E6B7A' },
        rose: { DEFAULT: '#E8505B', soft: '#FDE6E8', ink: '#A3222C' },
        mint: { DEFAULT: '#4FBF8B', soft: '#DEF5EA', ink: '#17724B' },
        canvas: '#F3F2FF',
        peach: { DEFAULT: '#FFC984', soft: '#FFE2B8' },
      },
      borderRadius: { '4xl': '2rem' },
      boxShadow: {
        card: '0 1px 2px rgba(30,26,92,.04), 0 8px 24px -12px rgba(30,26,92,.12)',
        pop: '0 20px 50px -12px rgba(30,26,92,.35)',
      },
    },
  },
  plugins: [],
}

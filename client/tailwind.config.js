/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0D0F14',
        darkSurface: '#14161C',
        darkCard: '#1A1D24',
        gold: {
          DEFAULT: '#D4AF37',
          light: '#E5C158',
        },
        electric: {
          DEFAULT: '#3B82F6',
          dark: '#2563EB',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#006C49',
          light: '#10B981',
          dark: '#00422B',
          soft: '#D1FAE5'
        },
        forest: {
          DEFAULT: '#064E3B',
          mid: '#2B6954',
          light: '#306D58'
        },
        surface: {
          DEFAULT: '#F7F9FB',
          card: '#FFFFFF',
          muted: '#F2F4F6',
          border: '#E5E7EB'
        },
        agrio: {
          bg: '#F8FAF9',
          emerald: '#10B981',
          darkEmerald: '#006C49',
          forest: '#064E3B',
          amber: '#F59E0B',
          coral: '#EF4444',
          subtle: '#6C7A71'
        }
      },
      borderRadius: {
        '2xl': '20px',
        'xl': '16px',
        'lg': '12px'
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'soft-glow': '0 4px 20px -2px rgba(6, 78, 59, 0.06)',
        'lift': '0 12px 28px -4px rgba(6, 78, 59, 0.12)',
        'glass': '0 8px 32px 0 rgba(0, 66, 43, 0.08)'
      }
    },
  },
  plugins: [],
}

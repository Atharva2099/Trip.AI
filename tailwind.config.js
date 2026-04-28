/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      colors: {
        cream: {
          DEFAULT: '#F5F0E8',
          dark: '#EDE8DC',
        },
        ink: {
          DEFAULT: '#1A1208',
          light: '#6B5C4A',
          muted: '#B0A090',
        },
        terra: {
          DEFAULT: '#C9593A',
          light: '#D97B5F',
          dark: '#A8452A',
        },
        rule: '#D8D0C4',
      },
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '2rem',
          lg: '4rem',
          xl: '5rem',
          '2xl': '6rem',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#88a56f',
        'accent': '#8cb5a8',
        'secondary': '#a5c5ae',
        'dark': '#3a3f36',
        'bright': '#f4f4f4',
      },
    },
  },
  plugins: [],
}
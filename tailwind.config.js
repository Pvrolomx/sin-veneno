/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        'sv-black': '#0A0A0A',
        'sv-card': '#111111',
        'sv-green': '#22C55E',
        'sv-yellow': '#EAB308',
        'sv-red': '#EF4444',
        'sv-accent': '#16A34A',
      },
    },
  },
  plugins: [],
};

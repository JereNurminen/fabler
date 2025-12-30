/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2196f3',
        danger: '#F7567C',
        success: '#4caf50',
      },
    },
  },
  plugins: [],
}

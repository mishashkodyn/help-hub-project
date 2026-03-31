/** @type {import('tailwindcss').Config} */
module.exports = {  // <--- БУЛО export default, СТАЛО module.exports
  content: [
    "./src/index.html",
    "./src/**/*.{html,ts,js}"
  ],
  theme: {
    extend: {
      colors: {
        primary: "#002300", // Тепер bg-primary запрацює
        success: "#357904",
        mint: "#A6D3BC",
        sky: "#699BC9",
        blue: "#255CB8",
      }
    }
  },
  plugins: [],
}
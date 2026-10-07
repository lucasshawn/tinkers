/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        weeble: {
          pink: "#FF85A1",
          pinkLight: "#FFB3C6",
          pinkBg: "#FFF5F7",
          pinkWash: "#FFF0F5",
          blue: "#BCE7FD",
          yellow: "#FFF1A8",
          mint: "#C1F0DC",
          lilac: "#E6D7FF",
          text: "#4A2E35",
          textMuted: "#7A5C61",
        }
      },
      fontFamily: {
        bubble: ['"Fredoka"', 'cursive', 'sans-serif'],
        body: ['"Quicksand"', 'sans-serif'],
      },
      boxShadow: {
        'pillow': '0 8px 25px rgba(255, 133, 161, 0.18)',
        'pillow-hover': '0 12px 30px rgba(255, 133, 161, 0.28)',
      }
    },
  },
  plugins: [],
}

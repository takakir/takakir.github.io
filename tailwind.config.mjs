/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  theme: {
    extend: {
      colors: {
        indigo: {
          900: "#0d1729",
          800: "#16223d",
          700: "#1d2c4d",
          600: "#23365f",
        },
        gold: {
          DEFAULT: "#c8a24a",
          soft: "#e7c977",
          deep: "#a8842f",
        },
        paper: {
          DEFAULT: "#f7f3ea",
          2: "#efe8d9",
        },
        sumi: "#161616",
        vermilion: "#c1432c",
      },
      fontFamily: {
        serifjp: ['"Noto Serif JP"', "serif"],
        sansjp: ['"Noto Sans JP"', "system-ui", "sans-serif"],
        display: ['"Cormorant Garamond"', "serif"],
      },
      letterSpacing: {
        widest2: "0.42em",
      },
    },
  },
  plugins: [],
};

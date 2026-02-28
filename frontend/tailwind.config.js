import lineClamp from "@tailwindcss/line-clamp"

export default {
  darkMode: "class",

  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1280px",
      },
    },

    extend: {
      colors: {
        primary: "#22c55e",
      },

      boxShadow: {
        soft: "0 10px 25px rgba(0,0,0,0.1)",
      },

      borderRadius: {
        xl: "1rem",
      },
    },
  },

  plugins: [lineClamp],
}
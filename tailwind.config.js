/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
      },
      colors: {
        snobs: {
          green: "#22c55e",
          red: "#ef4444",
          amber: "#f59e0b",
          bg: "#fafafa",
          panel: "#ffffff",
          border: "#e5e7eb",
          text: "#111827",
          muted: "#6b7280",
        },
      },
    },
  },
  plugins: [],
};

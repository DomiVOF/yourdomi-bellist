/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        nunito: ["Nunito", "system-ui", "sans-serif"],
      },
      colors: {
        yd: {
          black: "#1A1A1A",
          red: "#E8231A",
          redHover: "#C41E17",
          bg: "#FAFAFA",
          border: "#EBEBEB",
          muted: "#888888",
        },
        score: {
          heet: "#FF6B35",
          interesse: "#22C55E",
          afgewezen: "#9CA3AF",
          terugbellen: "#3B82F6",
        },
      },
      borderRadius: {
        card: "16px",
        btn: "10px",
        input: "12px",
      },
      boxShadow: {
        card: "0 2px 8px rgba(0,0,0,0.06)",
        cardHover: "0 4px 20px rgba(0,0,0,0.1)",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
    },
  },
  plugins: [],
};

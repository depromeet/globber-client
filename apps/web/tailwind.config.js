/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}", "./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      keyframes: {
        "float-up": {
          "0%": {
            opacity: "0",
            transform: "translate(-50%, -50%) translateY(0) scale(0.5)",
          },
          "15%": {
            opacity: "1",
            transform: "translate(-50%, -50%) translateY(-10px) scale(1)",
          },
          "85%": {
            opacity: "1",
            transform: "translate(-50%, -50%) translateY(-120px) scale(1)",
          },
          "100%": {
            opacity: "0",
            transform: "translate(-50%, -50%) translateY(-140px) scale(0.8)",
          },
        },
        slideUp: {
          "0%": {
            opacity: "0",
            transform: "translate(-50%, 20px)",
          },
          "100%": {
            opacity: "1",
            transform: "translate(-50%, 0)",
          },
        },
        fadeOut: {
          "0%": {
            opacity: "1",
          },
          "100%": {
            opacity: "0",
          },
        },
      },
      animation: {
        "float-up": "float-up 2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards",
        slideUp: "slideUp 0.3s ease-out",
        fadeOut: "fadeOut 0.2s ease-in",
      },
    },
  },
  plugins: [
    ({ addUtilities }) => {
      addUtilities({
        ".scrollbar-hide": {
          "-ms-overflow-style": "none",
          "scrollbar-width": "none",
          "&::-webkit-scrollbar": {
            display: "none",
          },
        },
      });
    },
  ],
};

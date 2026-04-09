import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Courier New"', "Courier", "monospace"],
      },
      keyframes: {
        shake: {
          "0%, 100%": { transform: "translateX(0)" },
          "15%":       { transform: "translateX(-6px)" },
          "30%":       { transform: "translateX(6px)" },
          "45%":       { transform: "translateX(-4px)" },
          "60%":       { transform: "translateX(4px)" },
          "75%":       { transform: "translateX(-2px)" },
          "90%":       { transform: "translateX(2px)" },
        },
        fadeSlideDown: {
          from: { opacity: "0", transform: "translateY(-8px) translateX(-50%)" },
          to:   { opacity: "1", transform: "translateY(0)    translateX(-50%)" },
        },
      },
      animation: {
        shake: "shake 0.45s ease-in-out",
        fadeSlideDown: "fadeSlideDown 0.25s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;

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
        // Chip pops into the staging area with a spring bounce
        chipPop: {
          "0%":   { transform: "scale(0.5) translateY(8px)", opacity: "0" },
          "55%":  { transform: "scale(1.18) translateY(-2px)", opacity: "1" },
          "75%":  { transform: "scale(0.93) translateY(0)" },
          "90%":  { transform: "scale(1.04) translateY(0)" },
          "100%": { transform: "scale(1) translateY(0)", opacity: "1" },
        },
        // Tile jumps upward when selected (no scale — avoids grid recalc bug)
        tileJump: {
          "0%":   { transform: "translateY(0)" },
          "30%":  { transform: "translateY(-8px)" },
          "55%":  { transform: "translateY(-4px)" },
          "75%":  { transform: "translateY(-1px)" },
          "100%": { transform: "translateY(0)" },
        },
      },
      animation: {
        shake: "shake 0.45s ease-in-out",
        fadeSlideDown: "fadeSlideDown 0.25s ease-out",
        "chip-pop":  "chipPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        "tile-jump": "tileJump 0.28s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;

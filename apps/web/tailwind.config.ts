import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        uzeed: {
          950: "#05050a",
          900: "#0b0b14",
          800: "#121224"
        }
      }
    }
  },
  plugins: []
} satisfies Config;

import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        uzeed: {
          950: "#05050a",
          900: "#0b0b14",
          800: "#121224",
          700: "#1a1a2e"
        },
        studio: {
          bg: "#0e0e12"
        }
      },
      boxShadow: {
        "studio-card":
          "0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.3)",
        "studio-glow": "0 0 80px 20px rgba(139,92,246,0.08)"
      },
      keyframes: {
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" }
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        floatUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "slide-in-right": "slideInRight 300ms ease-out",
        "fade-in": "fadeIn 200ms ease-out",
        "float-up": "floatUp 300ms cubic-bezier(0.16,1,0.3,1)"
      }
    }
  },
  plugins: []
} satisfies Config;

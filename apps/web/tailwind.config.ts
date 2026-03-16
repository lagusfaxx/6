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
        "studio-glow": "0 0 80px 20px rgba(139,92,246,0.08)",
        "card-hover": "0 20px 60px -12px rgba(168,85,247,0.25), 0 8px 24px -8px rgba(0,0,0,0.4)",
        "card-premium": "0 0 0 1px rgba(168,85,247,0.15), 0 24px 48px -12px rgba(168,85,247,0.2), 0 0 80px rgba(168,85,247,0.06)",
        "card-gold": "0 0 0 1px rgba(251,191,36,0.2), 0 24px 48px -12px rgba(251,191,36,0.15), 0 0 60px rgba(251,191,36,0.05)",
        "card-diamond": "0 0 0 1px rgba(56,189,248,0.2), 0 24px 48px -12px rgba(56,189,248,0.15), 0 0 60px rgba(56,189,248,0.05)",
        "glow-fuchsia": "0 0 20px rgba(232,121,249,0.3), 0 0 60px rgba(168,85,247,0.1)",
        "glow-emerald": "0 0 12px rgba(52,211,153,0.4), 0 0 40px rgba(16,185,129,0.1)",
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
        },
        heroGradientDrift: {
          "0%, 100%": { transform: "translate(-50%, -50%) scale(1)" },
          "33%": { transform: "translate(-48%, -52%) scale(1.03)" },
          "66%": { transform: "translate(-52%, -48%) scale(0.97)" }
        },
        btnGlow: {
          "0%, 100%": { boxShadow: "0 12px 40px rgba(168,85,247,0.25)" },
          "50%": { boxShadow: "0 12px 50px rgba(168,85,247,0.4)" }
        },
        shimmer: {
          "0%": { transform: "translateX(-100%) rotate(12deg)" },
          "100%": { transform: "translateX(100%) rotate(12deg)" }
        },
        cardReveal: {
          "0%": { opacity: "0", transform: "translateY(24px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" }
        },
        pulseGlow: {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "0.8", transform: "scale(1.05)" }
        },
        borderGlow: {
          "0%, 100%": { borderColor: "rgba(168,85,247,0.15)" },
          "50%": { borderColor: "rgba(168,85,247,0.35)" }
        },
        slideUp: {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" }
        },
        scaleIn: {
          "0%": { transform: "scale(0.9)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" }
        },
        breathe: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" }
        },
      },
      animation: {
        "slide-in-right": "slideInRight 300ms ease-out",
        "fade-in": "fadeIn 200ms ease-out",
        "float-up": "floatUp 300ms cubic-bezier(0.16,1,0.3,1)",
        "hero-drift": "heroGradientDrift 25s ease-in-out infinite",
        "btn-glow": "btnGlow 4s ease-in-out infinite",
        "shimmer": "shimmer 2s ease-in-out infinite",
        "card-reveal": "cardReveal 500ms cubic-bezier(0.16,1,0.3,1)",
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
        "border-glow": "borderGlow 3s ease-in-out infinite",
        "slide-up": "slideUp 400ms cubic-bezier(0.16,1,0.3,1)",
        "scale-in": "scaleIn 300ms cubic-bezier(0.16,1,0.3,1)",
        "breathe": "breathe 3s ease-in-out infinite",
      },
      transitionDuration: {
        "400": "400ms",
        "600": "600ms",
      },
      backdropBlur: {
        "3xl": "64px",
      },
    }
  },
  plugins: []
} satisfies Config;

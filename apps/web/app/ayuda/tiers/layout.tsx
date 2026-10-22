import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ayuda: Tiers y planes",
  description: "Qué son Silver, Gold y Diamond en UZEED y qué incluye cada plan.",
  alternates: { canonical: "/ayuda/tiers" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ayuda: Tokens",
  description: "Qué son los tokens de UZEED, cuánto valen, cómo conseguirlos y en qué usarlos.",
  alternates: { canonical: "/ayuda/tokens" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

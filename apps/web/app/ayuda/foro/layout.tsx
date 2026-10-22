import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ayuda: Foro",
  description: "Cómo participar en el foro de UZEED: temas, respuestas y normas.",
  alternates: { canonical: "/ayuda/foro" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

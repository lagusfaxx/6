import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ayuda: Seguridad",
  description: "Consejos de seguridad para usar UZEED y cómo reportar perfiles o contenido.",
  alternates: { canonical: "/ayuda/seguridad" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

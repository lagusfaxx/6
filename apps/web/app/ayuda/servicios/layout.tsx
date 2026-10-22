import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ayuda: Servicios y directorio",
  description: "Cómo buscar perfiles en UZEED, usar los filtros y contactar a un perfil.",
  alternates: { canonical: "/ayuda/servicios" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

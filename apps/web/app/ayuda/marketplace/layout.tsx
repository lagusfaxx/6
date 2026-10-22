import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ayuda: Contenido y packs",
  description: "Cómo comprar packs de fotos y videos en UZEED y cómo funciona el pago protegido.",
  alternates: { canonical: "/ayuda/marketplace" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

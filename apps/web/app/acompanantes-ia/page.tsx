import type { Metadata } from "next";
import CatalogClient from "./CatalogClient";

export const metadata: Metadata = {
  title: "Acompañantes virtuales con IA",
  description:
    "Conversa con acompañantes virtuales creados con inteligencia artificial: personajes ficticios y adultos con personalidad, memoria e imágenes personalizadas.",
  alternates: { canonical: "/acompanantes-ia" },
  robots: { index: true, follow: true },
};

export default function AcompanantesIaPage() {
  return <CatalogClient />;
}

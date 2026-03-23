import { Suspense } from "react";
import type { Metadata } from "next";
import DirectoryPage from "../../components/DirectoryPage";

export const metadata: Metadata = {
  title: "Escorts y Putas en Chile - Perfiles Verificados Hoy",
  description:
    "Directorio de escorts y putas en Chile. Miles de perfiles verificados en Santiago, Las Condes, Providencia y Viña del Mar. Fotos reales, disponibilidad inmediata y contacto directo en UZEED.",
  keywords: [
    "escorts chile", "putas chile", "escorts santiago", "putas santiago",
    "acompañantes santiago", "escorts verificadas", "escorts las condes",
    "escorts providencia", "escorts viña del mar", "escorts disponibles hoy",
  ],
  alternates: { canonical: "/escorts" },
  openGraph: {
    title: "Escorts y Putas en Chile - Perfiles Verificados | UZEED",
    description:
      "Miles de escorts y putas verificadas en Santiago y todo Chile. Fotos reales y contacto directo.",
    url: "https://uzeed.cl/escorts",
    type: "website",
  },
};

export default function EscortsPage() {
  return (
    <Suspense>
      <DirectoryPage
        key="escort"
        entityType="professional"
        categorySlug="escort"
        title="Escorts"
      />
    </Suspense>
  );
}

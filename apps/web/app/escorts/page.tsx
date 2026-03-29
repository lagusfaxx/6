import { Suspense } from "react";
import type { Metadata } from "next";
import DirectoryPage from "../../components/DirectoryPage";
import SeoContent from "../../components/SeoContent";

export const metadata: Metadata = {
  title: "Escorts y Putas en Chile - Perfiles Verificados Hoy | UZEED",
  description:
    "Directorio N°1 de escorts y putas en Chile. Miles de perfiles verificados en Santiago, Las Condes, Providencia y Viña del Mar. Fotos reales, disponibilidad inmediata y contacto directo por WhatsApp en UZEED.",
  keywords: [
    "escorts chile", "putas chile", "escorts santiago", "putas santiago",
    "acompañantes santiago", "escorts verificadas", "escorts las condes",
    "escorts providencia", "escorts viña del mar", "escorts disponibles hoy",
    "putas las condes", "escorts colombianas chile", "escorts venezolanas chile",
    "putas verificadas santiago", "escorts cerca de mi",
  ],
  alternates: { canonical: "/escorts" },
  openGraph: {
    title: "Escorts y Putas en Chile - Perfiles Verificados | UZEED",
    description:
      "Miles de escorts y putas verificadas en Santiago y todo Chile. Fotos reales y contacto directo por WhatsApp.",
    url: "https://uzeed.cl/escorts",
    type: "website",
    images: [{ url: "https://uzeed.cl/brand/isotipo-new.png", width: 720, height: 720, alt: "UZEED Escorts Chile" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Escorts y Putas en Chile | UZEED",
    description: "Miles de escorts verificadas con fotos reales en Santiago y todo Chile.",
    images: ["https://uzeed.cl/brand/isotipo-new.png"],
  },
};

export default function EscortsPage() {
  return (
    <>
      <Suspense>
        <DirectoryPage
          key="escort"
          entityType="professional"
          categorySlug="escort"
          title="Escorts"
        />
      </Suspense>
      <SeoContent variant="escorts" />
    </>
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";
import DirectoryPage from "../../components/DirectoryPage";
import SeoContent from "../../components/SeoContent";

export const metadata: Metadata = {
  title: "Moteles y Hoteles por Hora en Chile | UZEED",
  description:
    "Encuentra los mejores moteles y hoteles por hora en Santiago, Las Condes y Viña del Mar. Precios, fotos reales y disponibilidad inmediata en UZEED.",
  keywords: ["moteles chile", "moteles santiago", "hoteles por hora santiago", "moteles las condes"],
  alternates: { canonical: "/moteles" },
  openGraph: {
    title: "Moteles y Hoteles por Hora en Chile | UZEED",
    description: "Los mejores moteles y hoteles por hora en Santiago y todo Chile. Precios y disponibilidad.",
    url: "/moteles",
    type: "website",
    images: [{ url: "/brand/isotipo-new.png", width: 720, height: 720, alt: "UZEED Moteles Chile" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Moteles y Hoteles por Hora en Chile | UZEED",
    description: "Los mejores moteles y hoteles por hora en Santiago y todo Chile.",
    images: ["/brand/isotipo-new.png"],
  },
};

export default function MotelPage() {
  return (
    <>
      <Suspense>
        <DirectoryPage
          key="motel"
          entityType="establishment"
          categorySlug="motel"
          title="Moteles y Hoteles"
        />
      </Suspense>
      <SeoContent variant="moteles" />
    </>
  );
}

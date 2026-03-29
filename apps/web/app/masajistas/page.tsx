import { Suspense } from "react";
import type { Metadata } from "next";
import DirectoryPage from "../../components/DirectoryPage";
import SeoContent from "../../components/SeoContent";

export const metadata: Metadata = {
  title: "Masajistas Eróticas en Chile - Masajes Sensuales | UZEED",
  description:
    "Encuentra masajistas eróticas y sensuales en Santiago, Las Condes y Viña del Mar. Masajes tántricos, nuru y relajantes con profesionales verificadas en UZEED.",
  keywords: ["masajistas chile", "masajes eróticos santiago", "masajistas sensuales", "masaje tántrico chile", "masajistas las condes", "masaje nuru santiago"],
  alternates: { canonical: "/masajistas" },
  openGraph: {
    title: "Masajistas Eróticas en Chile | UZEED",
    description: "Masajistas eróticas verificadas en Santiago y todo Chile. Masajes tántricos, nuru y sensuales.",
    url: "https://uzeed.cl/masajistas",
    type: "website",
    images: [{ url: "https://uzeed.cl/brand/isotipo-new.png", width: 720, height: 720, alt: "UZEED Masajistas Chile" }],
  },
};

export default function MasajistasPage() {
  return (
    <>
      <Suspense>
        <DirectoryPage
          key="masajes"
          entityType="professional"
          categorySlug="masajes"
          title="Masajistas"
        />
      </Suspense>
      <SeoContent variant="masajistas" />
    </>
  );
}

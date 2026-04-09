import { Suspense } from "react";
import type { Metadata } from "next";
import CreadorasDirectory from "../../components/CreadorasDirectory";

export const metadata: Metadata = {
  title: "Creadoras de Contenido Exclusivo en Chile | UZEED",
  description:
    "Descubre creadoras de contenido exclusivo en Chile. Fotos, videos, lives y videollamadas privadas. Contenido premium verificado en UZEED.",
  alternates: { canonical: "/creadoras" },
  openGraph: {
    title: "Creadoras de Contenido Exclusivo en Chile | UZEED",
    description:
      "Contenido exclusivo de las mejores creadoras en Chile. Fotos, videos y más.",
    url: "https://uzeed.cl/creadoras",
    type: "website",
    images: [
      {
        url: "https://uzeed.cl/brand/isotipo-new.png",
        width: 720,
        height: 720,
        alt: "UZEED Creadoras de Contenido",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Creadoras de Contenido en Chile | UZEED",
    description:
      "Contenido exclusivo de creadoras verificadas en Chile.",
  },
};

export default function CreadorasPage() {
  return (
    <Suspense>
      <CreadorasDirectory />
    </Suspense>
  );
}

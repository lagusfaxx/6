import { Suspense } from "react";
import type { Metadata } from "next";
import EstablishmentsClient from "./EstablishmentsClient";
import SeoContent from "../../components/SeoContent";

export const metadata: Metadata = {
  title: "Establecimientos para Adultos en Chile | UZEED",
  description:
    "Encuentra establecimientos para adultos en Santiago y todo Chile. Moteles, saunas, cabarets y más con fotos y ubicación en UZEED.",
  alternates: { canonical: "/establecimientos" },
  openGraph: {
    title: "Establecimientos para Adultos en Chile | UZEED",
    description: "Establecimientos para adultos en Santiago y todo Chile. Moteles, saunas y más.",
    url: "/establecimientos",
    type: "website",
    images: [{ url: "/brand/isotipo-new.png", width: 720, height: 720, alt: "UZEED Establecimientos" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Establecimientos para Adultos en Chile | UZEED",
    description: "Moteles, saunas y más en Santiago y todo Chile.",
    images: ["/brand/isotipo-new.png"],
  },
};

export default function EstablishmentsPage() {
  return (
    <>
      <Suspense fallback={<div className="text-white/60">Cargando establecimientos...</div>}>
        <EstablishmentsClient />
      </Suspense>
      <SeoContent variant="establecimientos" />
    </>
  );
}

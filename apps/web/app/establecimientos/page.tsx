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
    url: "https://uzeed.cl/establecimientos",
    type: "website",
    images: [{ url: "https://uzeed.cl/brand/isotipo-new.png", width: 720, height: 720, alt: "UZEED Establecimientos" }],
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

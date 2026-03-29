import { Suspense } from "react";
import type { Metadata } from "next";
import ProfessionalsClient from "./ProfessionalsClient";
import SeoContent from "../../components/SeoContent";

export const metadata: Metadata = {
  title: "Profesionales y Acompañantes en Chile | UZEED",
  description:
    "Directorio de profesionales y acompañantes en Chile. Perfiles verificados con fotos reales y disponibilidad inmediata en UZEED.",
  alternates: { canonical: "/profesionales" },
  openGraph: {
    title: "Profesionales y Acompañantes en Chile | UZEED",
    description: "Profesionales y acompañantes verificadas en Santiago y todo Chile.",
    url: "https://uzeed.cl/profesionales",
    type: "website",
    images: [{ url: "https://uzeed.cl/brand/isotipo-new.png", width: 720, height: 720, alt: "UZEED Profesionales" }],
  },
};

export default function ProfessionalsPage() {
  return (
    <>
      <Suspense fallback={<div className="text-white/60">Cargando profesionales...</div>}>
        <ProfessionalsClient />
      </Suspense>
      <SeoContent variant="profesionales" />
    </>
  );
}

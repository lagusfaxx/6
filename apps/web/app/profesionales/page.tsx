import { Suspense } from "react";
import type { Metadata } from "next";
import ProfessionalsClient from "./ProfessionalsClient";

export const metadata: Metadata = {
  title: "Profesionales y Acompañantes en Chile",
  description:
    "Directorio de profesionales y acompañantes en Chile. Perfiles verificados con fotos reales y disponibilidad inmediata en UZEED.",
  alternates: { canonical: "/profesionales" },
  openGraph: {
    title: "Profesionales y Acompañantes en Chile | UZEED",
    description: "Profesionales y acompañantes verificadas en Santiago y todo Chile.",
    url: "https://uzeed.cl/profesionales",
    type: "website",
  },
};

export default function ProfessionalsPage() {
  return (
    <Suspense fallback={<div className="text-white/60">Cargando profesionales...</div>}>
      <ProfessionalsClient />
    </Suspense>
  );
}

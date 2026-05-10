import { Suspense } from "react";
import type { Metadata } from "next";
import ServicesClient from "./ServicesClient";

export const metadata: Metadata = {
  title: "Explorar Servicios y Perfiles para Adultos en Chile | UZEED",
  description:
    "Explora escorts, masajistas, moteles y sex shops verificados en Santiago, Las Condes, Viña del Mar y todo Chile. Filtra por ubicación, disponibilidad y categoría.",
  keywords: [
    "servicios para adultos chile",
    "escorts chile",
    "masajistas chile",
    "moteles chile",
    "sex shop chile",
    "directorio adultos santiago",
  ],
  alternates: { canonical: "/services" },
  openGraph: {
    title: "Explorar Servicios y Perfiles para Adultos en Chile | UZEED",
    description:
      "Escorts, masajistas, moteles y sex shops verificados en todo Chile. Filtra por ubicación y disponibilidad.",
    url: "/services",
    type: "website",
    images: [
      {
        url: "/brand/isotipo-new.png",
        width: 720,
        height: 720,
        alt: "UZEED - Servicios verificados en Chile",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Explorar Servicios y Perfiles para Adultos en Chile | UZEED",
    description:
      "Escorts, masajistas, moteles y sex shops verificados en todo Chile.",
    images: ["/brand/isotipo-new.png"],
  },
};

export default function ServicesPage() {
  return (
    <Suspense fallback={<div className="text-white/60">Cargando servicios...</div>}>
      <ServicesClient />
    </Suspense>
  );
}

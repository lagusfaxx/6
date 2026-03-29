import type { Metadata } from "next";
import LodgingClient from "./LodgingClient";
import SeoContent from "../../components/SeoContent";

export const metadata: Metadata = {
  title: "Hospedajes y Alojamientos en Chile | UZEED",
  description:
    "Encuentra hospedajes, cabañas y alojamientos discretos en Santiago y todo Chile. Precios, fotos reales y disponibilidad en UZEED.",
  alternates: { canonical: "/hospedaje" },
  openGraph: {
    title: "Hospedajes y Alojamientos en Chile | UZEED",
    description: "Hospedajes y alojamientos discretos en Santiago y todo Chile.",
    url: "https://uzeed.cl/hospedaje",
    type: "website",
    images: [{ url: "https://uzeed.cl/brand/isotipo-new.png", width: 720, height: 720, alt: "UZEED Hospedajes" }],
  },
};

export default function HospedajePage() {
  return (
    <>
      <LodgingClient />
      <SeoContent variant="hospedaje" />
    </>
  );
}

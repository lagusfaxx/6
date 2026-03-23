import type { Metadata } from "next";
import LodgingClient from "./LodgingClient";

export const metadata: Metadata = {
  title: "Hospedajes y Alojamientos en Chile",
  description:
    "Encuentra hospedajes, cabañas y alojamientos discretos en Santiago y todo Chile. Precios, fotos reales y disponibilidad en UZEED.",
  alternates: { canonical: "/hospedaje" },
  openGraph: {
    title: "Hospedajes y Alojamientos en Chile | UZEED",
    description: "Hospedajes y alojamientos discretos en Santiago y todo Chile.",
    url: "https://uzeed.cl/hospedaje",
    type: "website",
  },
};

export default function HospedajePage() {
  return <LodgingClient />;
}

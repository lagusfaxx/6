import type { Metadata } from "next";
import MotelLandingView from "../../components/motels/MotelLandingView";
import { fetchMotelDirectory } from "../../lib/motels";

/* El directorio se regenera cada 5 minutos: Google recibe HTML con los moteles. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Moteles en Santiago y Chile: precios, fotos y reservas",
  description:
    "Directorio de moteles en Santiago y todo Chile: fotos reales, tarifas por 3 horas, 6 horas y noche, moteles con jacuzzi y estacionamiento privado. Reserva por chat en UZEED.",
  keywords: ["moteles santiago", "moteles en santiago", "moteles chile", "hoteles por hora santiago", "motel con jacuzzi santiago"],
  alternates: { canonical: "/moteles" },
  openGraph: {
    title: "Moteles en Santiago y Chile | UZEED",
    description: "Fotos, tarifas y reservas de moteles en Santiago y todo Chile.",
    url: "https://uzeed.cl/moteles",
    type: "website",
    images: [{ url: "https://uzeed.cl/brand/isotipo-new.png", width: 720, height: 720, alt: "Moteles en UZEED" }],
  },
};

export default async function MotelesPage() {
  const all = await fetchMotelDirectory();
  return <MotelLandingView all={all} comuna={null} motels={all} />;
}

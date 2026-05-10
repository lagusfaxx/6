import { Suspense } from "react";
import type { Metadata } from "next";
import PublicateClient from "./PublicateClient";

export const metadata: Metadata = {
  title: "Publícate en UZEED — Crea tu perfil profesional en 2 minutos",
  description:
    "Publica tu perfil profesional en UZEED Chile en menos de 2 minutos: sin registro previo, gratis, y con visibilidad inmediata para clientes en Santiago y todo Chile.",
  alternates: { canonical: "/publicate" },
  openGraph: {
    title: "Publícate en UZEED — Crea tu perfil profesional",
    description:
      "Publica tu perfil profesional en UZEED Chile gratis, sin registro previo y con visibilidad inmediata.",
    url: "/publicate",
    type: "website",
    images: [
      {
        url: "/brand/isotipo-new.png",
        width: 720,
        height: 720,
        alt: "Publícate en UZEED",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Publícate en UZEED — Crea tu perfil profesional",
    description: "Publica tu perfil en UZEED Chile gratis y en minutos.",
    images: ["/brand/isotipo-new.png"],
  },
};

export default function PublicatePage() {
  return (
    <Suspense
      fallback={
        <div className="card p-8 text-white/60">Cargando...</div>
      }
    >
      <PublicateClient />
    </Suspense>
  );
}

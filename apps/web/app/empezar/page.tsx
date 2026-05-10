import { Suspense } from "react";
import type { Metadata } from "next";
import EmpezarClient from "./EmpezarClient";

export const metadata: Metadata = {
  title: "Empieza en UZEED — Registro o publicación rápida",
  description:
    "Empieza en UZEED Chile: regístrate como cliente o profesional, o publica tu perfil rápido sin registro previo. Elige el camino que prefieras.",
  alternates: { canonical: "/empezar" },
  openGraph: {
    title: "Empieza en UZEED — Registro o publicación rápida",
    description:
      "Regístrate como cliente o profesional, o publica tu perfil rápido en UZEED Chile.",
    url: "/empezar",
    type: "website",
    images: [
      {
        url: "/brand/isotipo-new.png",
        width: 720,
        height: 720,
        alt: "Empieza en UZEED",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Empieza en UZEED",
    description: "Regístrate o publica tu perfil rápido en UZEED Chile.",
    images: ["/brand/isotipo-new.png"],
  },
};

export default function EmpezarPage() {
  return (
    <Suspense
      fallback={
        <div className="card p-8 text-white/60">Cargando...</div>
      }
    >
      <EmpezarClient />
    </Suspense>
  );
}

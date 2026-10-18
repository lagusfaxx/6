import type { Metadata } from "next";
import ContenidoClient from "./ContenidoClient";

/*
 * Creadoras de contenido: profesionales que venden fotos y videos. Las que
 * sólo venden contenido no salen en el inicio ni en escorts (no atienden),
 * así el cliente que busca escort no le escribe a quien no lo es. Las que
 * hacen las dos cosas aparecen en ambos lados.
 */
export const metadata: Metadata = {
  title: "Creadoras de Contenido en Chile - Fotos y Videos",
  description:
    "Creadoras de contenido verificadas en Chile. Compra fotos, videos y packs exclusivos directo a la creadora en UZEED.",
  keywords: ["creadoras de contenido chile", "packs chile", "vender contenido", "contenido exclusivo", "fotos y videos"],
  alternates: { canonical: "/contenido" },
  openGraph: {
    title: "Creadoras de Contenido en Chile | UZEED",
    description: "Creadoras de contenido verificadas en Chile: fotos, videos y packs exclusivos.",
    url: "https://uzeed.cl/contenido",
    type: "website",
    images: [{ url: "https://uzeed.cl/brand/isotipo-new.png", width: 720, height: 720, alt: "UZEED Creadoras de contenido" }],
  },
};

export default function ContenidoPage() {
  return <ContenidoClient />;
}

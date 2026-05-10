import type { Metadata } from "next";
import ForumClient from "./ForumClient";

export const metadata: Metadata = {
  title: "Foro UZEED - Comunidad de Adultos en Chile",
  description:
    "Participa en el foro UZEED: opiniones, recomendaciones y experiencias sobre escorts, moteles y servicios para adultos en Chile. Comunidad anónima y respetuosa.",
  keywords: [
    "foro adultos chile",
    "foro escorts chile",
    "comunidad adultos chile",
    "opiniones escorts santiago",
  ],
  alternates: { canonical: "/foro" },
  openGraph: {
    title: "Foro UZEED - Comunidad de Adultos en Chile",
    description:
      "Opiniones, recomendaciones y experiencias en la comunidad UZEED Chile.",
    url: "/foro",
    type: "website",
    images: [
      {
        url: "/brand/isotipo-new.png",
        width: 720,
        height: 720,
        alt: "UZEED Foro - Comunidad",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Foro UZEED - Comunidad de Adultos en Chile",
    description:
      "Opiniones, recomendaciones y experiencias en la comunidad UZEED Chile.",
    images: ["/brand/isotipo-new.png"],
  },
};

export default function ForumPage() {
  return <ForumClient />;
}

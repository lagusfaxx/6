import type { Metadata } from "next";
import PremiumClient from "./PremiumClient";

export const metadata: Metadata = {
  title: "Escorts Premium en Chile - Perfiles Exclusivos | UZEED",
  description:
    "Descubre escorts y acompañantes Premium en UZEED: perfiles exclusivos seleccionados, fotos reales y disponibilidad verificada en Santiago y todo Chile.",
  keywords: [
    "escorts premium chile",
    "escorts vip santiago",
    "acompañantes premium chile",
    "escorts exclusivas santiago",
  ],
  alternates: { canonical: "/premium" },
  openGraph: {
    title: "Escorts Premium en Chile - Perfiles Exclusivos | UZEED",
    description:
      "Perfiles Premium seleccionados con fotos reales y disponibilidad verificada en todo Chile.",
    url: "/premium",
    type: "website",
    images: [
      {
        url: "/brand/isotipo-new.png",
        width: 720,
        height: 720,
        alt: "UZEED Premium - Escorts exclusivas",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Escorts Premium en Chile | UZEED",
    description: "Perfiles Premium exclusivos en Santiago y todo Chile.",
    images: ["/brand/isotipo-new.png"],
  },
};

export default function PremiumPage() {
  return <PremiumClient />;
}

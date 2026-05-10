import { Suspense } from "react";
import type { Metadata } from "next";
import DirectoryPage from "../../components/DirectoryPage";
import SeoContent from "../../components/SeoContent";

export const metadata: Metadata = {
  title: "Sex Shop en Chile - Juguetes y Accesorios para Adultos | UZEED",
  description:
    "Compra juguetes sexuales, lencería y accesorios para adultos en Chile. Envío discreto y precios accesibles en UZEED.",
  keywords: ["sexshop chile", "sex shop santiago", "juguetes sexuales chile", "tienda erótica chile"],
  alternates: { canonical: "/sexshop" },
  openGraph: {
    title: "Sex Shop en Chile | UZEED",
    description: "Juguetes sexuales, lencería y accesorios para adultos con envío discreto.",
    url: "/sexshop",
    type: "website",
    images: [{ url: "/brand/isotipo-new.png", width: 720, height: 720, alt: "UZEED Sex Shop" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sex Shop en Chile | UZEED",
    description: "Juguetes sexuales, lencería y accesorios con envío discreto.",
    images: ["/brand/isotipo-new.png"],
  },
};

export default function SexShopPage() {
  return (
    <>
      <Suspense>
        <DirectoryPage
          key="sexshop"
          entityType="shop"
          categorySlug="sexshop"
          title="Sex Shop"
        />
      </Suspense>
      <SeoContent variant="sexshop" />
    </>
  );
}

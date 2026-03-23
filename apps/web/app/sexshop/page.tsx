import { Suspense } from "react";
import type { Metadata } from "next";
import DirectoryPage from "../../components/DirectoryPage";

export const metadata: Metadata = {
  title: "Sex Shop en Chile - Juguetes y Accesorios para Adultos",
  description:
    "Compra juguetes sexuales, lencería y accesorios para adultos en Chile. Envío discreto y precios accesibles en UZEED.",
  keywords: ["sexshop chile", "sex shop santiago", "juguetes sexuales chile", "tienda erótica chile"],
  alternates: { canonical: "/sexshop" },
  openGraph: {
    title: "Sex Shop en Chile | UZEED",
    description: "Juguetes sexuales, lencería y accesorios para adultos con envío discreto.",
    url: "https://uzeed.cl/sexshop",
    type: "website",
  },
};

export default function SexShopPage() {
  return (
    <Suspense>
      <DirectoryPage
        key="sexshop"
        entityType="shop"
        categorySlug="sexshop"
        title="Sex Shop"
      />
    </Suspense>
  );
}

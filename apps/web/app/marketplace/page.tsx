import type { Metadata } from "next";
import { Suspense } from "react";
import MarketplaceClient from "./MarketplaceClient";

export const metadata: Metadata = {
  title: "Marketplace UZEED — compra directo a la profesional",
  description:
    "Packs de fotos, videos, ropa y artículos personales vendidos directamente por profesionales verificadas de UZEED. Pago protegido y entrega dentro de la plataforma.",
};

export default function MarketplacePage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-white/60">Cargando marketplace...</div>}>
      <MarketplaceClient />
    </Suspense>
  );
}

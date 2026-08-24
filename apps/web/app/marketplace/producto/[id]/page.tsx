import { Suspense } from "react";
import ProductClient from "./ProductClient";

export default function MarketProductPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-white/60">Cargando artículo...</div>}>
      <ProductClient productId={params.id} />
    </Suspense>
  );
}

import { Suspense } from "react";
import SellerOrderClient from "./SellerOrderClient";

export default function SellerOrderPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-white/60">Cargando pedido...</div>}>
      <SellerOrderClient orderId={params.id} />
    </Suspense>
  );
}

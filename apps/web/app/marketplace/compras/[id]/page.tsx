import { Suspense } from "react";
import PurchaseDetailClient from "./PurchaseDetailClient";

export default function PurchaseDetailPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-white/60">Cargando pedido...</div>}>
      <PurchaseDetailClient orderId={params.id} />
    </Suspense>
  );
}

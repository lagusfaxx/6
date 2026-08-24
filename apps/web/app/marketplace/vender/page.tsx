import { Suspense } from "react";
import SellerDashboardClient from "./SellerDashboardClient";

export default function SellerDashboardPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-white/60">Cargando tu tienda...</div>}>
      <SellerDashboardClient />
    </Suspense>
  );
}

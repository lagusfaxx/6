"use client";

import { Suspense } from "react";
import ShopDashboardClient from "./ShopDashboardClient";

export default function ShopDashboardPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-white/60">Cargando panel...</div>}>
      <ShopDashboardClient />
    </Suspense>
  );
}

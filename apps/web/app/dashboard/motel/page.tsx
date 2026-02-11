import { Suspense } from "react";
import MotelDashboardClient from "./MotelDashboardClient";

export default function MotelDashboardPage() {
  return (
    <Suspense fallback={<div className="text-white/70">Cargando panel motel...</div>}>
      <MotelDashboardClient />
    </Suspense>
  );
}


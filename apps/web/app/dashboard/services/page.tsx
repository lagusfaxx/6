import { Suspense } from "react";
import DashboardServicesClient from "./DashboardServicesClient";

export default function DashboardServicesPage() {
  return (
    <Suspense fallback={<div className="p-6 text-white/70">Cargando panel...</div>}>
      <DashboardServicesClient />
    </Suspense>
  );
}

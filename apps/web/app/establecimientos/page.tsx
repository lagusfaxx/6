import { Suspense } from "react";
import EstablishmentsClient from "./EstablishmentsClient";

export default function EstablishmentsPage() {
  return (
    <Suspense fallback={<div className="text-white/60">Cargando establecimientos...</div>}>
      <EstablishmentsClient />
    </Suspense>
  );
}

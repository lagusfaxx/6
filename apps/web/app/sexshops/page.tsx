import { Suspense } from "react";
import SexShopsClient from "./SexShopsClient";

export default function SexShopsPage() {
  return (
    <Suspense fallback={<div className="text-white/60">Cargando sex shops...</div>}>
      <SexShopsClient />
    </Suspense>
  );
}

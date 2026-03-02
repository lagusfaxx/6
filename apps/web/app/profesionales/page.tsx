import { Suspense } from "react";
import ProfessionalsClient from "./ProfessionalsClient";

export default function ProfessionalsPage() {
  return (
    <Suspense fallback={<div className="text-white/60">Cargando profesionales...</div>}>
      <ProfessionalsClient />
    </Suspense>
  );
}

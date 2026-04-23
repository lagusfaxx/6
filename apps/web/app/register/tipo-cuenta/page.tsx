import { Suspense } from "react";
import GoogleTypeChooserClient from "./GoogleTypeChooserClient";

export const dynamic = "force-dynamic";

export default function GoogleTypeChooserPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-white/60">Cargando...</div>}>
      <GoogleTypeChooserClient />
    </Suspense>
  );
}

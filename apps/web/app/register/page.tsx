import { Suspense } from "react";
import RegisterClient from "./RegisterClient";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-white/60">Cargando...</div>}>
      <RegisterClient />
    </Suspense>
  );
}

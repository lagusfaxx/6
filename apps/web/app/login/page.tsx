import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-white/60">Cargando...</div>}>
      <LoginClient />
    </Suspense>
  );
}

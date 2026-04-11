import { Suspense } from "react";
import ReenviarContrasenaClient from "./ReenviarContrasenaClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reenviar correo de contraseña — UZEED",
};

export default function ReenviarContrasenaPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-white/60">Cargando...</div>}>
      <ReenviarContrasenaClient />
    </Suspense>
  );
}

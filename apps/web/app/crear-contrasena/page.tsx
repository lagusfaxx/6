import { Suspense } from "react";
import CrearContrasenaClient from "./CrearContrasenaClient";

export const metadata = {
  title: "Crear contraseña — UZEED",
};

export default function CrearContrasenaPage() {
  return (
    <Suspense
      fallback={
        <div className="card p-8 text-white/60">Cargando...</div>
      }
    >
      <CrearContrasenaClient />
    </Suspense>
  );
}

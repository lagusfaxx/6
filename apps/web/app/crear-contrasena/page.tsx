import { Suspense } from "react";
import type { Metadata } from "next";
import CrearContrasenaClient from "./CrearContrasenaClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Crear contraseña | UZEED",
  description: "Crea una nueva contraseña para tu cuenta UZEED.",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
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

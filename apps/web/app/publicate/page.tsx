import { Suspense } from "react";
import PublicateClient from "./PublicateClient";

export const metadata = {
  title: "Publícate en UZEED — Crea tu perfil en 2 minutos",
  description:
    "Crea tu perfil profesional en UZEED sin registro previo. Rápido, sencillo y gratis.",
};

export default function PublicatePage() {
  return (
    <Suspense
      fallback={
        <div className="card p-8 text-white/60">Cargando...</div>
      }
    >
      <PublicateClient />
    </Suspense>
  );
}

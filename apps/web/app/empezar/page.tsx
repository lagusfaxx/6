import { Suspense } from "react";
import EmpezarClient from "./EmpezarClient";

export const metadata = {
  title: "Empieza en UZEED — Elige cómo registrarte",
  description:
    "Crea tu perfil profesional en UZEED. Elige entre registro completo o publicación rápida.",
};

export default function EmpezarPage() {
  return (
    <Suspense
      fallback={
        <div className="card p-8 text-white/60">Cargando...</div>
      }
    >
      <EmpezarClient />
    </Suspense>
  );
}

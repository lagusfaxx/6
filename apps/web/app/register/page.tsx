import { Suspense } from "react";
import type { Metadata } from "next";
import RegisterClient from "./RegisterClient";

export const metadata: Metadata = {
  title: "Crear cuenta en UZEED — Regístrate gratis",
  description:
    "Regístrate gratis en UZEED. Crea tu cuenta como cliente, acompañante, motel u hotel para publicar tu perfil, guardar favoritos y contactar por chat en Chile.",
  alternates: {
    canonical: "/register",
  },
  openGraph: {
    title: "Crear cuenta en UZEED — Regístrate gratis",
    description:
      "Regístrate gratis en UZEED. Crea tu cuenta como cliente, acompañante, motel u hotel en Chile.",
    url: "https://uzeed.cl/register",
  },
};

function RegisterFallback() {
  return (
    <div className="card p-8">
      <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
        Crear cuenta en UZEED
      </h1>
      <p className="mt-3 max-w-xl text-white/70">
        Regístrate gratis para publicar tu perfil, guardar favoritos y coordinar
        por chat. Elige tu tipo de cuenta: cliente, acompañante, motel/hotel o
        sexshop.
      </p>
      <p className="mt-6 text-sm text-white/50" role="status">
        Cargando formulario de registro…
      </p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<RegisterFallback />}>
      <RegisterClient />
    </Suspense>
  );
}

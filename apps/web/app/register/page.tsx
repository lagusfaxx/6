import { Suspense } from "react";
import type { Metadata } from "next";
import RegisterClient from "./RegisterClient";

export const metadata: Metadata = {
  title: "Crear cuenta | UZEED",
  description: "Regístrate en UZEED y crea tu cuenta como cliente o profesional.",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-white/60">Cargando...</div>}>
      <RegisterClient />
    </Suspense>
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";
import ReenviarContrasenaClient from "./ReenviarContrasenaClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reenviar correo de contraseña | UZEED",
  description: "Solicita un nuevo correo para restablecer tu contraseña en UZEED.",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function ReenviarContrasenaPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-white/60">Cargando...</div>}>
      <ReenviarContrasenaClient />
    </Suspense>
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";
import LoginClient from "./LoginClient";

export const metadata: Metadata = {
  title: "Ingresar | UZEED",
  description: "Inicia sesión en tu cuenta UZEED.",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-white/60">Cargando...</div>}>
      <LoginClient />
    </Suspense>
  );
}

import type { Metadata } from "next";
import UmateHeader from "./_components/UmateHeader";

export const metadata: Metadata = {
  title: "U-Mate — Descubre creadoras y contenido exclusivo",
  description: "U-Mate es una plataforma de suscripción para descubrir creadoras, desbloquear contenido premium y conectar con su comunidad.",
};

export default function UmateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="umate-theme min-h-screen bg-[#fffaf8] text-slate-900">
      <UmateHeader />
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-5 md:pt-8">{children}</main>
    </div>
  );
}

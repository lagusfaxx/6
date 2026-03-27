import type { Metadata } from "next";
import UmateHeader from "./_components/UmateHeader";
import UmateMobileNav from "./_components/UmateMobileNav";

export const metadata: Metadata = {
  title: "U-Mate — Descubre creadoras y contenido exclusivo",
  description:
    "U-Mate es una plataforma de suscripción para descubrir creadoras, desbloquear contenido premium y conectar con su comunidad.",
  icons: {
    icon: "/brand/umate-icon.svg",
    shortcut: "/brand/umate-icon.svg",
    apple: "/brand/umate-icon.svg",
  },
};

export default function UmateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="umate-theme min-h-screen bg-[#0a0a12] text-white antialiased selection:bg-[#00aff0]/20 selection:text-white">
      {/* Subtle ambient background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 h-[600px] w-[600px] rounded-full bg-[#00aff0]/[0.015] blur-[160px]" />
        <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full bg-purple-600/[0.01] blur-[140px]" />
      </div>
      <div className="relative">
        <UmateHeader />
        <main className="pb-20 lg:pb-0">{children}</main>
        <UmateMobileNav />
      </div>
    </div>
  );
}

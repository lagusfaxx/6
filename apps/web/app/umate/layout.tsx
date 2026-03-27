import type { Metadata } from "next";
import UmateHeader from "./_components/UmateHeader";
import UmateMobileNav from "./_components/UmateMobileNav";

export const metadata: Metadata = {
  title: "U-Mate — Descubre creadoras y contenido exclusivo",
  description:
    "U-Mate es una plataforma de suscripción para descubrir creadoras, desbloquear contenido premium y conectar con su comunidad.",
  icons: {
    icon: "/brand/Umate-optimized.png",
    shortcut: "/brand/Umate-optimized.png",
    apple: "/brand/Umate-optimized.png",
  },
};

export default function UmateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="umate-theme min-h-screen bg-[#0a0a0f] text-white">
      <UmateHeader />
      <main className="pb-20 lg:pb-0">{children}</main>
      <UmateMobileNav />
    </div>
  );
}

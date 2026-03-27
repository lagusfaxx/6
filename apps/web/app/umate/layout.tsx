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
    <div className="umate-theme min-h-screen bg-[#08080d] text-white antialiased selection:bg-[#00aff0]/20 selection:text-white">
      <UmateHeader />
      <main className="pb-20 lg:pb-0">{children}</main>
      <UmateMobileNav />
    </div>
  );
}

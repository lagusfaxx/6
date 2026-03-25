import type { Metadata } from "next";
import UmateHeader from "./_components/UmateHeader";

export const metadata: Metadata = {
  title: "U-Mate — Contenido exclusivo de creadoras",
  description: "Suscríbete a tus creadoras favoritas y accede a contenido exclusivo en U-Mate.",
};

export default function UmateLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#06060c]">
      <UmateHeader />
      <main className="mx-auto max-w-6xl px-4 pb-24">{children}</main>
    </div>
  );
}

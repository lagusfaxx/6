import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cerca de ti",
  description:
    "Descubre escorts, moteles y sex shops cerca de tu ubicación en un mapa interactivo. Ajusta el radio y contacta al instante.",
};

export default function CercaLayout({ children }: { children: React.ReactNode }) {
  return children;
}

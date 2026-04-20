import type { Metadata } from "next";
import CreadorasClient from "./CreadorasClient";

export const metadata: Metadata = {
  title: "Únete a UZEED — Onboarding para creadoras",
  description:
    "Regístrate en UZEED, la plataforma chilena donde conectas con clientes reales, decides tus tarifas y manejas tu perfil con total privacidad.",
  alternates: { canonical: "/creadoras" },
  openGraph: {
    title: "Únete a UZEED — La plataforma para creadoras en Chile",
    description:
      "Perfil verificado, contacto directo con clientes, control de tu agenda y tus tarifas. Regístrate gratis y publica en minutos.",
    url: "https://uzeed.cl/creadoras",
    type: "website",
  },
  robots: { index: false, follow: false },
};

export default function CreadorasPage() {
  return <CreadorasClient />;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ayuda: Billetera",
  description: "Cómo recargar tu billetera de UZEED, en qué usar el saldo y cómo pedir retiros a tu cuenta bancaria.",
  alternates: { canonical: "/ayuda/billetera" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

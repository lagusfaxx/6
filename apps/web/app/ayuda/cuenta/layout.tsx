import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ayuda: Cuenta y perfil",
  description: "Cómo crear, editar y proteger tu cuenta en UZEED.",
  alternates: { canonical: "/ayuda/cuenta" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

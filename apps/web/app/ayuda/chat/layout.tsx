import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ayuda: Chat y mensajes",
  description: "Cómo usar el chat de UZEED para contactar perfiles de forma segura.",
  alternates: { canonical: "/ayuda/chat" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

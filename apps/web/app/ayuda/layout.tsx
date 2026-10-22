import type { Metadata } from "next";
import AyudaShell from "./AyudaShell";

/* El shell es de cliente (navegación lateral); la metadata va acá. Cada tema
   declara su propio título y canonical en su layout. */
export const metadata: Metadata = {
  /* Con un título plano los temas perdían el " | UZEED" del layout raíz. */
  title: { default: "Centro de ayuda", template: "%s | UZEED" },
  description: "Guías de UZEED: cuenta y perfil, billetera, tokens, contenido, planes, chat, foro y seguridad.",
  alternates: { canonical: "/ayuda" },
};

export default function AyudaLayout({ children }: { children: React.ReactNode }) {
  return <AyudaShell>{children}</AyudaShell>;
}

import type { Metadata } from "next";

/* La página es client component: el metadata va en el layout. Sin canonical
   propio heredaba el del layout raíz y apuntaba al inicio. */
export const metadata: Metadata = {
  title: "Términos y Condiciones",
  description: "Términos y condiciones de uso de UZEED para usuarios y profesionales. Plataforma sólo para mayores de 18 años.",
  alternates: { canonical: "/terminos" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

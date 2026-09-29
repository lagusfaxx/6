import type { Metadata } from "next";

/* La página es client component: el metadata va en el layout. Sin canonical
   propio heredaba el del layout raíz y apuntaba al inicio. */
export const metadata: Metadata = {
  title: "Política de Privacidad",
  description: "Cómo UZEED recopila, usa y protege tus datos personales, y cómo pedir la eliminación de tu cuenta.",
  alternates: { canonical: "/privacidad" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

/* La página es client component: el metadata va en el layout. Sin canonical
   propio heredaba el del layout raíz y apuntaba al inicio. */
export const metadata: Metadata = {
  title: "Contacto",
  description: "Contacta al equipo de UZEED: soporte para clientes, escorts, moteles y tiendas. Respondemos por WhatsApp y correo.",
  alternates: { canonical: "/contacto" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}

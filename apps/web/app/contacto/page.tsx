import type { Metadata } from "next";
import ContactoClient from "./ContactoClient";

export const metadata: Metadata = {
  title: "Contacto - UZEED Chile",
  description:
    "Contáctanos en UZEED. Resolvemos consultas generales, soporte técnico, cuentas profesionales y reportes. También puedes escribirnos a contacto@uzeed.cl.",
  alternates: { canonical: "/contacto" },
  openGraph: {
    title: "Contacto - UZEED Chile",
    description:
      "Resolvemos consultas, soporte técnico y reportes en UZEED Chile.",
    url: "/contacto",
    type: "website",
    images: [
      {
        url: "/brand/isotipo-new.png",
        width: 720,
        height: 720,
        alt: "Contacto UZEED",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contacto - UZEED Chile",
    description: "Resolvemos consultas y soporte en UZEED Chile.",
    images: ["/brand/isotipo-new.png"],
  },
};

export default function ContactoPage() {
  return <ContactoClient />;
}

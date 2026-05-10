import type { Metadata } from "next";
import ForgotPasswordClient from "./ForgotPasswordClient";

export const metadata: Metadata = {
  title: "Recuperar contraseña | UZEED",
  description: "Recupera el acceso a tu cuenta UZEED.",
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordClient />;
}

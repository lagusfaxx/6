import { redirect } from "next/navigation";

/* La sección Premium no está en uso: quien llegue por un enlace viejo va al
   inicio. */
export default function PremiumPage() {
  redirect("/");
}

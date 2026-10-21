import { redirect } from "next/navigation";

/* Ya no hay transmisiones propias en UZEED: la guía se retiró. */
export default function AyudaLiveRedirect() {
  redirect("/ayuda");
}

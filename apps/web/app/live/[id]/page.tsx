import { redirect } from "next/navigation";

/* Las transmisiones propias de UZEED ya no existen: los enlaces viejos a una
   transmisión llevan a En Vivo (cámaras). */
export default function LiveStreamRedirect() {
  redirect("/live");
}

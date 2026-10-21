import { redirect } from "next/navigation";

/* El sistema de videollamadas de UZEED ya no existe. */
export default function VideocallRoomRedirect() {
  redirect("/");
}

import { redirect } from "next/navigation";

/* El estudio para transmitir ya no existe (no hay lives propios). */
export default function LiveStudioRedirect() {
  redirect("/live");
}

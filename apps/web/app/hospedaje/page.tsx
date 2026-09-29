import { permanentRedirect } from "next/navigation";

/* /hospedaje era el listado viejo de moteles: ahora es /moteles. */
export default function HospedajePage() {
  permanentRedirect("/moteles");
}

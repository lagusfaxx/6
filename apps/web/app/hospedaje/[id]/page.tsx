import { permanentRedirect } from "next/navigation";
import { fetchMotelDetail } from "../../../lib/motels";

type Props = { params: Promise<{ id: string }> };

/* Ficha vieja del motel: la nueva vive en /motel/{nombre}. Se conserva la URL
   para los enlaces ya compartidos y lo que Google tenía indexado. */
export default async function HospedajeDetailRedirect({ params }: Props) {
  const { id } = await params;
  const motel = await fetchMotelDetail(id);
  permanentRedirect(`/motel/${motel?.slug || encodeURIComponent(id)}`);
}

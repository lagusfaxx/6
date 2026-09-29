import { permanentRedirect } from "next/navigation";
import EstablishmentClient from "./EstablishmentClient";
import { fetchMotelDetail } from "../../../lib/motels";

type Props = { params: Promise<{ id: string }> };

/* Los moteles tienen su ficha en /motel/{nombre}; el resto de los locales
   ("espacios exclusivos") siguen aquí. */
export default async function EstablishmentPage({ params }: Props) {
  const { id } = await params;
  const motel = await fetchMotelDetail(id);
  if (motel) permanentRedirect(`/motel/${motel.slug}`);
  return <EstablishmentClient />;
}

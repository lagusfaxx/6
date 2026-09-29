import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import MotelDetailView from "../../../components/motels/MotelDetailView";
import MotelPreviewClient from "../../../components/motels/MotelPreviewClient";
import { resolveMediaUrl } from "../../../lib/api";
import { distanceKm } from "../../../lib/comunas";
import { comunaForMotel, fetchMotelDetail, fetchMotelDirectory, formatClp } from "../../../lib/motels";

export const revalidate = 120;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const motel = await fetchMotelDetail(slug);
  if (!motel) return { title: "Motel", robots: { index: false, follow: true } };

  const place = comunaForMotel(motel)?.name || motel.city || "Chile";
  const prices = motel.rooms.map((r) => r.price3h).filter((p): p is number => Boolean(p && p > 0));
  const from = prices.length ? Math.min(...prices) : null;
  const title = `${motel.name}, motel en ${place}${from ? ` desde ${formatClp(from)}` : ""}`;
  const description = [
    `${motel.name} es un motel en ${place}${motel.address ? ` (${motel.address.split(",")[0]})` : ""}.`,
    from ? `Habitaciones desde ${formatClp(from)} por 3 horas.` : null,
    motel.rooms.length ? `${motel.rooms.length} ${motel.rooms.length === 1 ? "habitación" : "habitaciones"} con fotos y tarifas.` : "Fotos, ubicación y datos de contacto.",
    motel.kind === "profile" && motel.rooms.length ? "Reserva por chat en UZEED." : null,
  ]
    .filter(Boolean)
    .join(" ");
  const image = resolveMediaUrl(motel.gallery[0] || motel.coverUrl) || "https://uzeed.cl/brand/isotipo-new.png";

  return {
    title,
    description,
    alternates: { canonical: `/motel/${motel.slug}` },
    openGraph: {
      title: `${motel.name} | Moteles en ${place} | UZEED`,
      description,
      url: `https://uzeed.cl/motel/${motel.slug}`,
      type: "website",
      images: [{ url: image, alt: motel.name }],
    },
  };
}

export default async function MotelPage({ params }: Props) {
  const { slug } = await params;
  const motel = await fetchMotelDetail(slug);

  /* Oculto, en revisión o inexistente: el navegador reintenta con la sesión
     (vista previa del dueño) o muestra "no disponible". */
  if (!motel) return <MotelPreviewClient slug={slug} />;

  /* Una sola URL por motel: /motel/{id} redirige a /motel/{username}. */
  if (motel.slug !== slug && motel.slug.toLowerCase() !== slug.toLowerCase()) {
    permanentRedirect(`/motel/${motel.slug}`);
  }

  const all = await fetchMotelDirectory();
  const nearby =
    motel.latitude != null && motel.longitude != null
      ? all
          .filter((m) => m.id !== motel.id && m.latitude != null && m.longitude != null)
          .map((m) => ({ m, d: distanceKm(motel.latitude as number, motel.longitude as number, m.latitude as number, m.longitude as number) }))
          .filter((x) => x.d <= 15)
          .sort((a, b) => a.d - b.d)
          .slice(0, 4)
          .map((x) => x.m)
      : [];

  return <MotelDetailView motel={motel} nearby={nearby} />;
}

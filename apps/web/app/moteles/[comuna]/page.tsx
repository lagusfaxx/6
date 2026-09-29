import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MotelLandingView from "../../../components/motels/MotelLandingView";
import { COMUNAS, getComuna } from "../../../lib/comunas";
import { fetchMotelDirectory, motelsForComuna, priceFrom } from "../../../lib/motels";

export const revalidate = 300;

type Props = { params: Promise<{ comuna: string }> };

/* Las landings de todas las comunas se generan en el build y se refrescan cada 5 minutos. */
export function generateStaticParams() {
  return COMUNAS.map((c) => ({ comuna: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { comuna: slug } = await params;
  const comuna = getComuna(slug);
  if (!comuna) return { title: "Moteles" };
  const all = await fetchMotelDirectory();
  const { inside, nearby } = motelsForComuna(all, comuna);
  const prices = inside.map((m) => priceFrom(m, "3H")?.price).filter((p): p is number => Boolean(p));
  const minPrice = prices.length ? Math.min(...prices) : null;

  const title = inside.length
    ? `Moteles en ${comuna.name}: precios, fotos y reservas`
    : `Moteles cerca de ${comuna.name}: precios y fotos`;
  const description = inside.length
    ? `${inside.length} ${inside.length === 1 ? "motel" : "moteles"} en ${comuna.name}${minPrice ? ` desde $${minPrice.toLocaleString("es-CL")} por 3 horas` : ""}. Fotos reales, moteles con jacuzzi y estacionamiento privado, promociones y reserva por chat en UZEED.`
    : `Moteles cerca de ${comuna.name}${comuna.region ? `, ${comuna.region}` : ""}: fotos, tarifas por 3 horas, 6 horas y noche y reserva por chat en UZEED.`;
  const url = `https://uzeed.cl/moteles/${comuna.slug}`;

  return {
    title,
    description,
    keywords: [`moteles ${comuna.name.toLowerCase()}`, `moteles en ${comuna.name.toLowerCase()}`, `motel ${comuna.name.toLowerCase()}`, `hoteles por hora ${comuna.name.toLowerCase()}`],
    alternates: { canonical: `/moteles/${comuna.slug}` },
    /* Sin moteles propios ni cercanos la página sería un listado vacío: no se indexa. */
    robots: inside.length || nearby.length || comuna.isMetro ? undefined : { index: false, follow: true },
    openGraph: {
      title: `${title} | UZEED`,
      description,
      url,
      type: "website",
      images: [{ url: "https://uzeed.cl/brand/isotipo-new.png", width: 720, height: 720, alt: `Moteles en ${comuna.name}` }],
    },
  };
}

export default async function MotelesComunaPage({ params }: Props) {
  const { comuna: slug } = await params;
  const comuna = getComuna(slug);
  if (!comuna) notFound();
  const all = await fetchMotelDirectory();
  const { inside, nearby } = motelsForComuna(all, comuna);
  return <MotelLandingView all={all} comuna={comuna} motels={inside} nearby={nearby} />;
}

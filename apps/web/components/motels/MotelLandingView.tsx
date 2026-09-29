import Link from "next/link";
import { Building2 } from "lucide-react";
import MotelDirectory from "./MotelDirectory";
import MotelCard from "./MotelCard";
import { Breadcrumbs, ComunaLinks, Faq, JsonLd, breadcrumbLd, motelFaq } from "./MotelSeo";
import { COMUNAS, type Comuna } from "../../lib/comunas";
import { countByComuna, motelHref, priceFrom, siteUrl, type MotelWithComuna } from "../../lib/motels";

/**
 * Vista común de /moteles y /moteles/{comuna}. Todo lo que ve Google (título,
 * tarjetas, texto, enlaces por comuna, datos estructurados) sale renderizado
 * desde el servidor.
 */
export default function MotelLandingView({
  all,
  comuna,
  motels,
  nearby = [],
}: {
  all: MotelWithComuna[];
  comuna: Comuna | null;
  motels: MotelWithComuna[];
  nearby?: Array<MotelWithComuna & { distanceKm: number }>;
}) {
  const place = comuna ? comuna.name : "Chile";
  const counts = countByComuna(all);
  const prices = motels.map((m) => priceFrom(m, "3H")?.price).filter((p): p is number => Boolean(p));
  const minPrice = prices.length ? Math.min(...prices) : null;
  const bookable = motels.filter((m) => m.kind === "profile" && m.roomsCount > 0).length;
  const path = comuna ? `/moteles/${comuna.slug}` : "/moteles";

  /* Comunas con moteles, para saltar rápido desde la cabecera. */
  const popular = COMUNAS.filter((c) => !c.isMetro && (counts.get(c.slug) || 0) > 0 && c.slug !== comuna?.slug)
    .sort((a, b) => (counts.get(b.slug) || 0) - (counts.get(a.slug) || 0))
    .slice(0, 10);

  const heading = comuna
    ? motels.length || comuna.isMetro
      ? `Moteles en ${comuna.name}`
      : `Moteles cerca de ${comuna.name}`
    : "Moteles en Santiago y todo Chile";

  const crumbs = [
    { name: "Inicio", path: "/" },
    { name: "Moteles", path: comuna ? "/moteles" : undefined },
    ...(comuna ? [{ name: comuna.name }] : []),
  ];

  return (
    <div className="-mx-4 -mt-4 px-4 pb-16 text-white">
      <header className="mx-auto max-w-7xl pb-2 pt-6">
        <Breadcrumbs items={crumbs} />
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">{heading}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
          {motels.length > 0 ? (
            <>
              {motels.length} {motels.length === 1 ? "motel" : "moteles"}
              {comuna ? ` en ${comuna.name}` : ""} con fotos, tarifas por 3 horas, 6 horas y noche
              {minPrice ? ` desde $${minPrice.toLocaleString("es-CL")}` : ""}.
              {bookable > 0 ? ` ${bookable === 1 ? "Uno recibe" : `${bookable} reciben`} reservas directo en UZEED.` : ""}
            </>
          ) : comuna ? (
            <>Aún no hay moteles publicados en {comuna.name}. Estos son los más cercanos.</>
          ) : (
            <>Fotos, tarifas y reserva de moteles en Santiago y todo Chile.</>
          )}
        </p>
        {popular.length > 0 && (
          <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none">
            {comuna && !comuna.isMetro && (
              <Link href="/moteles/santiago" className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[13px] text-white/70 transition hover:bg-white/10 hover:text-white">
                Todo Santiago
              </Link>
            )}
            {popular.map((c) => (
              <Link key={c.slug} href={`/moteles/${c.slug}`} className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-[13px] text-white/70 transition hover:bg-white/10 hover:text-white">
                {c.name} <span className="text-white/35">{counts.get(c.slug)}</span>
              </Link>
            ))}
          </div>
        )}
      </header>

      {motels.length > 0 || !comuna ? (
        <MotelDirectory motels={motels} center={comuna && !comuna.isMetro ? { lat: comuna.lat, lng: comuna.lng } : null} />
      ) : null}

      {nearby.length > 0 && (
        <section className="mx-auto mt-12 max-w-7xl">
          <h2 className="text-lg font-semibold text-white/90">
            {motels.length ? `Otros moteles cerca de ${place}` : "Los más cercanos"}
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-8 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {nearby.map((m) => (
              <MotelCard key={m.id} motel={m} distanceKm={m.distanceKm} />
            ))}
          </div>
        </section>
      )}

      {comuna && motels.length === 0 && nearby.length === 0 && (
        <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
          <Building2 className="mx-auto h-8 w-8 text-white/25" />
          <p className="mt-3 font-semibold text-white/80">Aún no hay moteles en {comuna.name}</p>
          <p className="mt-1 text-sm text-white/45">Mira todos los moteles del directorio o publica el tuyo.</p>
          <div className="mt-4 flex justify-center gap-2">
            <Link href="/moteles" className="btn-secondary px-4 py-2 text-sm">Ver todos</Link>
            <Link href="/register?type=ESTABLISHMENT" className="btn-primary px-4 py-2 text-sm">Publicar mi motel</Link>
          </div>
        </div>
      )}

      {/* ── Dueños: el directorio crece con ellos ── */}
      <section className="mx-auto mt-14 max-w-7xl">
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-fuchsia-500/20 bg-gradient-to-r from-fuchsia-600/[0.12] via-violet-600/[0.08] to-transparent p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">¿Tienes un motel{comuna && !comuna.isMetro ? ` en ${comuna.name}` : ""}?</h2>
            <p className="mt-1 max-w-xl text-sm text-white/60">
              Publícalo en UZEED: tu ficha con fotos y tarifas, reservas por chat y promociones para llenar las horas bajas.
            </p>
          </div>
          <Link href="/register?type=ESTABLISHMENT" className="btn-primary shrink-0 px-5 py-2.5 text-sm">Publicar mi motel</Link>
        </div>
      </section>

      <section className="mx-auto mt-12 max-w-3xl text-sm leading-relaxed text-white/55">
        <h2 className="text-lg font-semibold text-white/90">
          {comuna ? `Moteles y hoteles por hora en ${comuna.name}` : "Moteles y hoteles por hora en Chile"}
        </h2>
        <p className="mt-3">
          En UZEED encuentras moteles {comuna ? `en ${comuna.name}${comuna.region && !comuna.isMetro ? `, ${comuna.region}` : ""}` : "en Santiago, Viña del Mar, Concepción y todo Chile"} con fotos reales de sus habitaciones,
          tarifas por 3 horas, 6 horas y noche, promociones vigentes y ubicación en el mapa. Compara moteles con jacuzzi,
          estacionamiento privado, habitaciones temáticas o atención 24 horas, y reserva directo con el motel por chat.
        </p>
        <p className="mt-3">
          Cada ficha muestra el precio real de cada habitación y lo que incluye. Los moteles que reciben reservas en UZEED
          te confirman por el chat y te entregan un código para presentar al llegar.
        </p>
      </section>

      <Faq items={motelFaq(place, { count: motels.length, minPrice }).map((f) => ({ q: f.q, a: f.a }))} />

      <ComunaLinks counts={counts} current={comuna?.slug} />

      <JsonLd data={breadcrumbLd(crumbs)} />
      {motels.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: heading,
            url: siteUrl(path),
            numberOfItems: motels.length,
            itemListElement: motels.slice(0, 50).map((m, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: siteUrl(motelHref(m)),
              name: m.name,
            })),
          }}
        />
      )}
    </div>
  );
}

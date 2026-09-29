import Link from "next/link";
import { BadgeCheck, Clock, MapPin, Navigation, Star } from "lucide-react";
import MotelGallery from "./MotelGallery";
import MotelMap from "./MotelMap";
import MotelStay from "./MotelStay";
import MotelCard from "./MotelCard";
import { Breadcrumbs, JsonLd, breadcrumbLd } from "./MotelSeo";
import { amenityIcon, motelAmenityLabel } from "./amenities";
import { resolveMediaUrl } from "../../lib/api";
import { comunaForMotel, siteUrl, type MotelDetail, type MotelWithComuna } from "../../lib/motels";

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  if (days < 1) return "hoy";
  if (days < 30) return `hace ${days} ${days === 1 ? "día" : "días"}`;
  const months = Math.floor(days / 30);
  return `hace ${months} ${months === 1 ? "mes" : "meses"}`;
}

/**
 * Ficha pública del motel, al estilo de un alojamiento: fotos, datos,
 * habitaciones con tarifas, comodidades, ubicación y reseñas, con la reserva
 * al costado. No usa nada exclusivo del servidor para poder reusarse en la
 * vista previa del dueño.
 */
export default function MotelDetailView({ motel, nearby = [] }: { motel: MotelDetail; nearby?: MotelWithComuna[] }) {
  const comuna = comunaForMotel(motel);
  const place = comuna?.name || motel.city || "Chile";
  const photos = Array.from(new Set([...motel.gallery, ...motel.rooms.flatMap((r) => r.photoUrls)]));
  const prices = motel.rooms.flatMap((r) => [r.price3h, r.price6h, r.priceNight]).filter((p): p is number => Boolean(p && p > 0));
  const path = `/motel/${motel.slug}`;
  const maps = motel.latitude != null && motel.longitude != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${motel.latitude},${motel.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${motel.name} ${motel.address || place}`)}`;

  const crumbs = [
    { name: "Inicio", path: "/" },
    { name: "Moteles", path: "/moteles" },
    ...(comuna ? [{ name: comuna.name, path: `/moteles/${comuna.slug}` }] : []),
    { name: motel.name },
  ];

  const highlights = motel.amenities.slice(0, 3);

  const intro = (
    <>
      {(highlights.length > 0 || motel.schedule) && (
        <ul className="grid gap-4 border-b border-white/[0.08] pb-8 sm:grid-cols-2">
          {motel.schedule && (
            <li className="flex gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-white/60" />
              <div>
                <p className="text-sm font-medium">Horario</p>
                <p className="text-[13px] text-white/50">{motel.schedule}</p>
              </div>
            </li>
          )}
          {highlights.map((a) => {
            const Icon = amenityIcon(a);
            return (
              <li key={a} className="flex gap-3">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-white/60" />
                <p className="text-sm font-medium">{motelAmenityLabel(a)}</p>
              </li>
            );
          })}
        </ul>
      )}
      {motel.description && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Sobre {motel.name}</h2>
          <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-white/70">{motel.description}</p>
        </section>
      )}
    </>
  );

  const after = (
    <>
      {motel.amenities.length > 0 && (
        <section className="mt-10 border-t border-white/[0.08] pt-8">
          <h2 className="text-xl font-semibold">Lo que ofrece este motel</h2>
          <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {motel.amenities.map((a) => {
              const Icon = amenityIcon(a);
              return (
                <li key={a} className="flex items-center gap-3 text-[15px] text-white/75">
                  <Icon className="h-5 w-5 text-white/50" /> {motelAmenityLabel(a)}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-10 border-t border-white/[0.08] pt-8">
        <h2 className="text-xl font-semibold">Ubicación</h2>
        <p className="mt-2 flex items-start gap-2 text-[15px] text-white/65">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {motel.address || place}
        </p>
        {motel.latitude != null && motel.longitude != null && (
          <div className="mt-4">
            <MotelMap id={motel.id} name={motel.name} lat={motel.latitude} lng={motel.longitude} address={motel.address} />
          </div>
        )}
        <a href={maps} target="_blank" rel="noopener" className="btn-secondary mt-4 px-4 py-2.5 text-sm">
          <Navigation className="mr-2 h-4 w-4" /> Cómo llegar
        </a>
      </section>

      <section className="mt-10 border-t border-white/[0.08] pt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            {motel.rating ? (
              <>
                <Star className="h-5 w-5 fill-current text-amber-300" /> {motel.rating.toFixed(1)} · {motel.reviewsCount} {motel.reviewsCount === 1 ? "reseña" : "reseñas"}
              </>
            ) : (
              "Reseñas"
            )}
          </h2>
          {motel.kind === "profile" && (
            <Link href={`/calificar/establecimiento/${motel.id}`} className="btn-secondary px-4 py-2 text-sm">Dejar una reseña</Link>
          )}
        </div>
        {motel.reviews.length ? (
          <ul className="mt-5 grid gap-5 sm:grid-cols-2">
            {motel.reviews.map((r) => (
              <li key={r.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2 text-[13px] text-white/50">
                  <span className="flex text-amber-300" aria-label={`${r.stars} de 5`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3.5 w-3.5 ${i < r.stars ? "fill-current" : "opacity-25"}`} />
                    ))}
                  </span>
                  {timeAgo(r.createdAt)}
                </div>
                {r.comment && <p className="mt-2 text-sm leading-relaxed text-white/70">{r.comment}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-white/45">
            {motel.kind === "profile"
              ? "Todavía no hay reseñas. Quienes reservan por UZEED pueden contar cómo les fue."
              : "Todavía no hay reseñas."}
          </p>
        )}
      </section>
    </>
  );

  const ld = {
    "@context": "https://schema.org",
    "@type": "Motel",
    name: motel.name,
    url: siteUrl(path),
    ...(photos.length ? { image: photos.slice(0, 8).map((p) => resolveMediaUrl(p)) } : {}),
    ...(motel.description ? { description: motel.description.slice(0, 500) } : {}),
    ...(motel.phone ? { telephone: motel.phone } : {}),
    address: {
      "@type": "PostalAddress",
      ...(motel.address ? { streetAddress: motel.address.split(",")[0] } : {}),
      addressLocality: place,
      ...(comuna?.region ? { addressRegion: comuna.region } : {}),
      addressCountry: "CL",
    },
    ...(motel.latitude != null && motel.longitude != null
      ? { geo: { "@type": "GeoCoordinates", latitude: motel.latitude, longitude: motel.longitude } }
      : {}),
    ...(prices.length ? { priceRange: `$${Math.min(...prices).toLocaleString("es-CL")} - $${Math.max(...prices).toLocaleString("es-CL")}` } : {}),
    ...(motel.rating && motel.reviewsCount
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: motel.rating, reviewCount: motel.reviewsCount, bestRating: 5, worstRating: 1 } }
      : {}),
    ...(motel.amenities.length
      ? { amenityFeature: motel.amenities.map((a) => ({ "@type": "LocationFeatureSpecification", name: motelAmenityLabel(a), value: true })) }
      : {}),
    ...(motel.websiteUrl ? { sameAs: [motel.websiteUrl] } : {}),
  };

  return (
    <div className="-mx-4 -mt-4 px-4 pb-32 text-white lg:pb-16">
      <div className="mx-auto max-w-6xl pt-5">
        {motel.isOwner && (!motel.isPublished || !motel.isVerified) && (
          <div className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3 text-sm text-amber-100">
            {!motel.isVerified
              ? "Vista previa: tu motel está en revisión y todavía no aparece en el directorio."
              : "Vista previa: tu motel está oculto. Publícalo desde tu panel para que lo vean los clientes."}
          </div>
        )}
        <Breadcrumbs items={crumbs} />
        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{motel.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/60">
              {motel.rating ? (
                <span className="flex items-center gap-1 text-white/85">
                  <Star className="h-4 w-4 fill-current text-amber-300" /> {motel.rating.toFixed(1)}
                  <span className="text-white/45">({motel.reviewsCount})</span>
                </span>
              ) : null}
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> Motel en {place}</span>
              {motel.kind === "profile" && motel.isVerified && (
                <span className="flex items-center gap-1 text-sky-300"><BadgeCheck className="h-4 w-4" /> Verificado por UZEED</span>
              )}
              {motel.kind === "profile" && (
                <span className={motel.isOpen ? "text-emerald-300" : "text-red-300"}>{motel.isOpen ? "● Abierto ahora" : "● Cerrado ahora"}</span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <MotelGallery photos={photos} name={motel.name} />
        </div>

        <MotelStay motel={motel} intro={intro} after={after} />

        {nearby.length > 0 && (
          <section className="mt-14 border-t border-white/[0.08] pt-8">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Más moteles {comuna ? `en ${comuna.name} y alrededores` : "cerca"}</h2>
              <Link href={comuna ? `/moteles/${comuna.slug}` : "/moteles"} className="text-sm text-fuchsia-300 hover:text-fuchsia-200">Ver todos</Link>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-8 min-[480px]:grid-cols-2 lg:grid-cols-4">
              {nearby.map((m) => <MotelCard key={m.id} motel={m} />)}
            </div>
          </section>
        )}
      </div>

      <JsonLd data={ld} />
      <JsonLd data={breadcrumbLd(crumbs)} />
    </div>
  );
}

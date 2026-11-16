import Link from "next/link";
import { cleanProfileHref } from "../lib/profileUrl";
import { jsonLdString } from "../lib/jsonLd";
import { clp, tagLabel, type CityStats } from "../lib/cityStats";
import type { ChileRegion } from "../lib/chileGeo";

/**
 * "{Comuna} hoy": datos reales de la oferta en la comuna, renderizados en el
 * servidor (Google los lee sin ejecutar JavaScript), más la lista de perfiles
 * con edad, comuna, metro y servicios, y el JSON-LD CollectionPage + Place +
 * ItemList de la página.
 */

const chip =
  "inline-block rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/60 hover:text-fuchsia-300 hover:border-fuchsia-500/30 transition";

function when(d: Date) {
  return d.toLocaleString("es-CL", {
    timeZone: "America/Santiago",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function plural(n: number, one: string, many: string) {
  return `${n.toLocaleString("es-CL")} ${n === 1 ? one : many}`;
}

/** Resumen en prosa: cambia con los números, así cada comuna lee distinto. */
function summary(cityName: string, s: CityStats): string[] {
  const out: string[] = [];
  const where = s.inComuna > 0 ? `en ${cityName}` : `cerca de ${cityName}`;
  let first = `Hoy hay ${plural(s.total, "escort publicada", "escorts publicadas")} ${where}`;
  if (s.inComuna > 0 && s.inComuna < s.total) first += ` (${s.inComuna} en la comuna y el resto en comunas vecinas)`;
  const extras: string[] = [];
  if (s.availableNow) extras.push(`${plural(s.availableNow, "está conectada", "están conectadas")} en este momento`);
  if (s.isNew) extras.push(`${plural(s.isNew, "se sumó", "se sumaron")} en las últimas dos semanas`);
  out.push(`${first}${extras.length ? `; ${extras.join(" y ")}` : ""}.`);

  if (s.age || s.rate) {
    const parts: string[] = [];
    if (s.age) parts.push(`tienen entre ${s.age.min} y ${s.age.max} años (la mitad, menos de ${s.age.median})`);
    if (s.rate) {
      parts.push(
        `su tarifa base parte en ${clp(s.rate.min)} y la tarifa típica de la zona es ${clp(s.rate.median)}`,
      );
    }
    out.push(`Las escorts de la zona ${parts.join(", y ")}. Cada ficha detalla qué incluye la tarifa y por cuánto tiempo.`);
  }

  if (s.topTags.length >= 3) {
    out.push(
      `Lo que más se ofrece ${where}: ${s.topTags
        .slice(0, 5)
        .map((t) => t.label.toLowerCase())
        .join(", ")}.`,
    );
  }
  if (s.topMetro.length) {
    out.push(
      `Las estaciones de metro con más escorts cerca son ${s.topMetro
        .slice(0, 3)
        .map((m) => `${m.name} (${m.count})`)
        .join(", ")}.`,
    );
  }
  return out;
}

export default function CityLiveStats({
  city,
  slug,
  region,
  stats,
}: {
  city: { name: string; lat: number; lng: number };
  slug: string;
  region?: ChileRegion;
  stats: CityStats;
}) {
  const url = `https://uzeed.cl/escorts/${slug}`;
  const profileUrl = (p: CityStats["profiles"][number]) =>
    cleanProfileHref({ id: p.id, username: p.username, serviceCategory: p.serviceCategory, name: p.displayName || p.username, city: p.city });

  const ld = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${url}#page`,
    url,
    name: `Escorts en ${city.name}`,
    inLanguage: "es-CL",
    dateModified: stats.updatedAt.toISOString(),
    isPartOf: { "@type": "WebSite", name: "UZEED", url: "https://uzeed.cl" },
    about: {
      "@type": "Place",
      name: city.name,
      geo: { "@type": "GeoCoordinates", latitude: city.lat, longitude: city.lng },
      ...(region
        ? { containedInPlace: { "@type": "AdministrativeArea", name: region.fullName, addressCountry: "CL" } }
        : { address: { "@type": "PostalAddress", addressCountry: "CL" } }),
    },
    ...(stats.profiles.length
      ? {
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: stats.total,
            itemListElement: stats.profiles.map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: `https://uzeed.cl${profileUrl(p)}`,
              name: p.displayName || p.username,
            })),
          },
        }
      : {}),
  };

  const tiles: { label: string; value: string }[] = [
    { label: "Escorts publicadas", value: stats.total.toLocaleString("es-CL") },
    ...(stats.inComuna ? [{ label: `En ${city.name}`, value: stats.inComuna.toLocaleString("es-CL") }] : []),
    { label: "Conectadas ahora", value: stats.availableNow.toLocaleString("es-CL") },
    ...(stats.isNew ? [{ label: "Nuevas (15 días)", value: stats.isNew.toLocaleString("es-CL") }] : []),
    ...(stats.age ? [{ label: "Edades", value: `${stats.age.min} a ${stats.age.max} años` }] : []),
    ...(stats.rate ? [{ label: "Tarifa base desde", value: clp(stats.rate.min) }] : []),
  ];

  return (
    <section className="max-w-5xl mx-auto px-4 pb-8 pt-6 text-sm leading-relaxed text-white/60" aria-label={`Escorts en ${city.name} hoy`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(ld) }} />
      <h2 className="text-xl font-bold text-white/80 mb-1">Escorts en {city.name} hoy</h2>
      <p className="text-xs text-white/40 mb-4">
        Datos de los perfiles publicados en UZEED · actualizado el{" "}
        <time dateTime={stats.updatedAt.toISOString()}>{when(stats.updatedAt)}</time>
      </p>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 mb-5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <dt className="text-[11px] text-white/40">{t.label}</dt>
            <dd className="text-base font-semibold text-white/80 tabular-nums">{t.value}</dd>
          </div>
        ))}
      </dl>

      {summary(city.name, stats).map((p, i) => (
        <p key={i} className="mb-3 max-w-4xl">{p}</p>
      ))}

      {stats.topTags.length > 0 && (
        <div className="mt-5">
          <h3 className="text-base font-semibold text-white/70 mb-2">Servicios más ofrecidos en {city.name}</h3>
          <ul className="flex flex-wrap gap-2">
            {stats.topTags.map((t) => (
              <li key={t.label}>
                {t.href ? (
                  <Link href={t.href} className={chip}>
                    {t.label} <span className="text-white/35">· {t.count}</span>
                  </Link>
                ) : (
                  <span className={chip}>
                    {t.label} <span className="text-white/35">· {t.count}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {stats.topMetro.length > 0 && (
        <div className="mt-5">
          <h3 className="text-base font-semibold text-white/70 mb-2">Escorts cerca del metro</h3>
          <ul className="flex flex-wrap gap-2">
            {stats.topMetro.map((m) => (
              <li key={m.name} className={chip}>
                Metro {m.name}
                {m.lines.length ? <span className="text-white/35"> (L{m.lines.join(", L")})</span> : null}
                <span className="text-white/35"> · {plural(m.count, "escort", "escorts")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stats.profiles.length > 0 && (
        <div className="mt-6">
          <h3 className="text-base font-semibold text-white/70 mb-3">
            {stats.inComuna > 0 ? `Escorts en ${city.name}` : `Escorts cerca de ${city.name}`}
          </h3>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {stats.profiles.map((p) => {
              const tags = [...(p.serviceTags || []), ...(p.profileTags || [])].slice(0, 3).map((t) => tagLabel(t).toLowerCase());
              return (
                <li key={p.id}>
                  <Link
                    href={profileUrl(p)}
                    className="block h-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 transition hover:border-fuchsia-500/30"
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="font-semibold text-white/80">{p.displayName || p.username}</span>
                      {typeof p.age === "number" && <span className="text-xs text-white/45">{p.age} años</span>}
                      {p.availableNow && <span className="ml-auto text-[11px] text-emerald-300">Disponible ahora</span>}
                    </span>
                    <span className="mt-0.5 block text-xs text-white/45">
                      {[
                        p.city,
                        p.nearestMetro?.name ? `Metro ${p.nearestMetro.name}` : null,
                        typeof p.distance === "number" && p.distance >= 1 ? `a ${Math.round(p.distance)} km` : null,
                        typeof p.baseRate === "number" && p.baseRate > 0 ? `desde ${clp(p.baseRate)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {tags.length > 0 && <span className="mt-1 block text-xs text-white/35">{tags.join(" · ")}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

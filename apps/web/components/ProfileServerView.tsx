import ProfileDetailView from "../app/profesional/_components/ProfileDetailView";
import type { ProfileRecord } from "../lib/profileServer";
import Link from "next/link";
import { jsonLdString } from "../lib/jsonLd";
import { cityLandingForPlace, isSantiagoComuna } from "../lib/cities";
import { resolveComuna } from "../lib/comunas";

/**
 * Vista server-side de un perfil, compartida por las rutas limpias
 * (/escort/{username}, /masajista/{username}). Renderiza el componente
 * interactivo (por id, sin cambios) + JSON-LD + contenido SEO para el crawler.
 */
export default function ProfileServerView({
  profile,
  canonicalUrl,
}: {
  profile: ProfileRecord;
  canonicalUrl: string;
}) {
  const name = profile.name || "Profesional";
  const city = profile.city || "Chile";
  const category = (profile.serviceCategory || "Escort").trim();

  /* Enlaces a la página de su comuna y a Santiago. Antes la ficha no enlazaba
     a ninguna landing, así que Google no veía qué perfiles alimentan cada
     página de comuna ni el grupo del Gran Santiago. Sólo en fichas de escort:
     las landings /escorts/{comuna} son de escorts. */
  const isEscort = canonicalUrl.includes("/escort/");
  const landing = isEscort ? cityLandingForPlace(profile.city) : undefined;
  const geoLinks: { href: string; label: string }[] = [];
  if (landing) {
    geoLinks.push({
      href: `/escorts/${landing.slug}`,
      label: landing.slug === "santiago" ? "Escort Santiago" : `Escorts en ${landing.name}`,
    });
    if (isSantiagoComuna(landing)) geoLinks.push({ href: "/escorts/santiago", label: "Escort Santiago" });
  } else if (isEscort && resolveComuna(profile.city)?.region === "Región Metropolitana") {
    // Comuna del Gran Santiago sin página propia (Recoleta, La Reina, Pudahuel…).
    geoLinks.push({ href: "/escorts/santiago", label: "Escort Santiago" });
  } else if (isEscort) {
    geoLinks.push({ href: "/escorts", label: "Escorts en Chile" });
  }
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: "https://uzeed.cl" },
      ...(isEscort ? [{ "@type": "ListItem", position: 2, name: "Escorts", item: "https://uzeed.cl/escorts" }] : []),
      ...(landing
        ? [{ "@type": "ListItem", position: 3, name: `Escorts en ${landing.name}`, item: `https://uzeed.cl/escorts/${landing.slug}` }]
        : []),
      { "@type": "ListItem", position: isEscort ? (landing ? 4 : 3) : 2, name },
    ],
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: name || undefined,
    jobTitle: category,
    address: { "@type": "PostalAddress", addressLocality: city, addressCountry: "CL" },
    ...(profile.avatarUrl ? { image: profile.avatarUrl } : {}),
    ...(profile.bio ? { description: profile.bio.slice(0, 300) } : {}),
    url: canonicalUrl,
  };

  return (
    <>
      {/* Componente interactivo (se resuelve por id internamente) */}
      <ProfileDetailView id={profile.id} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />
      {isEscort && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd) }}
        />
      )}

      {geoLinks.length > 0 && (
        <nav className="mx-auto max-w-4xl px-4 pb-8 pt-4" aria-label="Más escorts en la zona">
          <p className="mb-2 text-xs text-white/40">Más escorts en la zona</p>
          <ul className="flex flex-wrap gap-2">
            {geoLinks.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="inline-block rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/60 transition hover:border-fuchsia-500/30 hover:text-fuchsia-300"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Contenido SEO server-side (visible para Google, oculto visualmente) */}
      <section className="sr-only">
        <h1>
          {name} — {category} en {city}
        </h1>
        {profile.bio && <p>{profile.bio}</p>}
        {profile.serviceDescription && <p>{profile.serviceDescription}</p>}
        {profile.heightCm && <p>Altura: {profile.heightCm} cm</p>}
        {profile.hairColor && <p>Cabello: {profile.hairColor}</p>}
        {profile.serviceTags.length > 0 && (
          <p>Servicios: {profile.serviceTags.join(", ")}</p>
        )}
      </section>
    </>
  );
}

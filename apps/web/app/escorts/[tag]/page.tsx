import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import DirectoryPage from "../../../components/DirectoryPage";
import DirectorySeoLinks, { cityHasProfiles } from "../../../components/DirectorySeoLinks";
import { getCity } from "../../../lib/cities";
import { getChileRegion } from "../../../lib/chileGeo";
import { buildCityGeoSeo, buildRegionGeoSeo, regionForCity, regionHref } from "../../../lib/geoSeo";
import GeoSeoSection, { GeoBreadcrumbs, GeoFaqBlock, GeoLinkList } from "../../../components/GeoSeoSection";
import { CITY_SEO, getTagLanding, tagFilter, type SeoCopy } from "../../../lib/escortSearchLandings";
import { TEMPLATE_TAG_SEO } from "../../../lib/escortSemrushSeo";
import { jsonLdString } from "../../../lib/jsonLd";

type Props = { params: Promise<{ tag: string }> };

const OG_IMAGE = "https://uzeed.cl/brand/isotipo-new.png";

function buildMetadata(path: string, title: string, description: string, alt: string, extra: Partial<Metadata> = {}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} | UZEED`,
      description,
      url: `https://uzeed.cl${path}`,
      type: "website",
      images: [{ url: OG_IMAGE, width: 720, height: 720, alt }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | UZEED`,
      description,
      images: [OG_IMAGE],
    },
    ...extra,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;

  // ── Landing de región (/escorts/region-biobio …) ──
  const region = getChileRegion(tag);
  if (region) {
    const geo = buildRegionGeoSeo(region);
    const title = `Escorts en la ${region.label}: todas las comunas`;
    const description = `Escorts y putas verificadas en la ${region.fullName}: ${geo.capital.name} y las ${geo.provinces.reduce((n, p) => n + p.links.length, 0)} comunas de la región. Fotos reales y contacto directo por WhatsApp en UZEED.`;
    return buildMetadata(`/escorts/${region.slug}`, title, description, `UZEED Escorts ${region.name}`, {
      keywords: [`escorts ${region.name.toLowerCase()}`, `escorts ${region.label.toLowerCase()}`, `putas ${region.name.toLowerCase()}`, `escort ${geo.capital.name.toLowerCase()}`],
    });
  }

  // ── Landing de ciudad (/escorts/santiago, /escorts/las-condes …) ──
  const city = getCity(tag);
  if (city) {
    const seo = CITY_SEO[city.slug];
    // Sin perfiles en la ciudad, el título no promete "verificadas hoy" en
    // ella: la página muestra las más cercanas (ver DirectorySeoLinks).
    const hasProfiles = await cityHasProfiles(city.lat, city.lng);
    const title = seo?.title && hasProfiles
      ? seo.title
      : hasProfiles
        ? `Escorts en ${city.name} - Verificadas Hoy`
        : `Escorts en ${city.name} y alrededores`;
    const description = seo?.description && hasProfiles
      ? seo.description
      : hasProfiles
        ? `Escorts y putas verificadas en ${city.name}${city.region ? `, ${city.region}` : ""}. Fotos reales, contacto directo por WhatsApp y disponibilidad hoy en UZEED.`
        : `Escorts verificadas cerca de ${city.name}${city.region ? `, ${city.region}` : ""}: perfiles con fotos reales en las ciudades más cercanas y contacto directo en UZEED.`;
    const n = city.name.toLowerCase();
    return buildMetadata(`/escorts/${city.slug}`, title, description, `UZEED Escorts ${city.name}`, {
      keywords: seo?.keywords ?? [`escort ${n}`, `escorts en ${n}`, `putas ${n}`, `escorts ${regionForCity(city).name.toLowerCase()}`],
    });
  }

  // ── Landing curada (a-domicilio, hombres, trans, maduras …) ──
  const landing = getTagLanding(tag);
  if (landing) {
    return buildMetadata(`/escorts/${landing.slug}`, landing.title, landing.description, `UZEED ${landing.name}`,
      { keywords: landing.keywords });
  }

  // ── Landing por atributo/servicio (tetona, anal, colombiana …) ──
  const label = tag.charAt(0).toUpperCase() + tag.slice(1).replace(/-/g, " ");
  return buildMetadata(
    `/escorts/${tag}`,
    `Escorts ${label} en Chile - Verificadas Hoy`,
    `Escorts y putas ${label.toLowerCase()} verificadas en Santiago, Viña del Mar y todo Chile. Fotos reales, contacto directo y disponibilidad hoy en UZEED.`,
    `UZEED Escorts ${label}`,
  );
}

/** `parent`: nivel intermedio (la región de una comuna). */
function breadcrumbJsonLd(name: string, parent?: { name: string; href: string }) {
  const items = [
    { name: "Inicio", item: "https://uzeed.cl" },
    { name: "Escorts", item: "https://uzeed.cl/escorts" },
    ...(parent ? [{ name: parent.name, item: `https://uzeed.cl${parent.href}` }] : []),
    { name },
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, ...it })),
  };
}

/** Texto, FAQ y enlaces relacionados de una landing con copy propio. */
function SeoCopySection({ seo }: { seo: Pick<SeoCopy, "h1" | "paragraphs" | "faq" | "related"> }) {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: seo.faq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
  return (
    <section className="max-w-4xl mx-auto px-4 pb-12 pt-8 text-white/60 text-sm leading-relaxed">
      {seo.faq.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }} />
      )}
      <h2 className="text-xl font-bold text-white/80 mb-3">{seo.h1}</h2>
      {seo.paragraphs.map((p, i) => (
        <p key={i} className="mb-4">{p}</p>
      ))}
      {seo.faq.length > 0 && (
        <div className="mt-8">
          <h3 className="text-base font-semibold text-white/70 mb-3">Preguntas Frecuentes</h3>
          {seo.faq.map((f, i) => (
            <details key={i} className="mb-3 group">
              <summary className="cursor-pointer font-medium text-white/70 group-open:text-fuchsia-300 transition-colors">
                {f.question}
              </summary>
              <p className="mt-1 pl-4 text-white/50">{f.answer}</p>
            </details>
          ))}
        </div>
      )}
      {seo.related.length > 0 && (
        <nav className="mt-8" aria-label="Búsquedas relacionadas">
          <h3 className="text-base font-semibold text-white/70 mb-3">Búsquedas relacionadas</h3>
          <ul className="flex flex-wrap gap-2">
            {seo.related.map((r) => (
              <li key={r.href}>
                <Link
                  href={r.href}
                  className="inline-block rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/60 hover:text-fuchsia-300 hover:border-fuchsia-500/30 transition"
                >
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </section>
  );
}

export default async function EscortsTagPage({ params }: Props) {
  const { tag } = await params;

  // ─────────────────────────────────────────────────────────────
  // Landing de REGIÓN: /escorts/region-{region}
  // Listado centrado en la capital regional, texto propio de la región y
  // enlaces a TODAS sus comunas agrupadas por provincia.
  // ─────────────────────────────────────────────────────────────
  const region = getChileRegion(tag);
  if (region) {
    const geo = buildRegionGeoSeo(region);
    return (
      <>
        <Suspense>
          <DirectoryPage
            key={`escort-region-${region.slug}`}
            entityType="professional"
            categorySlug="escort"
            title={`Escorts en ${region.name}`}
            city={{ name: geo.capital.name, lat: geo.capital.lat, lng: geo.capital.lng }}
            withMap={false}
            defaultGender="FEMALE"
          />
        </Suspense>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(region.label)) }}
        />
        <section className="max-w-4xl mx-auto px-4 pb-10 pt-6 text-white/60 text-sm leading-relaxed">
          <GeoBreadcrumbs items={[{ name: "Inicio", href: "/" }, { name: "Escorts", href: "/escorts" }, { name: region.label }]} />
          <h2 className="text-xl font-bold text-white/80 mb-3">{geo.heading}</h2>
          {geo.paragraphs.map((p, i) => (
            <p key={i} className="mb-4">{p}</p>
          ))}
          <div className="mt-6">
            <h3 className="text-base font-semibold text-white/70 mb-3">Escorts por comuna</h3>
            {geo.provinces.map((p) => (
              <div key={p.name} className="mb-5">
                <h4 className="text-sm font-medium text-white/50 mb-2">
                  {geo.provinces.length > 1 ? `Provincia de ${p.name}` : p.name} · {p.links.length} {p.links.length === 1 ? "comuna" : "comunas"}
                </h4>
                <GeoLinkList links={p.links} label={`Comunas de ${p.name}`} />
              </div>
            ))}
          </div>
          <GeoFaqBlock faq={geo.faq} />
          <div className="mt-8">
            <h3 className="text-base font-semibold text-white/70 mb-3">Otras regiones de Chile</h3>
            <GeoLinkList links={geo.allRegions.map((r) => ({ href: r.href, label: `Escorts en ${r.label}` }))} label="Regiones" />
          </div>
        </section>
        <DirectorySeoLinks
          heading={`Escorts Destacadas en ${region.name}`}
          lat={geo.capital.lat}
          lng={geo.capital.lng}
          cityName={geo.capital.name}
        />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Landing de CIUDAD: /escorts/{ciudad}
  // Resultados filtrados por ubicación (coords de la ciudad), canonical
  // propio y contenido único. Reemplaza a ?city= (inerte y canonicalizado
  // a /escorts).
  // ─────────────────────────────────────────────────────────────
  const city = getCity(tag);
  if (city) {
    const seo = CITY_SEO[city.slug];
    const hasProfiles = await cityHasProfiles(city.lat, city.lng);
    const geo = buildCityGeoSeo(city, hasProfiles);
    const cityRegion = geo.region ?? regionForCity(city);
    const regionCrumb = { name: cityRegion.label, href: regionHref(cityRegion) };
    return (
      <>
        <Suspense>
          <DirectoryPage
            key={`escort-city-${city.slug}`}
            entityType="professional"
            categorySlug="escort"
            title={`Escorts en ${city.name}`}
            city={{ name: city.name, lat: city.lat, lng: city.lng }}
            withMap={false}
            defaultGender="FEMALE"
          />
        </Suspense>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(`Escorts en ${city.name}`, city.slug === "santiago" ? undefined : regionCrumb)) }}
        />
        {/* El texto de plantilla se mantiene siempre: las ciudades que ya
            rankean lo hacen con él. El copy propio se suma debajo. */}
        <section className="max-w-4xl mx-auto px-4 pb-12 pt-8 text-white/60 text-sm leading-relaxed">
          <h2 className="text-xl font-bold text-white/80 mb-3">
            Escorts y Acompañantes en {city.name}
          </h2>
          <p className="mb-4">
            Directorio de escorts y acompañantes verificadas en {city.name}
            {city.region ? `, ${city.region}` : ""}. Encuentra perfiles con fotos
            reales, contacto directo por WhatsApp y disponibilidad hoy. Filtra por
            servicios, disponibilidad inmediata y atención a domicilio.
          </p>
          <p>
            Todos los perfiles publicados en {city.name} son verificados. Explora
            también escorts en otras ciudades de Chile como Santiago, Viña del Mar,
            Valparaíso y Concepción desde UZEED.
          </p>
        </section>
        {seo && <SeoCopySection seo={seo} />}
        {/* Contenido propio de la comuna: ubicación, datos, comunas vecinas y
            de la provincia, FAQ. Lo tienen las 346 comunas. */}
        <GeoSeoSection
          seo={geo}
          withFaq={!seo || seo.faq.length === 0}
          breadcrumbs={[
            { name: "Inicio", href: "/" },
            { name: "Escorts", href: "/escorts" },
            ...(city.slug === "santiago" ? [] : [regionCrumb]),
            { name: city.name },
          ]}
        />
        {/* Perfiles renderizados en servidor para indexación */}
        <DirectorySeoLinks
          heading={`Escorts Destacadas en ${city.name}`}
          lat={city.lat}
          lng={city.lng}
          cityName={city.name}
        />
      </>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Landing de ATRIBUTO: /escorts/{tag}
  // El filtro sale de lib/escortSearchLandings: tags de perfil o de
  // servicio, género, a domicilio (acceptsOutcalls) o maduras (edad >= 40,
  // calculada por la API, nunca un tag manual).
  // ─────────────────────────────────────────────────────────────
  const filter = tagFilter(tag);
  const landing = getTagLanding(tag);
  const label = tag.charAt(0).toUpperCase() + tag.slice(1).replace(/-/g, " ");
  const name = landing?.name ?? `Escorts ${label}`;
  /* Plantilla con texto sumado (ej. /escorts/pelirroja): el título no cambia
     porque la página ya recibe clics con él. */
  const templateSeo = !landing && Object.prototype.hasOwnProperty.call(TEMPLATE_TAG_SEO, tag) ? TEMPLATE_TAG_SEO[tag] : undefined;

  return (
    <>
      <Suspense>
        <DirectoryPage
          key={`escort-${tag}`}
          entityType="professional"
          categorySlug="escort"
          title={name}
          filter={filter}
          defaultGender={filter.gender}
          withMap={false}
        />
      </Suspense>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd(name)) }}
      />
      {landing ? (
        <SeoCopySection seo={landing} />
      ) : (
        /* Server-rendered SEO text for long-tail indexing */
        <section className="max-w-4xl mx-auto px-4 pb-12 pt-8 text-white/60 text-sm leading-relaxed">
          <h2 className="text-xl font-bold text-white/80 mb-3">
            Escorts y Acompañantes {label} en Chile
          </h2>
          <p className="mb-4">
            Directorio de escorts y acompañantes {tag.replace(/-/g, " ")} verificadas en Chile. Encuentra
            perfiles con fotos reales en Santiago, Las Condes, Providencia, Viña del Mar
            y más de 20 ciudades. Contacto directo por WhatsApp y disponibilidad hoy.
          </p>
          <p>
            Usa los filtros de ubicación, servicios y disponibilidad inmediata para encontrar
            exactamente lo que buscas. Todos los perfiles son verificados con fotos reales.
          </p>
        </section>
      )}
      {templateSeo && <SeoCopySection seo={templateSeo} />}
      {/* Perfiles renderizados en servidor para indexación */}
      <DirectorySeoLinks heading={`Perfiles destacados: ${name}`} filter={filter} />
    </>
  );
}

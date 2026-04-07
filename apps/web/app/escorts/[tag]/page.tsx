import { Suspense } from "react";
import type { Metadata } from "next";
import DirectoryPage from "../../../components/DirectoryPage";

type Props = { params: Promise<{ tag: string }> };

// Cities that map to geo landing pages (must match sitemap.ts CITIES)
const CITY_SLUGS: Record<string, string> = {
  santiago: "Santiago",
  "vina-del-mar": "Viña del Mar",
  valparaiso: "Valparaíso",
  concepcion: "Concepción",
  antofagasta: "Antofagasta",
  temuco: "Temuco",
  rancagua: "Rancagua",
  "la-serena": "La Serena",
  arica: "Arica",
  iquique: "Iquique",
  "puerto-montt": "Puerto Montt",
  talca: "Talca",
  chillan: "Chillán",
  osorno: "Osorno",
  "punta-arenas": "Punta Arenas",
  copiapo: "Copiapó",
  calama: "Calama",
  "los-angeles": "Los Ángeles",
  curico: "Curicó",
  providencia: "Providencia",
  "las-condes": "Las Condes",
  nunoa: "Ñuñoa",
  maipu: "Maipú",
  "puente-alto": "Puente Alto",
  "san-bernardo": "San Bernardo",
};

function isCity(tag: string): boolean {
  return tag in CITY_SLUGS;
}

function getCityName(tag: string): string {
  return CITY_SLUGS[tag] || tag.charAt(0).toUpperCase() + tag.slice(1).replace(/-/g, " ");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;

  if (isCity(tag)) {
    const city = getCityName(tag);
    const title = `Escorts en ${city} - Verificadas con Fotos Reales`;
    const description = `Escorts y acompañantes verificadas en ${city}. Fotos reales, contacto directo por WhatsApp y disponibilidad hoy en UZEED.`;
    return {
      title,
      description,
      keywords: [
        `escorts ${city.toLowerCase()}`, `acompañantes ${city.toLowerCase()}`,
        `putas ${city.toLowerCase()}`, `escorts verificadas ${city.toLowerCase()}`,
        `escorts cerca de mi ${city.toLowerCase()}`,
      ],
      alternates: { canonical: `/escorts/${tag}` },
      openGraph: {
        title: `${title} | UZEED`,
        description,
        url: `https://uzeed.cl/escorts/${tag}`,
        type: "website",
        images: [{ url: "https://uzeed.cl/brand/isotipo-new.png", width: 720, height: 720, alt: `UZEED Escorts ${city}` }],
      },
      twitter: {
        card: "summary_large_image",
        title: `${title} | UZEED`,
        description,
        images: ["https://uzeed.cl/brand/isotipo-new.png"],
      },
    };
  }

  const label = tag.charAt(0).toUpperCase() + tag.slice(1).replace(/-/g, " ");
  const title = `Escorts ${label} en Chile - Verificadas Hoy`;
  const description = `Escorts y putas ${label.toLowerCase()} verificadas en Santiago, Viña del Mar y todo Chile. Fotos reales, contacto directo y disponibilidad hoy en UZEED.`;
  return {
    title,
    description,
    alternates: { canonical: `/escorts/${tag}` },
    openGraph: {
      title: `${title} | UZEED`,
      description,
      url: `https://uzeed.cl/escorts/${tag}`,
      type: "website",
      images: [{ url: "https://uzeed.cl/brand/isotipo-new.png", width: 720, height: 720, alt: `UZEED Escorts ${label}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | UZEED`,
      description,
      images: ["https://uzeed.cl/brand/isotipo-new.png"],
    },
  };
}

export default async function EscortsTagPage({ params }: Props) {
  const { tag } = await params;
  const cityMode = isCity(tag);
  const cityName = cityMode ? getCityName(tag) : null;

  /* Special auto-computed filters are handled in DirectoryPage / backend:
     - maduras → tag=maduras passed as ?maduras=true to API (age>=40, never manual)
     - City slugs → shown as city landing page with location-based content
     - All other tags are profileTags or serviceTags
  */
  const isMaduras = tag === "maduras";
  const label = cityMode ? cityName! : tag.charAt(0).toUpperCase() + tag.slice(1);
  const readableTag = tag.replace(/-/g, " ");

  return (
    <>
      <Suspense>
        {isMaduras ? (
          <DirectoryPage
            key={`escort-maduras`}
            entityType="professional"
            categorySlug="escort"
            title={`Escorts ${label}`}
          />
        ) : (
          <DirectoryPage
            key={`escort-${tag}`}
            entityType="professional"
            categorySlug="escort"
            title={cityMode ? `Escorts en ${cityName}` : `Escorts ${label}`}
            tag={cityMode ? undefined : tag}
          />
        )}
      </Suspense>
      {/* Breadcrumb structured data for rich results */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Inicio", item: "https://uzeed.cl" },
            { "@type": "ListItem", position: 2, name: "Escorts", item: "https://uzeed.cl/escorts" },
            { "@type": "ListItem", position: 3, name: cityMode ? `Escorts en ${cityName}` : `Escorts ${label}` },
          ],
        }) }}
      />
      {/* Server-rendered SEO text for long-tail indexing */}
      <section className="max-w-4xl mx-auto px-4 pb-12 pt-8 text-white/60 text-sm leading-relaxed">
        {cityMode ? (
          <>
            <h1 className="text-xl font-bold text-white/80 mb-3">
              Escorts y Acompañantes en {cityName} — Perfiles Verificados
            </h1>
            <p className="mb-4">
              Encuentra escorts y acompañantes verificadas en {cityName}. Perfiles con fotos reales,
              verificación de identidad y contacto directo por WhatsApp. Disponibilidad hoy en UZEED.
            </p>
            <h2 className="text-base font-semibold text-white/70 mb-1">
              ¿Por qué elegir UZEED en {cityName}?
            </h2>
            <p className="mb-4">
              UZEED verifica cada perfil para garantizar fotos reales y datos auténticos.
              Busca por tipo de servicio, disponibilidad inmediata o características específicas.
              Contacta directamente por WhatsApp sin intermediarios.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-white/80 mb-3">
              Escorts y Acompañantes {label} en Chile
            </h1>
            <p className="mb-4">
              Directorio de escorts y acompañantes {readableTag} verificadas en Chile. Encuentra
              perfiles con fotos reales en Santiago, Las Condes, Providencia, Viña del Mar
              y más de 20 ciudades. Contacto directo por WhatsApp y disponibilidad hoy.
            </p>
          </>
        )}
        <p>
          Usa los filtros de ubicación, servicios y disponibilidad inmediata para encontrar
          exactamente lo que buscas. Todos los perfiles son verificados con fotos reales.
        </p>
      </section>
    </>
  );
}

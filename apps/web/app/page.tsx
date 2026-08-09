import type { Metadata } from "next";
import Link from "next/link";
import HomeClient from "./HomeClient";
import { cleanProfileHref } from "../lib/profileUrl";
import { CITY_LANDINGS } from "../lib/cities";

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "https://api.uzeed.cl";

function apiBase(): string {
  return DEFAULT_API.replace(/\/+$/, "");
}

type ProfileLink = {
  id: string;
  username?: string;
  displayName?: string | null;
  city?: string | null;
};

async function fetchFeaturedProfiles(): Promise<ProfileLink[]> {
  try {
    const res = await fetch(
      `${apiBase()}/profiles/discover?sort=featured&limit=20`,
      { next: { revalidate: 600 }, headers: { Accept: "application/json" } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.profiles || []).slice(0, 20);
  } catch {
    return [];
  }
}

export const metadata: Metadata = {
  title: "UZEED: Escorts y experiencias únicas para adultos",
  description:
    "Encuentra las mejores escorts, acompañantes y profesionales en Santiago, Las Condes, Providencia y Viña del Mar. Perfiles verificados con fotos reales, sexo incógnito y disponibilidad hoy en UZEED.",
  keywords: [
    "escorts chile", "acompañantes chile", "escorts santiago", "acompañantes santiago",
    "escorts las condes", "escorts providencia", "escorts viña del mar",
    "acompañantes verificadas", "escorts verificadas",
    "escorts colombianas santiago", "escorts venezolanas santiago",
    "masajistas chile", "moteles chile", "sexshop chile",
    "escorts cerca de mi", "acompañantes cerca de mi",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: "https://uzeed.cl",
    siteName: "UZEED: Escorts y experiencias únicas para adultos",
    title: "UZEED: Escorts y experiencias únicas para adultos",
    description:
      "Encuentra las mejores escorts, acompañantes y profesionales en Santiago, Las Condes y Viña del Mar. Perfiles verificados y disponibilidad hoy.",
    images: [
      {
        url: "https://uzeed.cl/brand/isotipo-new.png",
        width: 720,
        height: 720,
        alt: "UZEED - Escorts y Profesionales en Chile",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UZEED: Escorts y experiencias únicas para adultos",
    description:
      "Encuentra las mejores escorts, acompañantes y profesionales en Santiago y todo Chile. Perfiles verificados y disponibilidad hoy.",
    images: ["https://uzeed.cl/brand/isotipo-new.png"],
  },
};

const homeFaqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "¿Cómo veo quién está cerca de mí?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "El mapa del inicio y la página Cerca piden tu ubicación y muestran los perfiles dentro del radio que elijas, entre 1 y 50 km. Si prefieres no dar tu GPS, puedes elegir la comuna a mano y funciona igual.",
      },
    },
    {
      "@type": "Question",
      name: "¿Qué significa que un perfil esté verificado?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Que UZEED comprobó la identidad de la persona y que las fotos publicadas son suyas. Esos perfiles llevan una insignia visible. Los que además subieron exámenes de salud vigentes aparecen en la sección \"Escorts con exámenes\".",
      },
    },
    {
      "@type": "Question",
      name: "¿Cómo sé quién atiende ahora mismo?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "El punto verde marca a quienes están conectadas en ese momento. El filtro \"Disponible ahora\" deja solo esos perfiles, y el mapa los muestra con el mismo indicador sobre cada pin.",
      },
    },
    {
      "@type": "Question",
      name: "¿Se paga por usar UZEED?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No para quien busca: ver perfiles, usar el mapa y escribir por chat es gratis. Quien quiera publicarse crea su perfil en minutos y arranca con un periodo de prueba sin costo.",
      },
    },
  ],
};

const homeBreadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Inicio", item: "https://uzeed.cl" },
  ],
};

export default async function HomePage() {
  const profiles = await fetchFeaturedProfiles();

  return (
    <>
      <HomeClient />
      {/* Server-rendered SEO content crawlable by Google */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeFaqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(homeBreadcrumbJsonLd) }}
      />
      {/* Enlaces a las landings de comuna. Es el bloque con más peso SEO del
          home: reparte autoridad a las 25 páginas /escorts/{comuna}, que son
          las que compiten por las búsquedas geolocalizadas. */}
      <nav className="mx-auto max-w-4xl px-4 pt-10" aria-label="Escorts por ciudad">
        <h2 className="mb-3 text-base font-semibold text-white/75">Escorts por ciudad</h2>
        <ul className="flex flex-wrap gap-1.5">
          {CITY_LANDINGS.map((city) => (
            <li key={city.slug}>
              <Link
                href={`/escorts/${city.slug}`}
                className="inline-block rounded-lg border border-white/[0.08] px-2.5 py-1 text-[13px] text-white/55 transition hover:border-fuchsia-500/30 hover:text-fuchsia-300"
              >
                Escorts en {city.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="mx-auto max-w-4xl px-4 pb-12 pt-8 text-sm leading-relaxed text-white/55">
        <h2 className="mb-3 text-base font-semibold text-white/75">
          Cómo funciona UZEED
        </h2>
        <p className="mb-4">
          UZEED reúne escorts, acompañantes y masajistas de Chile en un solo directorio.
          Cada perfil se verifica antes de publicarse, muestra sus propias fotos y se
          contacta directo por WhatsApp o por el chat interno. El mapa de cercanía
          ordena los perfiles por distancia real, así que puedes ver en segundos quién
          está a pocas cuadras y conectada en ese momento.
        </p>
        <p className="mb-4">
          Además de escorts y acompañantes hay masajistas (tántrico, nuru y descontracturante),
          moteles con tarifas al día, hospedajes discretos y sex shops con despacho a
          todo el país. Todo se filtra por comuna, servicio, disponibilidad y rango de precio.
        </p>

        <h2 className="mb-3 mt-8 text-base font-semibold text-white/75">Preguntas frecuentes</h2>
        <details className="group mb-3">
          <summary className="cursor-pointer font-medium text-white/70 group-open:text-fuchsia-300">
            ¿Cómo veo quién está cerca de mí?
          </summary>
          <p className="mt-1 pl-4 text-white/50">
            El mapa del inicio y la página Cerca piden tu ubicación y muestran los perfiles
            dentro del radio que elijas, entre 1 y 50 km. Si prefieres no dar tu GPS, puedes
            elegir la comuna a mano y funciona igual.
          </p>
        </details>
        <details className="group mb-3">
          <summary className="cursor-pointer font-medium text-white/70 group-open:text-fuchsia-300">
            ¿Qué significa que un perfil esté verificado?
          </summary>
          <p className="mt-1 pl-4 text-white/50">
            Que UZEED comprobó la identidad de la persona y que las fotos publicadas son
            suyas. Esos perfiles llevan una insignia visible. Los que además subieron
            exámenes de salud vigentes aparecen en la sección &quot;Escorts con exámenes&quot;.
          </p>
        </details>
        <details className="group mb-3">
          <summary className="cursor-pointer font-medium text-white/70 group-open:text-fuchsia-300">
            ¿Cómo sé quién atiende ahora mismo?
          </summary>
          <p className="mt-1 pl-4 text-white/50">
            El punto verde marca a quienes están conectadas en ese momento. El filtro
            &quot;Disponible ahora&quot; deja solo esos perfiles, y el mapa los muestra con el
            mismo indicador sobre cada pin.
          </p>
        </details>
        <details className="group mb-3">
          <summary className="cursor-pointer font-medium text-white/70 group-open:text-fuchsia-300">
            ¿Se paga por usar UZEED?
          </summary>
          <p className="mt-1 pl-4 text-white/50">
            No para quien busca: ver perfiles, usar el mapa y escribir por chat es gratis.
            Quien quiera publicarse crea su perfil en minutos y arranca con un periodo de
            prueba sin costo.
          </p>
        </details>
      </section>

      {/* Server-rendered profile links for Google crawlability */}
      {profiles.length > 0 && (
        <nav className="max-w-4xl mx-auto px-4 pb-12" aria-label="Escorts destacadas">
          <h2 className="mb-2 text-base font-semibold text-white/75">Perfiles destacados</h2>
          <ul className="flex flex-wrap gap-2">
            {profiles.map((p) => (
              <li key={p.id}>
                <Link
                  href={cleanProfileHref({ id: p.id, username: p.username, name: p.displayName || p.username, city: p.city })}
                  className="inline-block rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/60 hover:text-fuchsia-300 hover:border-fuchsia-500/30 transition"
                >
                  {p.displayName || p.username}{p.city ? ` — ${p.city}` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}

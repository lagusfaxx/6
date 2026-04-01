import type { Metadata } from "next";
import Link from "next/link";
import HomeClient from "./HomeClient";

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
    siteName: "UZEED",
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
      name: "¿Cómo encontrar escorts y acompañantes cerca de mí en Chile?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "En UZEED puedes activar tu ubicación para ver escorts y acompañantes cercanas ordenadas por distancia. También puedes filtrar por comuna o ciudad como Santiago, Las Condes, Providencia o Viña del Mar.",
      },
    },
    {
      "@type": "Question",
      name: "¿Las escorts de UZEED son reales y verificadas?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sí, UZEED verifica la identidad de las escorts. Los perfiles verificados tienen una insignia que garantiza fotos reales y perfil auténtico.",
      },
    },
    {
      "@type": "Question",
      name: "¿Qué servicios para adultos ofrece UZEED?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "UZEED ofrece un directorio completo de escorts, masajistas eróticas, moteles, hospedajes, establecimientos para adultos, sex shops y más en todo Chile.",
      },
    },
    {
      "@type": "Question",
      name: "¿UZEED funciona en todo Chile?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sí, UZEED tiene escorts y profesionales en Santiago, Viña del Mar, Valparaíso, Concepción, Antofagasta, Temuco, La Serena, Arica, Iquique, Puerto Montt y todas las principales ciudades de Chile.",
      },
    },
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
      <section className="max-w-4xl mx-auto px-4 pb-12 pt-8 text-white/60 text-sm leading-relaxed">
        <h2 className="text-xl font-bold text-white/80 mb-3">
          Escorts, Acompañantes y Profesionales en Chile — UZEED
        </h2>
        <p className="mb-4">
          UZEED es la plataforma N°1 para encontrar escorts, acompañantes y profesionales en Chile.
          Navega por miles de perfiles verificados con fotos reales en Santiago, Las Condes,
          Providencia, Viña del Mar, Concepción y todo el país. Contacto directo por WhatsApp,
          disponibilidad en tiempo real y verificación de identidad.
        </p>

        <h3 className="text-base font-semibold text-white/70 mb-1">
          Escorts y Acompañantes en Santiago
        </h3>
        <p className="mb-4">
          Encuentra escorts disponibles hoy en Santiago Centro, Las Condes, Providencia, Ñuñoa,
          Maipú, Puente Alto y todas las comunas de la Región Metropolitana. Escorts colombianas,
          venezolanas, chilenas, rubias, morenas, tetonas, culonas y más. Filtra por ubicación,
          servicios, precio y disponibilidad inmediata.
        </p>

        <h3 className="text-base font-semibold text-white/70 mb-1">
          Masajistas, Moteles y Sex Shops
        </h3>
        <p className="mb-4">
          Además de escorts, en UZEED encontrarás masajistas eróticas con masajes tántricos y nuru,
          moteles y hoteles por hora con precios actualizados, hospedajes discretos, establecimientos
          para adultos y sex shops con envío a todo Chile.
        </p>

        <h3 className="text-base font-semibold text-white/70 mb-1">
          Escorts en Regiones de Chile
        </h3>
        <p className="mb-4">
          UZEED tiene cobertura en Viña del Mar, Valparaíso, Concepción, Antofagasta, Temuco,
          La Serena, Arica, Iquique, Puerto Montt, Rancagua, Talca, Chillán, Osorno, Punta Arenas,
          Copiapó, Calama, Los Ángeles, Curicó y más ciudades. Encuentra escorts cerca de ti
          en cualquier región del país.
        </p>

        <h3 className="text-base font-semibold text-white/70 mb-3">Preguntas Frecuentes</h3>
        <details className="mb-3 group">
          <summary className="cursor-pointer font-medium text-white/70 group-open:text-fuchsia-300">
            ¿Cómo encontrar escorts y acompañantes cerca de mí?
          </summary>
          <p className="mt-1 pl-4 text-white/50">
            Activa tu ubicación en UZEED para ver escorts cercanas. También puedes buscar por comuna
            o ciudad específica como Santiago, Las Condes, Providencia o Viña del Mar.
          </p>
        </details>
        <details className="mb-3 group">
          <summary className="cursor-pointer font-medium text-white/70 group-open:text-fuchsia-300">
            ¿Las escorts de UZEED son verificadas?
          </summary>
          <p className="mt-1 pl-4 text-white/50">
            Sí, UZEED tiene un sistema de verificación de identidad. Los perfiles verificados
            muestran una insignia que garantiza fotos reales y perfil auténtico.
          </p>
        </details>
        <details className="mb-3 group">
          <summary className="cursor-pointer font-medium text-white/70 group-open:text-fuchsia-300">
            ¿UZEED tiene escorts disponibles las 24 horas?
          </summary>
          <p className="mt-1 pl-4 text-white/50">
            Sí, muchas escorts ofrecen disponibilidad 24/7. Filtra por &quot;disponible ahora&quot;
            para ver solo las acompañantes que atienden en este momento.
          </p>
        </details>
        <details className="mb-3 group">
          <summary className="cursor-pointer font-medium text-white/70 group-open:text-fuchsia-300">
            ¿UZEED funciona en todo Chile?
          </summary>
          <p className="mt-1 pl-4 text-white/50">
            Sí, UZEED tiene presencia en Santiago, Viña del Mar, Valparaíso, Concepción, Antofagasta,
            Temuco y todas las principales ciudades de Chile.
          </p>
        </details>
      </section>

      {/* Server-rendered profile links for Google crawlability */}
      {profiles.length > 0 && (
        <nav className="max-w-4xl mx-auto px-4 pb-12" aria-label="Escorts destacadas">
          <h3 className="text-base font-semibold text-white/70 mb-2">Escorts Destacadas</h3>
          <ul className="flex flex-wrap gap-2">
            {profiles.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/profesional/${p.id}`}
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

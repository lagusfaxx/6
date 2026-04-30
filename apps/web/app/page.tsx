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
  title: "UZEED: Escorts, chat en vivo, contenido para adultos y más",
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
    siteName: "UZEED: Escorts, chat en vivo, contenido para adultos y más",
    title: "UZEED: Escorts, chat en vivo, contenido para adultos y más",
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
    title: "UZEED: Escorts, chat en vivo, contenido para adultos y más",
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
      name: "¿Cómo encuentro escorts y acompañantes cerca de mí?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Activa tu ubicación en UZEED para ver perfiles cercanos ordenados por distancia. También puedes buscar por ciudad o comuna específica.",
      },
    },
    {
      "@type": "Question",
      name: "¿Las escorts de UZEED son verificadas?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sí, UZEED verifica la identidad de cada profesional. Los perfiles verificados muestran una insignia que garantiza fotos reales y perfil auténtico.",
      },
    },
    {
      "@type": "Question",
      name: "¿Hay escorts disponibles las 24 horas?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sí, muchas escorts ofrecen disponibilidad 24/7. Filtra por \"disponible ahora\" para ver solo las que atienden en este momento.",
      },
    },
    {
      "@type": "Question",
      name: "¿UZEED funciona en todo Chile?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Sí, tenemos cobertura en más de 20 ciudades incluyendo Santiago, Viña del Mar, Valparaíso, Concepción, Antofagasta y Temuco.",
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
      <section className="max-w-4xl mx-auto px-4 pb-12 pt-8 text-white/60 text-sm leading-relaxed">
        <h1 className="text-xl font-bold text-white/80 mb-3">
          Escorts y Acompañantes Verificadas en Chile — UZEED
        </h1>
        <p className="mb-4">
          UZEED es la plataforma líder para encontrar escorts y acompañantes verificadas
          en Chile. Cada perfil cuenta con fotos reales, verificación de identidad y contacto
          directo por WhatsApp. Explora perfiles disponibles hoy en Santiago, Viña del Mar,
          Concepción y más de 20 ciudades del país.
        </p>

        <h3 className="text-base font-semibold text-white/70 mb-1">
          Escorts en Santiago y Regiones
        </h3>
        <p className="mb-4">
          Encuentra escorts disponibles hoy en Santiago Centro, Las Condes, Providencia y toda
          la Región Metropolitana. También hay perfiles activos en Viña del Mar, Valparaíso,
          Concepción, Antofagasta y Temuco. Filtra por ubicación, servicios y disponibilidad.
        </p>

        <h3 className="text-base font-semibold text-white/70 mb-1">
          Más servicios en UZEED
        </h3>
        <p className="mb-4">
          Además de escorts y acompañantes, puedes encontrar masajistas eróticas con
          especialidad en masajes tántricos y nuru, moteles con precios actualizados,
          hospedajes discretos y sex shops con envío a todo Chile.
        </p>

        <h3 className="text-base font-semibold text-white/70 mb-3">Preguntas Frecuentes</h3>
        <details className="mb-3 group">
          <summary className="cursor-pointer font-medium text-white/70 group-open:text-fuchsia-300">
            ¿Cómo encuentro escorts y acompañantes cerca de mí?
          </summary>
          <p className="mt-1 pl-4 text-white/50">
            Activa tu ubicación en UZEED para ver perfiles cercanos ordenados por distancia.
            También puedes buscar por ciudad o comuna específica.
          </p>
        </details>
        <details className="mb-3 group">
          <summary className="cursor-pointer font-medium text-white/70 group-open:text-fuchsia-300">
            ¿Las escorts de UZEED son verificadas?
          </summary>
          <p className="mt-1 pl-4 text-white/50">
            Sí, UZEED verifica la identidad de cada profesional. Los perfiles verificados
            muestran una insignia que garantiza fotos reales y perfil auténtico.
          </p>
        </details>
        <details className="mb-3 group">
          <summary className="cursor-pointer font-medium text-white/70 group-open:text-fuchsia-300">
            ¿Hay escorts disponibles las 24 horas?
          </summary>
          <p className="mt-1 pl-4 text-white/50">
            Sí, muchas escorts ofrecen disponibilidad 24/7. Filtra por &quot;disponible ahora&quot;
            para ver solo las que atienden en este momento.
          </p>
        </details>
        <details className="mb-3 group">
          <summary className="cursor-pointer font-medium text-white/70 group-open:text-fuchsia-300">
            ¿UZEED funciona en todo Chile?
          </summary>
          <p className="mt-1 pl-4 text-white/50">
            Sí, tenemos cobertura en más de 20 ciudades incluyendo Santiago, Viña del Mar,
            Valparaíso, Concepción, Antofagasta y Temuco.
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

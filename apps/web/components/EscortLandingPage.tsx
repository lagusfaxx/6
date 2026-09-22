import type { Metadata } from "next";
import CreadorasClient, { type PublicProfile } from "../app/creadoras/CreadorasClient";
import {
  ESCORT_LANDINGS,
  type EscortLanding,
} from "../lib/escortLandings";

const SITE_URL = "https://uzeed.cl";
const OG_IMAGE = `${SITE_URL}/brand/isotipo-new.png`;

const DEFAULT_API =
  process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "https://api.uzeed.cl";

function apiBase(): string {
  return DEFAULT_API.replace(/\/+$/, "");
}

function absolutizeMedia(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed) return null;
  if (/^(https?:|data:|blob:)/.test(trimmed)) return trimmed;
  const path = trimmed.startsWith("/") ? trimmed : `/uploads/${trimmed}`;
  return `${apiBase()}${path}`;
}

async function fetchFeaturedProfiles(): Promise<PublicProfile[]> {
  try {
    const res = await fetch(
      `${apiBase()}/profiles/discover?sort=featured&limit=18`,
      { next: { revalidate: 600 }, headers: { Accept: "application/json" } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const list: any[] = data?.profiles || [];
    return list.slice(0, 18).map((p) => ({
      id: String(p.id),
      displayName: p.displayName || p.username || "Creadora",
      city: p.city ?? null,
      avatarUrl:
        absolutizeMedia(p.avatarUrl) ?? absolutizeMedia(p.coverUrl) ?? null,
      isVerified: Boolean(p.isVerified),
    }));
  } catch {
    return [];
  }
}

/**
 * Metadata indexable para una landing del lado oferta. Antes /creadoras iba
 * con robots noindex, así que ninguna búsqueda de "trabajar de escort" podía
 * llegar al sitio.
 */
export function buildEscortLandingMetadata(landing: EscortLanding): Metadata {
  const url = `${SITE_URL}/${landing.slug}`;
  return {
    title: landing.title,
    description: landing.metaDescription,
    keywords: landing.keywords,
    alternates: { canonical: `/${landing.slug}` },
    openGraph: {
      title: `${landing.title} | UZEED`,
      description: landing.metaDescription,
      url,
      type: "website",
      locale: "es_CL",
      images: [
        {
          url: OG_IMAGE,
          width: 720,
          height: 720,
          alt: `UZEED — ${landing.eyebrow}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${landing.title} | UZEED`,
      description: landing.metaDescription,
      images: [OG_IMAGE],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    },
  };
}

function jsonLd(landing: EscortLanding) {
  const url = `${SITE_URL}/${landing.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": url,
        url,
        name: landing.title,
        description: landing.metaDescription,
        inLanguage: "es-CL",
        isFamilyFriendly: false,
        about: { "@type": "Thing", name: landing.eyebrow },
        publisher: {
          "@type": "Organization",
          name: "UZEED",
          url: SITE_URL,
          logo: OG_IMAGE,
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: landing.eyebrow, item: url },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: landing.faq.map((f) => ({
          "@type": "Question",
          name: f.question,
          acceptedAnswer: { "@type": "Answer", text: f.answer },
        })),
      },
    ],
  };
}

/**
 * Render compartido de las landings del lado oferta (/creadoras,
 * /trabajar-de-escort, /vender-contenido, /publicar-anuncio-escort). Cada una
 * pasa su propia variante: mismo layout, copy y FAQ distintos para que no se
 * canibalicen entre sí.
 */
export default async function EscortLandingPage({
  landing,
}: {
  landing: EscortLanding;
}) {
  const profiles = await fetchFeaturedProfiles();
  const related = ESCORT_LANDINGS.filter((l) => l.slug !== landing.slug).map(
    (l) => ({ slug: l.slug, eyebrow: l.eyebrow, h1: l.h1 }),
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(landing)) }}
      />
      <CreadorasClient
        profiles={profiles}
        landing={landing}
        related={related}
      />
    </>
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import DirectoryPage from "../../components/DirectoryPage";
import { cleanProfileHref } from "../../lib/profileUrl";
import { getTagLanding } from "../../lib/escortSearchLandings";
import { jsonLdString } from "../../lib/jsonLd";

/**
 * Sección propia de hombres: todos los perfiles masculinos (escorts,
 * masajistas y cualquier otra categoría) en una sola URL indexable. Antes los
 * hombres sólo se veían como un filtro de /escorts (?gender=MALE o
 * /escorts/hombres), que Google trataba como una variante de la página de
 * escorts mujeres. /escorts/hombres redirige acá (next.config.mjs).
 *
 * El copy, título y FAQ son los de la landing "hombres" de
 * lib/escortSearchLandings (con las keywords de Semrush ya sumadas): la página
 * ya rankeaba con ellos y el 301 los trae tal cual.
 */

const DEFAULT_API =
  process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "https://api.uzeed.cl";
const OG_IMAGE = "https://uzeed.cl/brand/isotipo-new.png";
const PATH = "/hombres";

/* La API entrega hasta 120 por página y acepta offset hasta 600. */
const PAGE = 120;
const MAX_OFFSET = 600;

const landing = getTagLanding("hombres")!;

type ProfileSummary = {
  id: string;
  username?: string;
  displayName?: string | null;
  city?: string | null;
  serviceCategory?: string | null;
};

function apiBase(): string {
  return DEFAULT_API.replace(/\/+$/, "");
}

/**
 * Todos los hombres publicados, de cualquier categoría, para listarlos en el
 * HTML del servidor. El grid interactivo (DirectoryPage) se arma en el cliente
 * y le llega vacío al crawler: sin esta lista Google no descubre los perfiles.
 */
async function fetchAllMen(): Promise<ProfileSummary[]> {
  const all: ProfileSummary[] = [];
  const seen = new Set<string>();
  for (let offset = 0; offset <= MAX_OFFSET; offset += PAGE) {
    const qs = new URLSearchParams({
      entityType: "professional",
      gender: "MALE",
      sort: "new",
      limit: String(PAGE),
      offset: String(offset),
    });
    let batch: ProfileSummary[] = [];
    try {
      const res = await fetch(`${apiBase()}/directory/search?${qs}`, {
        next: { revalidate: 600 },
        headers: { Accept: "application/json" },
      });
      if (!res.ok) break;
      const data = await res.json();
      batch = data?.results || [];
    } catch {
      break;
    }
    for (const p of batch) {
      if (p?.id && !seen.has(p.id)) {
        seen.add(p.id);
        all.push(p);
      }
    }
    if (batch.length < PAGE) break;
  }
  return all;
}

export const metadata: Metadata = {
  title: landing.title,
  description: landing.description,
  keywords: landing.keywords,
  alternates: { canonical: PATH },
  openGraph: {
    title: `${landing.title} | UZEED`,
    description: landing.description,
    url: `https://uzeed.cl${PATH}`,
    type: "website",
    images: [{ url: OG_IMAGE, width: 720, height: 720, alt: "UZEED Hombres" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${landing.title} | UZEED`,
    description: landing.description,
    images: [OG_IMAGE],
  },
};

const CATEGORY_LABEL: Record<string, string> = {
  escort: "Escort",
  escorts: "Escort",
  masajes: "Masajista",
  masajistas: "Masajista",
};

function categoryLabel(raw?: string | null): string | null {
  const key = (raw || "").toLowerCase().trim();
  if (!key) return null;
  return CATEGORY_LABEL[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export default async function HombresPage() {
  const men = await fetchAllMen();

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: "https://uzeed.cl" },
      { "@type": "ListItem", position: 2, name: "Hombres", item: `https://uzeed.cl${PATH}` },
    ],
  };
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: landing.faq.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
  const items = men.map((p) => ({
    p,
    href: cleanProfileHref({
      id: p.id,
      username: p.username,
      serviceCategory: p.serviceCategory,
      name: p.displayName || p.username,
      city: p.city,
    }),
  }));
  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Hombres en UZEED",
    numberOfItems: items.length,
    itemListElement: items.map(({ p, href }, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `https://uzeed.cl${href}`,
      name: p.displayName || p.username,
    })),
  };

  return (
    <>
      <Suspense>
        <DirectoryPage
          key="hombres"
          entityType="professional"
          categorySlug=""
          title="Hombres"
          lockedGender="MALE"
          withMap={false}
        />
      </Suspense>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumbJsonLd) }} />
      {landing.faq.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(faqJsonLd) }} />
      )}
      {items.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(itemListJsonLd) }} />
      )}

      <section className="max-w-4xl mx-auto px-4 pb-12 pt-8 text-white/60 text-sm leading-relaxed">
        <h2 className="text-xl font-bold text-white/80 mb-3">{landing.h1}</h2>
        {landing.paragraphs.map((text, i) => (
          <p key={i} className="mb-4">{text}</p>
        ))}
        {landing.faq.length > 0 && (
          <div className="mt-8">
            <h3 className="text-base font-semibold text-white/70 mb-3">Preguntas Frecuentes</h3>
            {landing.faq.map((f, i) => (
              <details key={i} className="mb-3 group">
                <summary className="cursor-pointer font-medium text-white/70 group-open:text-sky-300 transition-colors">
                  {f.question}
                </summary>
                <p className="mt-1 pl-4 text-white/50">{f.answer}</p>
              </details>
            ))}
          </div>
        )}
        {landing.related.length > 0 && (
          <nav className="mt-8" aria-label="Búsquedas relacionadas">
            <h3 className="text-base font-semibold text-white/70 mb-3">Búsquedas relacionadas</h3>
            <ul className="flex flex-wrap gap-2">
              {landing.related.map((r) => (
                <li key={r.href}>
                  <Link
                    href={r.href}
                    className="inline-block rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/60 hover:text-sky-300 hover:border-sky-500/30 transition"
                  >
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </section>

      {/* Todos los hombres publicados, renderizados en servidor para que Google
          los rastree e indexe sin depender del JavaScript del grid. */}
      {items.length > 0 && (
        <nav className="max-w-5xl mx-auto px-4 pb-10" aria-label="Todos los hombres">
          <h2 className="text-lg font-bold text-white/70 mb-3">
            Todos los hombres en UZEED ({items.length})
          </h2>
          <ul className="flex flex-wrap gap-2">
            {items.map(({ p, href }) => {
              const cat = categoryLabel(p.serviceCategory);
              return (
                <li key={p.id}>
                  <Link
                    href={href}
                    className="inline-block rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-white/60 hover:text-sky-300 hover:border-sky-500/30 transition"
                  >
                    {p.displayName || p.username}
                    {cat ? ` · ${cat}` : ""}
                    {p.city ? ` — ${p.city}` : ""}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}

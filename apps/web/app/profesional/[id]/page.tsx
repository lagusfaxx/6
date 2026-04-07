import type { Metadata } from "next";
import ProfileDetailView from "../_components/ProfileDetailView";

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "https://api.uzeed.cl";

function apiBase(): string {
  return DEFAULT_API.replace(/\/+$/, "");
}

type ProfessionalData = {
  id: string;
  username?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  city?: string | null;
  bio?: string | null;
  serviceDescription?: string | null;
  serviceCategory?: string | null;
  heightCm?: number | null;
  age?: number | null;
  hairColor?: string | null;
  baseRate?: number | null;
  profileTags?: string[];
  serviceTags?: string[];
  isActive?: boolean;
};

async function fetchProfessional(id: string): Promise<ProfessionalData | null> {
  try {
    const res = await fetch(`${apiBase()}/professionals/${encodeURIComponent(id)}`, {
      next: { revalidate: 300 }, // Cache 5 min
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.professional ?? data ?? null;
  } catch {
    return null;
  }
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await fetchProfessional(id);

  if (!p) {
    return { title: "Perfil no encontrado | UZEED" };
  }

  const name = p.displayName || p.username || "Profesional";
  const city = p.city || "Chile";
  const category = p.serviceCategory || "Escort";
  const title = `${name} — ${category} en ${city} | UZEED`;
  const descParts = [
    `Perfil verificado de ${name}, ${category.toLowerCase()} en ${city}.`,
    p.bio ? p.bio.slice(0, 120) : null,
    "Fotos reales, contacto directo y disponibilidad en UZEED.",
  ].filter(Boolean);
  const description = descParts.join(" ").slice(0, 300);

  const images = p.avatarUrl
    ? [{ url: p.avatarUrl, width: 400, height: 400, alt: `${name} - ${category} en ${city}` }]
    : [{ url: "https://uzeed.cl/brand/isotipo-new.png", width: 720, height: 720, alt: "UZEED" }];

  return {
    title,
    description,
    keywords: [
      `${category.toLowerCase()} ${city.toLowerCase()}`,
      `escort ${city.toLowerCase()}`,
      `${name.toLowerCase()} escort`,
      `acompañante ${city.toLowerCase()}`,
      `escorts verificadas ${city.toLowerCase()}`,
    ],
    alternates: { canonical: `/profesional/${id}` },
    openGraph: {
      title,
      description,
      url: `https://uzeed.cl/profesional/${id}`,
      type: "profile",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.map((i) => i.url),
    },
  };
}

export default async function ProfessionalDetailPage({ params }: Props) {
  const { id } = await params;
  const p = await fetchProfessional(id);

  const name = p?.displayName || p?.username || "";
  const city = p?.city || "Chile";
  const category = p?.serviceCategory || "Escort";

  // JSON-LD structured data for Google
  const jsonLd = p
    ? {
        "@context": "https://schema.org",
        "@type": "Person",
        name: p.displayName || p.username,
        jobTitle: category,
        address: { "@type": "PostalAddress", addressLocality: city, addressCountry: "CL" },
        ...(p.avatarUrl ? { image: p.avatarUrl } : {}),
        ...(p.bio ? { description: p.bio.slice(0, 300) } : {}),
        url: `https://uzeed.cl/profesional/${id}`,
      }
    : null;

  return (
    <>
      {/* Client-side interactive component */}
      <ProfileDetailView id={id} />

      {/* Server-rendered SEO content (visible to Google, hidden visually via CSS) */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      {p && (
        <section className="max-w-4xl mx-auto px-4 pb-12 pt-8 text-white/60 text-sm leading-relaxed">
          <h1 className="text-xl font-bold text-white/80 mb-3">{name} — {category} en {city}</h1>
          {p.bio && <p className="mb-3">{p.bio}</p>}
          {p.serviceDescription && <p className="mb-3">{p.serviceDescription}</p>}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-white/50 mb-3">
            {p.heightCm && <span>Altura: {p.heightCm} cm</span>}
            {p.age && <span>Edad: {p.age} años</span>}
            {p.hairColor && <span>Cabello: {p.hairColor}</span>}
          </div>
          {p.serviceTags && p.serviceTags.length > 0 && (
            <p className="text-white/50">Servicios: {p.serviceTags.join(", ")}</p>
          )}
        </section>
      )}
    </>
  );
}

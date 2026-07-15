import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import ProfileDetailView from "../../_components/ProfileDetailView";
import { profileSlug } from "../../../../lib/profileUrl";

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

type Props = { params: Promise<{ id: string; slug?: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await fetchProfessional(id);

  if (!p) {
    return { title: "Perfil no encontrado" };
  }

  const name = p.displayName || p.username || "Profesional";
  const city = p.city || "Chile";
  // URL canónica con slug semántico (nombre-ciudad). Si no hay slug computable
  // cae a la UUID sola.
  const slug = profileSlug(p.displayName || p.username, p.city);
  const canonicalPath = slug ? `/profesional/${id}/${slug}` : `/profesional/${id}`;
  const category = p.serviceCategory || "Escort";
  // Sin sufijo "| UZEED": el template del layout (%s | UZEED) ya lo añade al
  // <title>. Para og/twitter usamos brandedTitle porque ahí el template no aplica.
  const title = `${name} — ${category} en ${city}`;
  const brandedTitle = `${title} | UZEED`;
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
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: brandedTitle,
      description,
      url: `https://uzeed.cl${canonicalPath}`,
      type: "profile",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: brandedTitle,
      description,
      images: images.map((i) => i.url),
    },
  };
}

export default async function ProfessionalDetailPage({ params }: Props) {
  const { id, slug } = await params;
  const p = await fetchProfessional(id);

  const name = p?.displayName || p?.username || "";
  const city = p?.city || "Chile";
  const category = p?.serviceCategory || "Escort";

  // Canonicalización: si visitan la UUID desnuda (/profesional/{id}) y existe
  // un slug computable, redirige 308 a la URL semántica. Solo redirige cuando
  // NO viene slug en la ruta → nunca puede entrar en bucle aunque el slug
  // guardado difiera del recalculado.
  const desiredSlug = profileSlug(p?.displayName || p?.username, p?.city);
  if (p && desiredSlug && (!slug || slug.length === 0)) {
    permanentRedirect(`/profesional/${id}/${desiredSlug}`);
  }

  const canonicalUrl = desiredSlug
    ? `https://uzeed.cl/profesional/${id}/${desiredSlug}`
    : `https://uzeed.cl/profesional/${id}`;

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
        url: canonicalUrl,
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
        <section className="sr-only">
          <h1>{name} — {category} en {city}</h1>
          {p.bio && <p>{p.bio}</p>}
          {p.serviceDescription && <p>{p.serviceDescription}</p>}
          {p.heightCm && <p>Altura: {p.heightCm} cm</p>}
          {p.hairColor && <p>Cabello: {p.hairColor}</p>}
          {p.serviceTags && p.serviceTags.length > 0 && (
            <p>Servicios: {p.serviceTags.join(", ")}</p>
          )}
        </section>
      )}
    </>
  );
}

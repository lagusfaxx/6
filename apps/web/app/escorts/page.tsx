import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import DirectoryPage from "../../components/DirectoryPage";
import SeoContent from "../../components/SeoContent";

const DEFAULT_API = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "https://api.uzeed.cl";

function apiBase(): string {
  return DEFAULT_API.replace(/\/+$/, "");
}

type ProfileSummary = {
  id: string;
  username?: string;
  displayName?: string | null;
  city?: string | null;
  serviceCategory?: string | null;
};

async function fetchTopProfiles(): Promise<ProfileSummary[]> {
  try {
    const res = await fetch(
      `${apiBase()}/profiles/discover?sort=featured&limit=24`,
      { next: { revalidate: 600 }, headers: { Accept: "application/json" } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.profiles || []).slice(0, 24);
  } catch {
    return [];
  }
}

export const metadata: Metadata = {
  title: "Escorts y Putas en Chile - Verificadas Hoy | UZEED",
  description:
    "Escorts y putas verificadas en Santiago, Las Condes, Viña del Mar y todo Chile. Fotos reales, contacto directo por WhatsApp y disponibilidad hoy.",
  alternates: { canonical: "/escorts" },
  openGraph: {
    title: "Escorts y Putas en Chile - Verificadas Hoy | UZEED",
    description:
      "Escorts y acompañantes verificadas en Santiago y todo Chile. Fotos reales y contacto directo.",
    url: "https://uzeed.cl/escorts",
    type: "website",
    images: [{ url: "https://uzeed.cl/brand/isotipo-new.png", width: 720, height: 720, alt: "UZEED Escorts Chile" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Escorts y Putas en Chile | UZEED",
    description: "Escorts verificadas con fotos reales en Santiago y todo Chile.",
    images: ["https://uzeed.cl/brand/isotipo-new.png"],
  },
};

export default async function EscortsPage() {
  const profiles = await fetchTopProfiles();

  return (
    <>
      <Suspense>
        <DirectoryPage
          key="escort"
          entityType="professional"
          categorySlug="escort"
          title="Escorts"
        />
      </Suspense>
      <SeoContent variant="escorts" />

      {/* Server-rendered profile links for Google crawlability */}
      {profiles.length > 0 && (
        <nav className="max-w-5xl mx-auto px-4 pb-8" aria-label="Perfiles de escorts">
          <h2 className="text-lg font-bold text-white/70 mb-3" id="escorts-destacadas">Escorts Destacadas en Chile</h2>
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

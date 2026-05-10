import { Suspense } from "react";
import type { Metadata } from "next";
import EstablishmentDetailClient from "./EstablishmentDetailClient";

const DEFAULT_API =
  process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "https://api.uzeed.cl";

function apiBase(): string {
  return DEFAULT_API.replace(/\/+$/, "");
}

type EstablishmentMeta = {
  id?: string;
  name?: string;
  description?: string | null;
  city?: string | null;
  category?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
  rating?: number | null;
  reviewCount?: number;
};

async function fetchEstablishment(id: string): Promise<EstablishmentMeta | null> {
  try {
    const res = await fetch(
      `${apiBase()}/establishments/${encodeURIComponent(id)}`,
      {
        next: { revalidate: 600 },
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.establishment ?? data ?? null;
  } catch {
    return null;
  }
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const e = await fetchEstablishment(id);

  const name = e?.name || "Establecimiento";
  const city = e?.city || "Chile";
  const category = e?.category || "Establecimiento para adultos";
  const title = `${name} — ${category} en ${city} | UZEED`;
  const description =
    e?.description?.slice(0, 200) ??
    `${name} en ${city}. ${category} con fotos reales, precios y horarios actualizados en UZEED.`;

  const image = e?.coverUrl || e?.avatarUrl || "/brand/isotipo-new.png";

  return {
    title,
    description,
    alternates: { canonical: `/establecimiento/${id}` },
    openGraph: {
      title,
      description,
      url: `/establecimiento/${id}`,
      type: "website",
      images: [{ url: image, alt: `${name} - ${category} en ${city}` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default function EstablishmentDetailPage() {
  return (
    <Suspense fallback={<div className="text-white/60">Cargando establecimiento...</div>}>
      <EstablishmentDetailClient />
    </Suspense>
  );
}

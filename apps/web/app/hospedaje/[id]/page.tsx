import { Suspense } from "react";
import type { Metadata } from "next";
import HospedajeDetailClient from "./HospedajeDetailClient";

const DEFAULT_API =
  process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "https://api.uzeed.cl";

function apiBase(): string {
  return DEFAULT_API.replace(/\/+$/, "");
}

type Detail = {
  id?: string;
  name?: string;
  city?: string | null;
  address?: string | null;
  rules?: string | null;
  coverUrl?: string | null;
  avatarUrl?: string | null;
  rating?: number | null;
  reviewsCount?: number;
};

async function fetchDetail(id: string): Promise<Detail | null> {
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
  const d = await fetchDetail(id);

  const name = d?.name || "Hospedaje";
  const city = d?.city || "Chile";
  const title = `${name} — Hospedaje y motel en ${city} | UZEED`;
  const description =
    d?.rules?.slice(0, 200) ??
    `${name} en ${city}. Motel y hospedaje con habitaciones, fotos reales, precios y disponibilidad en UZEED.`;

  const image = d?.coverUrl || d?.avatarUrl || "/brand/isotipo-new.png";

  return {
    title,
    description,
    alternates: { canonical: `/hospedaje/${id}` },
    openGraph: {
      title,
      description,
      url: `/hospedaje/${id}`,
      type: "website",
      images: [{ url: image, alt: `${name} - Motel y hospedaje en ${city}` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default function HospedajeDetailPage() {
  return (
    <Suspense fallback={<div className="text-white/60">Cargando hospedaje...</div>}>
      <HospedajeDetailClient />
    </Suspense>
  );
}

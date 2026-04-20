import type { Metadata } from "next";
import CreadorasClient, { type PublicProfile } from "./CreadorasClient";

export const metadata: Metadata = {
  title: "Únete a UZEED — Onboarding para creadoras",
  description:
    "Regístrate en UZEED, la plataforma chilena donde conectas con clientes reales, decides tus tarifas y manejas tu perfil con total privacidad.",
  alternates: { canonical: "/creadoras" },
  openGraph: {
    title: "Únete a UZEED — La plataforma para creadoras en Chile",
    description:
      "Perfil verificado, contacto directo con clientes, control de tu agenda y tus tarifas. Regístrate gratis y publica en minutos.",
    url: "https://uzeed.cl/creadoras",
    type: "website",
  },
  robots: { index: false, follow: false },
};

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

export default async function CreadorasPage() {
  const profiles = await fetchFeaturedProfiles();
  return <CreadorasClient profiles={profiles} />;
}


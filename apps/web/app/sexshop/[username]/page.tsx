import { Suspense } from "react";
import type { Metadata } from "next";
import SexShopProfileClient from "./SexShopProfileClient";

const DEFAULT_API =
  process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "https://api.uzeed.cl";

function apiBase(): string {
  return DEFAULT_API.replace(/\/+$/, "");
}

type ShopData = {
  username?: string;
  displayName?: string | null;
  bio?: string | null;
  city?: string | null;
  avatarUrl?: string | null;
  coverUrl?: string | null;
};

async function fetchShop(username: string): Promise<ShopData | null> {
  try {
    const res = await fetch(
      `${apiBase()}/shops/${encodeURIComponent(username)}`,
      {
        next: { revalidate: 600 },
        headers: { Accept: "application/json" },
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.shop ?? data ?? null;
  } catch {
    return null;
  }
}

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const shop = await fetchShop(username);

  const name = shop?.displayName || shop?.username || username;
  const city = shop?.city || "Chile";
  const title = `${name} — Sex Shop en ${city} | UZEED`;
  const description =
    shop?.bio?.slice(0, 200) ??
    `Tienda erótica ${name} en ${city}. Juguetes, lencería y accesorios para adultos con envío discreto en UZEED.`;

  const image =
    shop?.coverUrl ||
    shop?.avatarUrl ||
    "/brand/isotipo-new.png";

  return {
    title,
    description,
    alternates: { canonical: `/sexshop/${username}` },
    openGraph: {
      title,
      description,
      url: `/sexshop/${username}`,
      type: "website",
      images: [{ url: image, alt: `${name} - Sex Shop` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default function SexShopProfilePage() {
  return (
    <Suspense fallback={<div className="text-white/60">Cargando sex shop...</div>}>
      <SexShopProfileClient />
    </Suspense>
  );
}

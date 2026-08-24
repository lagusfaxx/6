"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, MapPin, Star, Store, Truck, Zap } from "lucide-react";

import { apiFetch, friendlyErrorMessage, resolveMediaUrl } from "../../../../lib/api";
import { PRODUCT_TYPE_EMOJI, PRODUCT_TYPE_LABEL, formatClp, type MarketProduct } from "../../../../lib/marketplace";

type StoreData = {
  seller: {
    id: string;
    storeName: string | null;
    tagline: string | null;
    bio: string | null;
    region: string | null;
    totalSales: number;
    acceptsShipping: boolean;
    acceptsMeet: boolean;
    user: { id: string; username: string; displayName: string | null; avatarUrl: string | null; city: string | null; isVerified: boolean };
  };
  products: MarketProduct[];
};

export default function StoreClient({ username }: { username: string }) {
  const [data, setData] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await apiFetch<StoreData>(`/market/sellers/${encodeURIComponent(username)}`));
    } catch (err: any) {
      setError(friendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center text-white/50">Cargando tienda...</div>;
  if (!data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm text-white/60">{error || "Esta tienda no está disponible."}</p>
        <Link href="/marketplace" className="mt-4 inline-block text-sm font-semibold text-fuchsia-300">Volver al marketplace</Link>
      </div>
    );
  }

  const { seller, products } = data;

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-10">
      <Link href="/marketplace" className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Marketplace
      </Link>

      <header className="border-b border-white/[0.07] pb-5">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolveMediaUrl(seller.user.avatarUrl) || "/brand/isotipo-new.png"} alt="" className="h-16 w-16 rounded-2xl object-cover" />
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1.5 truncate text-xl font-semibold text-white sm:text-2xl">
              {seller.storeName || seller.user.displayName || seller.user.username}
              {seller.user.isVerified && <BadgeCheck className="h-4 w-4 shrink-0 text-sky-400" />}
            </h1>
            {seller.tagline && <p className="truncate text-sm text-white/55">{seller.tagline}</p>}
            <p className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-white/40">
              {seller.user.city && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {seller.user.city}</span>}
              <span className="flex items-center gap-1"><Star className="h-3 w-3" /> {seller.totalSales} ventas</span>
              {seller.acceptsShipping && <span className="flex items-center gap-1"><Truck className="h-3 w-3" /> Envíos</span>}
            </p>
          </div>
          <Link
            href={`/perfil/${seller.user.username}`}
            className="hidden shrink-0 rounded-lg px-3 py-2 text-sm text-white/55 transition hover:bg-white/[0.06] hover:text-white sm:block"
          >
            Ver perfil
          </Link>
        </div>
        {seller.bio && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-white/60">{seller.bio}</p>}
      </header>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-white/70">Artículos</h2>
        {products.length === 0 ? (
          <p className="py-14 text-center text-sm text-white/45">Esta tienda todavía no tiene artículos publicados.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => {
              const cover = resolveMediaUrl(product.coverUrl || product.media[0]?.thumbnailUrl || product.media[0]?.url);
              return (
                <Link
                  key={product.id}
                  href={`/marketplace/producto/${product.id}`}
                  className="group"
                >
                  <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-black/40">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt={product.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl">{PRODUCT_TYPE_EMOJI[product.type]}</div>
                    )}
                    {product.autoDeliver && product.deliveryMethods.includes("DIGITAL") && (
                      <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white/85 backdrop-blur">
                        <Zap className="h-2.5 w-2.5 text-emerald-300" /> Al instante
                      </span>
                    )}
                  </div>
                  <div className="pt-2">
                    <p className="truncate text-sm font-medium text-white">{product.title}</p>
                    <p className="text-[11px] text-white/40">{PRODUCT_TYPE_LABEL[product.type]}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{formatClp(product.priceClp)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

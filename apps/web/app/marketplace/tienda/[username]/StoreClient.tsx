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

      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-600/15 via-violet-600/10 to-transparent p-5 sm:p-6">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={resolveMediaUrl(seller.user.avatarUrl) || "/brand/isotipo-new.png"} alt="" className="h-16 w-16 rounded-2xl object-cover" />
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-1.5 truncate text-xl font-bold text-white sm:text-2xl">
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
            className="hidden shrink-0 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white sm:block"
          >
            Ver perfil
          </Link>
        </div>
        {seller.bio && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-white/60">{seller.bio}</p>}
      </header>

      <section className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
          <Store className="h-5 w-5 text-fuchsia-300" /> Artículos
        </h2>
        {products.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-sm text-white/50">
            Esta tienda todavía no tiene artículos publicados.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => {
              const cover = resolveMediaUrl(product.coverUrl || product.media[0]?.thumbnailUrl || product.media[0]?.url);
              return (
                <Link
                  key={product.id}
                  href={`/marketplace/producto/${product.id}`}
                  className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition hover:border-fuchsia-500/30"
                >
                  <div className="relative aspect-[3/4] bg-black/40">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt={product.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-3xl">{PRODUCT_TYPE_EMOJI[product.type]}</div>
                    )}
                    {product.autoDeliver && product.deliveryMethods.includes("DIGITAL") && (
                      <span className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-emerald-500/85 px-2 py-1 text-[10px] font-bold text-white">
                        <Zap className="h-3 w-3" /> Al instante
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold text-white">{product.title}</p>
                    <p className="text-[10px] text-white/40">{PRODUCT_TYPE_LABEL[product.type]}</p>
                    <p className="mt-1 text-base font-bold text-fuchsia-300">{formatClp(product.priceClp)}</p>
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

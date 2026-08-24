"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search, ShieldCheck, Truck, Zap, Store,
  Star, ArrowRight, PackageOpen, Filter, X, BadgeCheck, Camera,
} from "lucide-react";

import useMe from "../../hooks/useMe";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import {
  PRODUCT_TYPE_EMOJI, formatClp,
  type MarketConfig, type MarketProduct, type MarketProductType,
} from "../../lib/marketplace";

type SellerRow = {
  id: string;
  storeName: string | null;
  tagline: string | null;
  region: string | null;
  totalSales: number;
  productCount: number;
  user: { id: string; username: string; displayName: string | null; avatarUrl: string | null; city: string | null; isVerified: boolean };
};

const TYPE_FILTERS: Array<{ value: "ALL" | MarketProductType; label: string }> = [
  { value: "ALL", label: "Todo" },
  { value: "PHOTO_SET", label: "Packs de fotos" },
  { value: "VIDEO", label: "Videos" },
  { value: "CLOTHING", label: "Ropa" },
  { value: "FETISH", label: "Fetiches" },
  { value: "CUSTOM", label: "Personalizado" },
];

const SORTS = [
  { value: "recent", label: "Más recientes" },
  { value: "popular", label: "Más vendidos" },
  { value: "price_asc", label: "Menor precio" },
  { value: "price_desc", label: "Mayor precio" },
];

export default function MarketplaceClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { me } = useMe();

  const [config, setConfig] = useState<MarketConfig | null>(null);
  const [products, setProducts] = useState<MarketProduct[]>([]);
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState(searchParams.get("q") || "");
  const [type, setType] = useState<string>(searchParams.get("type") || "ALL");
  const [sort, setSort] = useState<string>(searchParams.get("sort") || "recent");
  const [showFilters, setShowFilters] = useState(false);

  const isProfessional = String(me?.user?.profileType || "").toUpperCase() === "PROFESSIONAL";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (type !== "ALL") params.set("type", type);
      params.set("sort", sort);
      params.set("limit", "36");

      const [cfg, cat, sell] = await Promise.all([
        apiFetch<MarketConfig>("/market/config"),
        apiFetch<{ products: MarketProduct[]; total: number }>(`/market/products?${params.toString()}`),
        apiFetch<{ sellers: SellerRow[] }>("/market/sellers?limit=12"),
      ]);
      setConfig(cfg);
      setProducts(cat.products);
      setTotal(cat.total);
      setSellers(sell.sellers);
    } catch (err: any) {
      setError(err?.message || "No pudimos cargar el marketplace");
    } finally {
      setLoading(false);
    }
  }, [q, sort, type]);

  useEffect(() => {
    const timer = window.setTimeout(load, q ? 350 : 0);
    return () => window.clearTimeout(timer);
  }, [load, q]);

  const applyFilter = (nextType: string) => {
    setType(nextType);
    const params = new URLSearchParams(searchParams.toString());
    if (nextType === "ALL") params.delete("type");
    else params.set("type", nextType);
    router.replace(`/marketplace${params.toString() ? `?${params}` : ""}`, { scroll: false });
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-4 sm:py-8">
      {/* ── Cabecera de la tienda ──
         Sin discurso de venta: quien entra viene a mirar productos, así que el
         buscador y el catálogo tienen que quedar arriba. */}
      <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-white/[0.07] pb-4">
        <div>
          <h1 className="text-xl font-semibold text-white sm:text-2xl">Marketplace</h1>
          <p className="mt-1 text-sm text-white/45">
            Packs, videos, ropa y artículos que venden las profesionales.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/marketplace/compras"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/60 transition hover:bg-white/[0.06] hover:text-white"
          >
            <PackageOpen className="h-4 w-4" /> Mis compras
          </Link>
          <Link
            href="/marketplace/vender"
            className="inline-flex items-center gap-1.5 rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-2 text-sm font-medium text-fuchsia-200 transition hover:bg-fuchsia-500/20"
          >
            <Store className="h-4 w-4" />
            {isProfessional ? "Mi tienda" : "Vender"}
          </Link>
        </div>
      </header>

      {/* ── Buscador y filtros ── */}
      <section className="mt-6 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Busca packs, ropa, videos..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-9 text-sm text-white placeholder-white/30 outline-none transition focus:border-fuchsia-500/40"
            />
            {q && (
              <button type="button" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white/70 transition hover:bg-white/[0.08]"
          >
            <Filter className="h-4 w-4" /> Orden
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-2">
            {SORTS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSort(option.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  sort === option.value ? "bg-fuchsia-500/20 text-fuchsia-200" : "bg-white/[0.04] text-white/60 hover:bg-white/[0.08]"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {TYPE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => applyFilter(filter.value)}
              className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                type === filter.value
                  ? "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.07]"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-white/30">
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            Pago retenido hasta que confirmas{config ? ` o ${config.holdDays} días` : ""}
          </span>
          <span aria-hidden>·</span>
          <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Fotos y videos al instante</span>
          <span aria-hidden>·</span>
          <span className="flex items-center gap-1"><Truck className="h-3 w-3" /> Envíos a todo Chile</span>
        </p>
      </section>

      {/* ── Catálogo ── */}
      <section className="mt-6">
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-white/[0.04]" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center">
            <Camera className="mx-auto mb-3 h-8 w-8 text-white/20" />
            <p className="text-sm text-white/60">Todavía no hay artículos publicados con esos filtros.</p>
            <Link href="/marketplace/vender" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-fuchsia-300">
              Publica el primero <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-white/40">{total} artículo{total === 1 ? "" : "s"} disponibles</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── Tiendas ──
         Fila que se desliza, como los destacados de cualquier tienda: ocupa
         poco y no corta la página en dos. */}
      {sellers.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-sm font-semibold text-white/70">Tiendas con más ventas</h2>
          <div className="-mx-3 flex gap-5 overflow-x-auto px-3 pb-2 sm:mx-0 sm:px-0">
            {sellers.map((seller) => (
              <Link
                key={seller.id}
                href={`/marketplace/tienda/${seller.user.username}`}
                className="group w-20 shrink-0 text-center"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveMediaUrl(seller.user.avatarUrl) || "/brand/isotipo-new.png"}
                  alt=""
                  className="h-20 w-20 rounded-full object-cover ring-1 ring-white/10 transition group-hover:ring-fuchsia-400/50"
                />
                <p className="mt-1.5 flex items-center justify-center gap-0.5 truncate text-[11px] text-white/70">
                  <span className="truncate">{seller.storeName || seller.user.displayName || seller.user.username}</span>
                  {seller.user.isVerified && <BadgeCheck className="h-3 w-3 shrink-0 text-sky-400" />}
                </p>
                <p className="truncate text-[10px] text-white/30">{seller.productCount} artículos</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Nota de cierre: lo justo para explicar el resguardo del pago, en texto
         corrido. El detalle completo vive en el centro de ayuda. */}
      <p className="mt-10 border-t border-white/[0.07] pt-5 text-xs leading-relaxed text-white/35">
        Pagas dentro de UZEED y el dinero queda retenido hasta que marcas el pedido como recibido
        {config ? `, o pasados ${config.holdDays} días` : ""}. Lo digital llega al instante y protegido; lo físico se
        envía o se coordina por el chat del pedido.{" "}
        <Link href="/ayuda/marketplace" className="text-white/55 underline underline-offset-2 hover:text-white">
          Cómo funciona
        </Link>
      </p>
    </div>
  );
}

function ProductCard({ product }: { product: MarketProduct }) {
  const cover = resolveMediaUrl(product.coverUrl || product.media[0]?.thumbnailUrl || product.media[0]?.url);

  return (
    <Link
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
        <p className="mt-0.5 truncate text-[11px] text-white/40">
          {product.seller?.storeName || product.seller?.displayName || product.seller?.username}
        </p>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">{formatClp(product.priceClp)}</span>
          {product.ratingCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-amber-300">
              <Star className="h-3 w-3 fill-amber-300" /> {product.ratingAvg?.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

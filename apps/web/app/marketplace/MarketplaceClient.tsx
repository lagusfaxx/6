"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ShoppingBag, Search, Sparkles, ShieldCheck, Truck, Zap, Store,
  Star, ArrowRight, PackageOpen, Filter, X, BadgeCheck, Camera,
} from "lucide-react";

import useMe from "../../hooks/useMe";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import {
  DELIVERY_LABEL, PRODUCT_TYPE_EMOJI, PRODUCT_TYPE_LABEL, formatClp,
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

  const heroStats = useMemo(
    () => [
      { icon: ShieldCheck, label: "Pago protegido", value: `Se libera al confirmar${config ? ` o a los ${config.holdDays} días` : ""}` },
      { icon: Zap, label: "Entrega automática", value: "Fotos y videos al instante" },
      { icon: Truck, label: "Envíos a todo Chile", value: "Tarifa según tu región" },
    ],
    [config],
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-4 sm:py-10">
      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-fuchsia-600/20 via-violet-600/10 to-transparent p-6 sm:p-10">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-fuchsia-200">
            <ShoppingBag className="h-3.5 w-3.5" /> Marketplace
          </span>
          <h1 className="mt-3 max-w-2xl text-2xl font-bold leading-tight text-white sm:text-4xl">
            Compra directo a la profesional, sin salir de UZEED
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-white/60 sm:text-base">
            Packs de fotos, videos, ropa y artículos personales. Pagas dentro de la plataforma, el dinero queda retenido
            hasta que confirmas que recibiste, y el contenido digital te llega protegido en tu cuenta.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {heroStats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-white">
                  <stat.icon className="h-4 w-4 text-fuchsia-300" />
                  {stat.label}
                </div>
                <p className="mt-1 text-[11px] text-white/50">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href="/marketplace/compras"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.12]"
            >
              <PackageOpen className="h-4 w-4" /> Mis compras
            </Link>
            <Link
              href="/marketplace/vender"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition hover:brightness-110"
            >
              <Store className="h-4 w-4" />
              {isProfessional ? "Vender mis artículos" : "Quiero vender"}
            </Link>
          </div>
        </div>
      </section>

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
          <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
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
      </section>

      {/* ── Catálogo ── */}
      <section className="mt-6">
        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">{error}</div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
            <Camera className="mx-auto mb-3 h-8 w-8 text-white/25" />
            <p className="text-sm text-white/60">Todavía no hay artículos publicados con esos filtros.</p>
            <Link href="/marketplace/vender" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-fuchsia-300">
              Publica el primero <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-white/40">{total} artículo{total === 1 ? "" : "s"} disponibles</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── Tiendas ── */}
      {sellers.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-white">
            <Sparkles className="h-5 w-5 text-fuchsia-300" /> Tiendas destacadas
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sellers.map((seller) => (
              <Link
                key={seller.id}
                href={`/marketplace/tienda/${seller.user.username}`}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3 transition hover:bg-white/[0.05]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveMediaUrl(seller.user.avatarUrl) || "/brand/isotipo-new.png"}
                  alt=""
                  className="h-12 w-12 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm font-semibold text-white">
                    {seller.storeName || seller.user.displayName || seller.user.username}
                    {seller.user.isVerified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-400" />}
                  </p>
                  <p className="truncate text-[11px] text-white/45">
                    {seller.tagline || `${seller.productCount} artículo${seller.productCount === 1 ? "" : "s"}`}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-white/30" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Cómo funciona ── */}
      <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.02] p-5 sm:p-8">
        <h2 className="text-lg font-bold text-white">Cómo funciona</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { step: "1", title: "Eliges y pagas", text: "Compras en la plataforma con la pasarela o por transferencia. Nada de acuerdos por fuera." },
            { step: "2", title: "Recibes tu pedido", text: "El contenido digital llega al instante y protegido; lo físico se envía o se coordina contigo." },
            { step: "3", title: "Confirmas la entrega", text: `Marcas "recibido" y recién ahí se libera el pago a la vendedora${config ? `, o solo a los ${config.holdDays} días` : ""}.` },
          ].map((item) => (
            <div key={item.step} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fuchsia-500/20 text-sm font-bold text-fuchsia-200">
                {item.step}
              </span>
              <p className="mt-2 text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/50">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProductCard({ product }: { product: MarketProduct }) {
  const cover = resolveMediaUrl(product.coverUrl || product.media[0]?.thumbnailUrl || product.media[0]?.url);

  return (
    <Link
      href={`/marketplace/producto/${product.id}`}
      className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] transition hover:border-fuchsia-500/30 hover:bg-white/[0.05]"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-black/40">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={product.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl">{PRODUCT_TYPE_EMOJI[product.type]}</div>
        )}
        <span className="absolute left-2 top-2 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur">
          {PRODUCT_TYPE_EMOJI[product.type]} {PRODUCT_TYPE_LABEL[product.type]}
        </span>
        {product.autoDeliver && product.deliveryMethods.includes("DIGITAL") && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-emerald-500/85 px-2 py-1 text-[10px] font-bold text-white">
            <Zap className="h-3 w-3" /> Al instante
          </span>
        )}
      </div>

      <div className="p-3">
        <p className="truncate text-sm font-semibold text-white">{product.title}</p>
        <p className="mt-0.5 truncate text-[11px] text-white/45">
          {product.seller?.storeName || product.seller?.displayName || product.seller?.username}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-base font-bold text-fuchsia-300">{formatClp(product.priceClp)}</span>
          {product.ratingCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-amber-300">
              <Star className="h-3 w-3 fill-amber-300" /> {product.ratingAvg?.toFixed(1)}
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-[10px] text-white/35">
          {product.deliveryMethods.map((m) => DELIVERY_LABEL[m]).join(" · ")}
        </p>
      </div>
    </Link>
  );
}

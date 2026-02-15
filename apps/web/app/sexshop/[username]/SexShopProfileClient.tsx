"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";

/* ── Types ── */
type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  media: { id: string; url: string; pos: number }[];
  shopCategory?: { id: string; slug: string; name: string } | null;
};

type Profile = {
  id: string;
  name: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  city: string | null;
  address: string | null;
  bio: string | null;
};

type CartItem = { id: string; name: string; price: number; qty: number; category: string };
type FlyToken = { id: number; x: number; y: number; toX: number; toY: number };

/* ── Animation variants ── */
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};

const cardPop = {
  hidden: { opacity: 0, scale: 0.95, y: 12 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

/* ── Product image with skeleton loader ── */
function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-neutral-800 to-neutral-900">
      {!loaded && src ? (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/5 to-white/10" />
      ) : null}
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 ${loaded ? "opacity-100 scale-100" : "opacity-0 scale-105"}`}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-white/20">
            <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[10px] font-medium">Sin imagen</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SexShopProfileClient() {
  const params = useParams<{ username: string }>();
  const username = params?.username as string;
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [flyTokens, setFlyTokens] = useState<FlyToken[]>([]);
  const [cartPulse, setCartPulse] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const cartButtonRef = useRef<HTMLButtonElement | null>(null);
  const categoriesRef = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    setLoading(true);
    apiFetch<any>(`/profiles/${username}`)
      .then(async (res) => {
        const p = res?.profile;
        if (!p?.id) return;
        setShopId(p.id);
        setProfile({
          id: p.id,
          name: p.displayName || p.username,
          avatarUrl: p.avatarUrl || null,
          coverUrl: p.coverUrl || null,
          city: p.city || null,
          address: p.address || null,
          bio: p.bio || null,
        });
        const prod = await apiFetch<{ products: Product[] }>(`/shop/sexshops/${p.id}/products`);
        setProducts(prod.products || []);
      })
      .finally(() => setLoading(false));
  }, [username]);

  const total = useMemo(() => cart.reduce((acc, c) => acc + c.price * c.qty, 0), [cart]);
  const cartItemsCount = useMemo(() => cart.reduce((acc, item) => acc + item.qty, 0), [cart]);

  /* Categories list */
  const categoryNames = useMemo(() => {
    const set = new Set<string>();
    for (const p of products) set.add(p.shopCategory?.name || "General");
    return Array.from(set);
  }, [products]);

  /* Filtered + grouped products */
  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.shopCategory?.name && p.shopCategory.name.toLowerCase().includes(q))
      );
    }
    if (activeCategory) {
      filtered = filtered.filter((p) => (p.shopCategory?.name || "General") === activeCategory);
    }
    return filtered;
  }, [products, search, activeCategory]);

  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    for (const product of filteredProducts) {
      const key = product.shopCategory?.name || "General";
      if (!groups[key]) groups[key] = [];
      groups[key].push(product);
    }
    return Object.entries(groups);
  }, [filteredProducts]);

  useEffect(() => {
    if (!cartItemsCount) return;
    setCartPulse(true);
    const timeout = window.setTimeout(() => setCartPulse(false), 350);
    return () => window.clearTimeout(timeout);
  }, [cartItemsCount]);

  function addToCart(p: Product, evt?: MouseEvent<HTMLButtonElement>) {
    const category = p.shopCategory?.name || "General";
    setCart((prev) => {
      const found = prev.find((i) => i.id === p.id);
      if (found) return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1, category }];
    });

    if (!evt || !cartButtonRef.current) return;
    const fromRect = evt.currentTarget.getBoundingClientRect();
    const toRect = cartButtonRef.current.getBoundingClientRect();
    const tokenId = Date.now() + Math.random();
    setFlyTokens((prev) => [
      ...prev,
      {
        id: tokenId,
        x: fromRect.left + fromRect.width / 2,
        y: fromRect.top + fromRect.height / 2,
        toX: toRect.left + toRect.width / 2,
        toY: toRect.top + toRect.height / 2,
      },
    ]);
    window.setTimeout(() => {
      setFlyTokens((prev) => prev.filter((token) => token.id !== tokenId));
    }, 500);
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id !== id) return item;
          return { ...item, qty: item.qty + delta };
        })
        .filter((item) => item.qty > 0)
    );
  }

  function chatDraftFromCart() {
    if (!cart.length) return "Hola, me interesa un producto de tu tienda.";
    const lines = cart.map((c) => `- ${c.name} x${c.qty} ($${(c.price * c.qty).toLocaleString("es-CL")})`).join("\n");
    return `Hola, quiero enviar este pedido:\n${lines}\nTotal referencial: $${total.toLocaleString("es-CL")}\n(Coordinemos entrega y pago por aquí).`;
  }

  const currentHour = new Date().getHours();
  const isOpenNow = currentHour >= 10 && currentHour < 23;

  /* Cart item count for specific product */
  function cartQty(productId: string) {
    return cart.find((c) => c.id === productId)?.qty || 0;
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-fuchsia-500/20 border-t-fuchsia-500" />
          <p className="text-sm text-white/60">Cargando tienda...</p>
        </div>
      </div>
    );
  }

  /* ── Not found ── */
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-white/[0.02] p-8 text-center"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
            <svg className="h-8 w-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-white">Tienda no encontrada</h2>
          <p className="text-sm text-white/60">No pudimos encontrar la tienda que buscas.</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black pb-8 text-white md:pb-12">
      {/* ── Sticky header ── */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-40 border-b border-white/10 bg-black/95 px-4 py-3 backdrop-blur-xl md:px-6"
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-white/5 active:bg-white/10"
            aria-label="Volver"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="max-w-[50%] truncate text-base font-semibold text-white">{profile.name}</span>
          <button
            ref={cartButtonRef}
            onClick={() => setSheetOpen(true)}
            className={`relative flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 transition-all duration-300 hover:from-fuchsia-500/30 hover:to-violet-500/30 ${cartPulse ? "scale-110" : "scale-100"}`}
            aria-label="Carrito"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <AnimatePresence>
              {cartItemsCount > 0 && (
                <motion.span
                  key={cartItemsCount}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-[10px] font-bold shadow-lg shadow-fuchsia-500/30"
                >
                  {cartItemsCount}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </motion.div>

      {/* ── Hero section ── */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative mb-6 h-[42vh] min-h-[340px] overflow-hidden"
      >
        {profile.coverUrl ? (
          <img
            src={resolveMediaUrl(profile.coverUrl) ?? undefined}
            alt={profile.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/30 via-violet-600/20 to-purple-900/40">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(168,85,247,0.15),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(217,70,239,0.15),transparent_50%)]" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

        {/* Avatar */}
        {profile.avatarUrl && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-6 top-6 md:left-8 md:top-8"
          >
            <img
              src={resolveMediaUrl(profile.avatarUrl) ?? undefined}
              alt={`${profile.name} logo`}
              className="h-16 w-16 rounded-2xl border-2 border-white/20 bg-black/40 object-cover shadow-2xl backdrop-blur-sm md:h-20 md:w-20"
            />
          </motion.div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          <div className="mx-auto max-w-5xl">
            <motion.div
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {/* Status badge */}
              <motion.div custom={0} variants={fadeUp} className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium backdrop-blur-md ${
                    isOpenNow
                      ? "border-emerald-400/30 bg-emerald-500/20 text-emerald-100"
                      : "border-red-400/30 bg-red-500/20 text-red-100"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isOpenNow
                        ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                        : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]"
                    }`}
                  />
                  {isOpenNow ? "Abierto ahora" : "Cerrado"}
                </span>
                {products.length > 0 && (
                  <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-white/60 backdrop-blur-sm">
                    {products.length} {products.length === 1 ? "producto" : "productos"}
                  </span>
                )}
              </motion.div>

              {/* Title */}
              <motion.h1 custom={1} variants={fadeUp} className="text-3xl font-bold tracking-tight md:text-5xl">
                {profile.name}
              </motion.h1>

              {/* Subtitle */}
              <motion.div custom={2} variants={fadeUp} className="flex flex-wrap items-center gap-3 text-sm text-white/70">
                {profile.city && (
                  <span className="flex items-center gap-1.5">
                    <svg className="h-4 w-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {profile.city}
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Entrega discreta · Respuesta rápida
                </span>
              </motion.div>

              {/* Bio */}
              {profile.bio && (
                <motion.p custom={3} variants={fadeUp} className="max-w-xl text-sm leading-relaxed text-white/60">
                  {profile.bio}
                </motion.p>
              )}
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* ── Search + Category pills ── */}
      <div className="sticky top-[57px] z-30 border-b border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          {/* Search bar */}
          <div className="relative py-3">
            <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Buscar productos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-fuchsia-500/40 focus:ring-1 focus:ring-fuchsia-500/20"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          {/* Category pills */}
          {categoryNames.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none">
              <button
                onClick={() => setActiveCategory(null)}
                className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-medium transition-all ${
                  !activeCategory
                    ? "border-fuchsia-400/50 bg-fuchsia-500/20 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white/80"
                }`}
              >
                Todos
              </button>
              {categoryNames.map((name) => (
                <button
                  key={name}
                  onClick={() => setActiveCategory(activeCategory === name ? null : name)}
                  className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-medium transition-all ${
                    activeCategory === name
                      ? "border-fuchsia-400/50 bg-fuchsia-500/20 text-white"
                      : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white/80"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Products grid ── */}
      <div className="mx-auto max-w-5xl space-y-10 px-4 pt-6 md:px-6">
        {groupedProducts.map(([categoryName, items]) => (
          <motion.section
            key={categoryName}
            ref={(el) => { categoriesRef.current[categoryName] = el; }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            variants={staggerContainer}
            className="scroll-mt-36"
          >
            <motion.div variants={cardPop} className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">{categoryName}</h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/50">
                {items.length} {items.length === 1 ? "producto" : "productos"}
              </span>
            </motion.div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {items.map((p) => {
                const img = p.media?.[0]?.url ? resolveMediaUrl(p.media[0].url) : null;
                const inCart = cartQty(p.id);
                return (
                  <motion.article
                    key={p.id}
                    variants={cardPop}
                    whileHover={{ y: -4 }}
                    transition={{ duration: 0.2 }}
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-xl transition-colors hover:border-fuchsia-400/30 hover:shadow-fuchsia-500/10"
                  >
                    {/* Image - clickable for detail */}
                    <button
                      type="button"
                      onClick={() => setSelectedProduct(p)}
                      className="relative block w-full overflow-hidden rounded-t-2xl"
                    >
                      <ProductImage src={img} alt={p.name} />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                        <span className="rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm">
                          Ver detalle
                        </span>
                      </div>
                      {/* Stock badge */}
                      {p.stock <= 3 && p.stock > 0 && (
                        <span className="absolute right-2 top-2 rounded-full bg-amber-500/90 px-2 py-0.5 text-[10px] font-semibold text-black shadow-lg">
                          Últimos {p.stock}
                        </span>
                      )}
                      {p.stock === 0 && (
                        <span className="absolute right-2 top-2 rounded-full bg-red-500/90 px-2 py-0.5 text-[10px] font-semibold text-white shadow-lg">
                          Agotado
                        </span>
                      )}
                      {inCart > 0 && (
                        <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-[10px] font-bold shadow-lg">
                          {inCart}
                        </span>
                      )}
                    </button>

                    <div className="p-3.5">
                      <h3 className="mb-2.5 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight text-white">
                        {p.name}
                      </h3>

                      <div className="flex items-end justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] uppercase tracking-wider text-white/40">Precio</span>
                          <p className="text-lg font-bold text-white">
                            ${p.price.toLocaleString("es-CL")}
                          </p>
                        </div>

                        <button
                          onClick={(e) => addToCart(p, e)}
                          disabled={p.stock === 0}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 text-white transition-all hover:from-fuchsia-500/40 hover:to-violet-500/40 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label={`Agregar ${p.name}`}
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          </motion.section>
        ))}

        {/* No results */}
        {filteredProducts.length === 0 && products.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center rounded-3xl border border-white/10 bg-white/[0.03] p-12 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
              <svg className="h-8 w-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold">Sin resultados</h3>
            <p className="text-sm text-white/60">No encontramos productos con esa búsqueda.</p>
            <button onClick={() => { setSearch(""); setActiveCategory(null); }} className="mt-4 text-sm text-fuchsia-400 hover:text-fuchsia-300 transition-colors">
              Limpiar filtros
            </button>
          </motion.div>
        )}

        {/* Empty shop */}
        {!products.length && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-white/[0.02] p-12 text-center"
          >
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
              <svg className="h-10 w-10 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-white">Sin productos disponibles</h3>
            <p className="text-sm text-white/60">Esta tienda aún no tiene productos publicados.</p>
          </motion.div>
        )}
      </div>

      {/* ── Floating cart button (mobile) ── */}
      <AnimatePresence>
        {cartItemsCount > 0 && !sheetOpen && (
          <motion.button
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            onClick={() => setSheetOpen(true)}
            className="fixed bottom-6 left-4 right-4 z-30 flex items-center justify-between rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-4 shadow-2xl shadow-fuchsia-500/20 md:left-1/2 md:max-w-md md:-translate-x-1/2"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-bold">
                {cartItemsCount}
              </span>
              <span className="font-semibold">Ver carrito</span>
            </div>
            <span className="text-lg font-bold">${total.toLocaleString("es-CL")}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Flying tokens animation ── */}
      {flyTokens.map((token) => (
        <span
          key={token.id}
          className="pointer-events-none fixed z-50 h-4 w-4 rounded-full bg-gradient-to-br from-fuchsia-400 to-violet-500 shadow-[0_0_20px_rgba(217,70,239,0.8)]"
          style={{
            left: token.x,
            top: token.y,
            transform: `translate(${token.toX - token.x}px, ${token.toY - token.y}px) scale(0.2)`,
            transition: "transform 480ms cubic-bezier(.22,.7,.2,1), opacity 480ms",
            opacity: 0,
          }}
        />
      ))}

      {/* ── Product detail modal ── */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedProduct(null)}
              className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-x-4 bottom-4 top-auto z-50 max-h-[85vh] overflow-auto rounded-3xl border border-white/20 bg-gradient-to-b from-neutral-950 to-black shadow-2xl md:inset-x-auto md:left-1/2 md:max-w-lg md:-translate-x-1/2"
            >
              {/* Product image gallery */}
              {selectedProduct.media && selectedProduct.media.length > 0 ? (
                <div className="relative aspect-square overflow-hidden rounded-t-3xl">
                  <img
                    src={resolveMediaUrl(selectedProduct.media[0].url) ?? undefined}
                    alt={selectedProduct.name}
                    className="h-full w-full object-cover"
                  />
                  {selectedProduct.media.length > 1 && (
                    <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                      {selectedProduct.media.map((m, i) => (
                        <div key={m.id} className={`h-1.5 rounded-full transition-all ${i === 0 ? "w-4 bg-white" : "w-1.5 bg-white/40"}`} />
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/80"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ) : (
                <div className="relative flex aspect-video items-center justify-center rounded-t-3xl bg-gradient-to-br from-white/5 to-white/[0.02]">
                  <svg className="h-16 w-16 text-white/15" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}

              <div className="space-y-4 p-6">
                {/* Category pill */}
                {selectedProduct.shopCategory && (
                  <span className="inline-flex rounded-full border border-fuchsia-400/20 bg-fuchsia-500/10 px-3 py-1 text-xs font-medium text-fuchsia-300">
                    {selectedProduct.shopCategory.name}
                  </span>
                )}

                <h2 className="text-xl font-bold">{selectedProduct.name}</h2>

                {selectedProduct.description && (
                  <p className="text-sm leading-relaxed text-white/60">{selectedProduct.description}</p>
                )}

                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div>
                    <span className="text-xs text-white/40">Precio</span>
                    <p className="text-2xl font-bold">${selectedProduct.price.toLocaleString("es-CL")}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-white/40">Disponible</span>
                    <p className={`text-sm font-semibold ${selectedProduct.stock > 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {selectedProduct.stock > 0 ? `${selectedProduct.stock} en stock` : "Agotado"}
                    </p>
                  </div>
                </div>

                {/* Media thumbnails */}
                {selectedProduct.media && selectedProduct.media.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {selectedProduct.media.map((m) => (
                      <img
                        key={m.id}
                        src={resolveMediaUrl(m.url) ?? undefined}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-xl border border-white/10 object-cover"
                      />
                    ))}
                  </div>
                )}

                <button
                  onClick={(e) => {
                    addToCart(selectedProduct, e as any);
                    setSelectedProduct(null);
                  }}
                  disabled={selectedProduct.stock === 0}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 px-6 py-4 text-base font-semibold shadow-lg shadow-fuchsia-500/20 transition-all hover:from-fuchsia-600 hover:to-violet-700 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Agregar al carrito
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Cart sheet overlay ── */}
      <AnimatePresence>
        {sheetOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSheetOpen(false)}
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* ── Cart sheet ── */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[85vh] rounded-t-3xl border border-white/20 bg-gradient-to-b from-neutral-950 to-black p-6 shadow-2xl transition-transform duration-300 md:left-1/2 md:max-w-lg md:-translate-x-1/2 ${
          sheetOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-white/20" />

        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-bold">Tu carrito</h3>
          <button
            onClick={() => setSheetOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-5 max-h-[50vh] space-y-3 overflow-auto pr-1">
          {cart.length ? (
            cart.map((c) => (
              <div key={c.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex-1 min-w-0">
                  <p className="mb-0.5 truncate font-semibold text-white">{c.name}</p>
                  <p className="text-xs text-white/40">{c.category}</p>
                  <p className="mt-0.5 text-sm text-white/60">${c.price.toLocaleString("es-CL")} c/u</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQty(c.id, -1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 transition-colors hover:bg-white/10"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="w-6 text-center font-semibold">{c.qty}</span>
                  <button
                    onClick={() => updateQty(c.id, 1)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/5 transition-colors hover:bg-white/10"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                </div>
                <p className="w-20 text-right text-sm font-semibold text-fuchsia-400">
                  ${(c.price * c.qty).toLocaleString("es-CL")}
                </p>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
                <svg className="h-8 w-8 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <p className="text-sm text-white/60">Aún no has agregado productos</p>
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <>
            <div className="mb-5 rounded-2xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/15 to-violet-500/15 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-white/50">Total ({cartItemsCount} {cartItemsCount === 1 ? "item" : "items"})</span>
                  <p className="text-2xl font-bold">${total.toLocaleString("es-CL")}</p>
                </div>
                <button
                  onClick={() => setCart([])}
                  className="text-xs text-white/40 hover:text-red-400 transition-colors"
                >
                  Vaciar
                </button>
              </div>
            </div>

            <Link
              href={`/chat/${shopId}?draft=${encodeURIComponent(chatDraftFromCart())}`}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-violet-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-fuchsia-500/20 transition-all hover:from-fuchsia-600 hover:to-violet-700 active:scale-[0.98]"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              Enviar pedido al chat
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

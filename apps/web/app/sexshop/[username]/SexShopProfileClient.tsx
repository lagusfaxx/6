"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";

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

function ProductImage({ src, alt }: { src: string | null; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative aspect-[4/5] overflow-hidden rounded-t-2xl bg-gradient-to-br from-neutral-800 to-neutral-900">
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
            <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-medium">Sin imagen</span>
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
          bio: p.bio || null
        });
        const prod = await apiFetch<{ products: Product[] }>(`/shop/sexshops/${p.id}/products`);
        setProducts(prod.products || []);
      })
      .finally(() => setLoading(false));
  }, [username]);

  const total = useMemo(() => cart.reduce((acc, c) => acc + c.price * c.qty, 0), [cart]);
  const cartItemsCount = useMemo(() => cart.reduce((acc, item) => acc + item.qty, 0), [cart]);

  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    for (const product of products) {
      const key = product.shopCategory?.name || "General";
      if (!groups[key]) groups[key] = [];
      groups[key].push(product);
    }
    return Object.entries(groups);
  }, [products]);

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
        toY: toRect.top + toRect.height / 2
      }
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-fuchsia-500/20 border-t-fuchsia-500" />
          <p className="text-sm text-white/60">Cargando tienda...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-white/[0.02] p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
            <svg className="h-8 w-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-white">Tienda no encontrada</h2>
          <p className="text-sm text-white/60">No pudimos encontrar la tienda que buscas.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-black pb-8 text-white md:pb-12">
      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-white/10 bg-black/95 px-4 py-3 backdrop-blur-xl md:px-6">
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
          <span className="max-w-[60%] truncate text-base font-semibold text-white">{profile.name}</span>
          <button
            ref={cartButtonRef}
            onClick={() => setSheetOpen(true)}
            className={`relative flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 transition-all duration-300 hover:from-fuchsia-500/30 hover:to-violet-500/30 ${cartPulse ? "scale-110" : "scale-100"}`}
            aria-label="Carrito"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {cartItemsCount ? (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 text-[10px] font-bold shadow-lg">
                {cartItemsCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <section className="relative mb-6 h-[45vh] min-h-[380px] overflow-hidden">
        {profile.coverUrl ? (
          <img 
            src={resolveMediaUrl(profile.coverUrl) ?? undefined} 
            alt={profile.name} 
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/20 via-violet-500/10 to-black" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
        
        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 flex items-center gap-3">
              <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium backdrop-blur-md ${isOpenNow ? "border-emerald-400/30 bg-emerald-500/20 text-emerald-100" : "border-red-400/30 bg-red-500/20 text-red-100"}`}>
                <span className={`h-2 w-2 rounded-full ${isOpenNow ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]"}`} />
                {isOpenNow ? "Abierto ahora" : "Cerrado"}
              </span>
            </div>
            
            <h1 className="mb-3 text-4xl font-bold tracking-tight md:text-6xl">
              {profile.name}
            </h1>
            
            <p className="mb-4 flex items-center gap-2 text-sm text-white/80">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Entrega discreta · Respuesta rápida
            </p>
            
            <Link 
              href={`/establecimiento/${username}`} 
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-md transition-all hover:bg-white/20"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Ver perfil del local
            </Link>
          </div>
        </div>
      </section>

      {/* Category Pills */}
      {groupedProducts.length ? (
        <div className="sticky top-[57px] z-30 mb-6 border-b border-white/10 bg-black/80 backdrop-blur-xl">
          <div className="mx-auto max-w-5xl overflow-x-auto px-4 md:px-6">
            <div className="flex gap-2 py-4">
              {groupedProducts.map(([categoryName]) => (
                <button
                  key={categoryName}
                  onClick={() => categoriesRef.current[categoryName]?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="group whitespace-nowrap rounded-full border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-medium text-white/90 transition-all hover:border-fuchsia-400/50 hover:bg-fuchsia-500/10 hover:text-white"
                >
                  {categoryName}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Products Grid */}
      <div className="mx-auto max-w-5xl space-y-12 px-4 md:px-6">
        {groupedProducts.map(([categoryName, items]) => (
          <section 
            key={categoryName} 
            ref={(el) => { categoriesRef.current[categoryName] = el; }} 
            className="scroll-mt-36"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-2xl font-bold">{categoryName}</h2>
              <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
                {items.length} {items.length === 1 ? "producto" : "productos"}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {items.map((p) => {
                const img = p.media?.[0]?.url ? resolveMediaUrl(p.media[0].url) : null;
                return (
                  <article
                    key={p.id}
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-fuchsia-400/30 hover:shadow-2xl hover:shadow-fuchsia-500/10 active:scale-[0.98]"
                  >
                    <ProductImage src={img} alt={p.name} />
                    
                    <div className="p-4">
                      <h3 className="mb-3 line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight text-white">
                        {p.name}
                      </h3>
                      
                      <div className="flex items-end justify-between">
                        <div className="flex flex-col">
                          <span className="text-xs text-white/50">Precio</span>
                          <p className="text-xl font-bold text-white">
                            ${p.price.toLocaleString("es-CL")}
                          </p>
                        </div>
                        
                        <button
                          onClick={(e) => addToCart(p, e)}
                          className="flex h-10 w-10 items-center justify-center rounded-full border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 text-lg font-semibold text-white transition-all hover:from-fuchsia-500/40 hover:to-violet-500/40 active:scale-95"
                          aria-label={`Agregar ${p.name}`}
                        >
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        {!products.length ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-white/10 bg-gradient-to-b from-white/5 to-white/[0.02] p-12 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
              <svg className="h-10 w-10 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-white">Sin productos disponibles</h3>
            <p className="text-sm text-white/60">Esta tienda aún no tiene productos publicados.</p>
          </div>
        ) : null}
      </div>

      {/* Flying Tokens Animation */}
      {flyTokens.map((token) => (
        <span
          key={token.id}
          className="pointer-events-none fixed z-50 h-4 w-4 rounded-full bg-gradient-to-br from-fuchsia-400 to-violet-500 shadow-[0_0_20px_rgba(217,70,239,0.8)]"
          style={{
            left: token.x,
            top: token.y,
            transform: `translate(${token.toX - token.x}px, ${token.toY - token.y}px) scale(0.2)`,
            transition: "transform 480ms cubic-bezier(.22,.7,.2,1), opacity 480ms",
            opacity: 0
          }}
        />
      ))}

      {/* Cart Sheet Overlay */}
      <div
        onClick={() => setSheetOpen(false)}
        className={`fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${sheetOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
      />

      {/* Cart Sheet */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[85vh] rounded-t-3xl border border-white/20 bg-gradient-to-b from-neutral-950 to-black p-6 shadow-2xl transition-transform duration-300 md:left-1/2 md:max-w-lg md:-translate-x-1/2 ${sheetOpen ? "translate-y-0" : "translate-y-full"}`}
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

        <div className="mb-5 max-h-[50vh] space-y-3 overflow-auto pr-2">
          {cart.length ? (
            cart.map((c) => (
              <div key={c.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex-1">
                  <p className="mb-1 font-semibold text-white">{c.name}</p>
                  <p className="text-sm text-white/60">${c.price.toLocaleString("es-CL")} c/u</p>
                </div>
                <div className="flex items-center gap-3">
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

        {cart.length ? (
          <div className="mb-5 rounded-2xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/80">Total</span>
              <strong className="text-2xl font-bold">${total.toLocaleString("es-CL")}</strong>
            </div>
          </div>
        ) : null}

        <Link
          href={`/chat/${shopId}?draft=${encodeURIComponent(chatDraftFromCart())}`}
          className={`flex w-full items-center justify-center gap-2 rounded-xl px-6 py-4 text-base font-semibold text-white shadow-lg transition-all ${cart.length ? "bg-gradient-to-r from-fuchsia-500 to-violet-600 hover:from-fuchsia-600 hover:to-violet-700 active:scale-[0.98]" : "pointer-events-none bg-white/10 text-white/40"}`}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Enviar pedido al chat
        </Link>
      </div>
    </div>
  );
}

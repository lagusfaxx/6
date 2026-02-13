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
    <div className="relative aspect-[4/5] overflow-hidden bg-neutral-900">
      {!loaded ? <div className="absolute inset-0 animate-pulse bg-white/10" /> : null}
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 h-full w-full object-cover transition duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-white/35">
          <span className="rounded-full border border-white/20 px-3 py-1 text-xs">Sin imagen</span>
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

  if (loading) return <div className="px-4 py-8 text-white/60">Cargando tienda...</div>;
  if (!profile) return <div className="card p-6 text-white/60">No encontramos la tienda.</div>;

  return (
    <div className="relative pb-8 text-white md:pb-12">
      <div className="sticky top-0 z-40 -mx-4 mb-3 border-b border-white/10 bg-black/80 px-4 py-3 backdrop-blur-xl md:-mx-6 md:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <button onClick={() => router.back()} className="text-lg text-white/90" aria-label="Volver">
            ←
          </button>
          <span className="max-w-[60%] truncate text-sm font-medium text-white/85">{profile.name}</span>
          <button
            ref={cartButtonRef}
            onClick={() => setSheetOpen(true)}
            className={`relative rounded-full border border-white/20 bg-white/10 p-2.5 transition ${cartPulse ? "scale-110" : "scale-100"}`}
            aria-label="Carrito"
          >
            🛒
            {cartItemsCount ? (
              <span className="absolute -right-1 -top-1 rounded-full bg-fuchsia-500 px-1.5 text-[10px] font-semibold">{cartItemsCount}</span>
            ) : null}
          </button>
        </div>
      </div>

      <section className="relative -mx-4 mb-4 h-[40vh] min-h-[320px] overflow-hidden md:-mx-6 md:rounded-3xl">
        {profile.coverUrl ? (
          <img src={resolveMediaUrl(profile.coverUrl) ?? undefined} alt={profile.name} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(168,85,247,0.22),rgba(10,10,10,0.95)_60%)]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/50 to-black/85" />
        <div className="absolute bottom-0 left-0 right-0 mx-auto flex w-full max-w-5xl flex-col gap-3 p-4 md:p-8">
          <span className="w-fit rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-100">{isOpenNow ? "🟢 Abierto ahora" : "🔴 Cerrado"}</span>
          <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{profile.name}</h1>
          <p className="text-sm text-white/75">Entrega discreta · Respuesta rápida</p>
          <Link href={`/establecimiento/${username}`} className="mt-1 w-fit rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/90">
            Ver perfil del local
          </Link>
        </div>
      </section>

      {groupedProducts.length ? (
        <div className="sticky top-[57px] z-30 -mx-4 mb-4 overflow-x-auto border-y border-white/10 bg-black/70 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
          <div className="mx-auto flex max-w-5xl gap-2">
            {groupedProducts.map(([categoryName]) => (
              <button
                key={categoryName}
                onClick={() => categoriesRef.current[categoryName]?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="whitespace-nowrap rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80"
              >
                {categoryName}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mx-auto grid max-w-5xl gap-7">
        {groupedProducts.map(([categoryName, items]) => (
          <section key={categoryName} ref={(el) => { categoriesRef.current[categoryName] = el; }} className="scroll-mt-36">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{categoryName}</h2>
              <span className="text-xs text-white/55">{items.length} productos</span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {items.map((p) => {
                const img = p.media?.[0]?.url ? resolveMediaUrl(p.media[0].url) : null;
                return (
                  <article
                    key={p.id}
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_12px_30px_rgba(0,0,0,0.25)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(0,0,0,0.4)] active:scale-[0.99]"
                  >
                    <ProductImage src={img} alt={p.name} />
                    <div className="p-3">
                      <p className="truncate text-sm font-medium">{p.name}</p>
                      <div className="mt-2 flex items-end justify-between">
                        <p className="text-lg font-semibold text-white">${p.price.toLocaleString("es-CL")}</p>
                        <button
                          onClick={(e) => addToCart(p, e)}
                          className="rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-base leading-none transition hover:bg-fuchsia-500/30"
                          aria-label={`Agregar ${p.name}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        {!products.length ? <div className="rounded-2xl border border-white/10 bg-black/35 p-6 text-sm text-white/60">Esta tienda aún no tiene productos publicados.</div> : null}
      </div>

      {flyTokens.map((token) => (
        <span
          key={token.id}
          className="pointer-events-none fixed z-50 h-3 w-3 rounded-full bg-fuchsia-400 shadow-[0_0_18px_rgba(217,70,239,0.8)]"
          style={{
            left: token.x,
            top: token.y,
            transform: `translate(${token.toX - token.x}px, ${token.toY - token.y}px) scale(0.3)`,
            transition: "transform 480ms cubic-bezier(.22,.7,.2,1), opacity 480ms",
            opacity: 0
          }}
        />
      ))}

      <div
        onClick={() => setSheetOpen(false)}
        className={`fixed inset-0 z-40 bg-black/60 transition ${sheetOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-50 max-h-[80vh] rounded-t-3xl border border-white/10 bg-neutral-950 p-4 shadow-[0_-20px_60px_rgba(0,0,0,0.55)] transition duration-300 md:left-1/2 md:max-w-lg md:-translate-x-1/2 ${sheetOpen ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/20" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold">Tu carrito</h3>
          <button onClick={() => setSheetOpen(false)} className="text-white/65">Cerrar</button>
        </div>

        <div className="max-h-[44vh] space-y-2 overflow-auto pr-1">
          {cart.length ? (
            cart.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div>
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-white/55">${c.price.toLocaleString("es-CL")} c/u</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(c.id, -1)} className="h-7 w-7 rounded-full border border-white/20 bg-white/5">−</button>
                  <span className="w-5 text-center text-sm">{c.qty}</span>
                  <button onClick={() => updateQty(c.id, 1)} className="h-7 w-7 rounded-full border border-white/20 bg-white/5">+</button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-white/10 p-4 text-sm text-white/60">Aún no agregas productos.</div>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-fuchsia-400/25 bg-fuchsia-500/10 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/75">Total</span>
            <strong className="text-lg">${total.toLocaleString("es-CL")}</strong>
          </div>
        </div>

        <Link
          href={`/chat/${shopId}?draft=${encodeURIComponent(chatDraftFromCart())}`}
          className={`mt-4 flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${cart.length ? "bg-gradient-to-r from-fuchsia-500 to-violet-500" : "pointer-events-none bg-white/15 text-white/50"}`}
        >
          Enviar pedido al chat
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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

export default function SexShopProfileClient() {
  const params = useParams<{ username: string }>();
  const username = params?.username as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  function addToCart(p: Product) {
    const category = p.shopCategory?.name || "General";
    setCart((prev) => {
      const found = prev.find((i) => i.id === p.id);
      if (found) return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1, category }];
    });
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }

  function chatDraftFromCart() {
    if (!cart.length) return "Hola, me interesa un producto de tu tienda.";
    const lines = cart.map((c) => `- ${c.name} x${c.qty} ($${(c.price * c.qty).toLocaleString("es-CL")})`).join("\n");
    return `Hola, quiero enviar este pedido:\n${lines}\nTotal referencial: $${total.toLocaleString("es-CL")}\n(Coordinemos entrega y pago por aquí).`;
  }

  const currentHour = new Date().getHours();
  const isOpenNow = currentHour >= 10 && currentHour < 23;
  const responseTime = "Responde en 5-15 min";

  if (loading) return <div className="text-white/60">Cargando...</div>;
  if (!profile) return <div className="card p-6 text-white/60">No encontramos la tienda.</div>;

  return (
    <div className="grid gap-6 pb-28 md:pb-6">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/35 shadow-[0_30px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="relative h-52 w-full md:h-64">
          {profile.coverUrl ? (
            <img src={resolveMediaUrl(profile.coverUrl) ?? undefined} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(217,70,239,0.35),rgba(17,24,39,0.85)_60%,rgba(2,6,23,0.95))]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10" />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex items-end gap-4">
                <div className="h-24 w-24 overflow-hidden rounded-2xl border border-white/30 bg-black/40 shadow-xl md:h-28 md:w-28">
                  {profile.avatarUrl ? <img src={resolveMediaUrl(profile.avatarUrl) ?? undefined} alt={profile.name} className="h-full w-full object-cover" /> : null}
                </div>
                <div>
                  <div className="text-2xl font-semibold tracking-tight md:text-3xl">{profile.name}</div>
                  <div className="mt-1 text-sm text-white/70">{profile.city || profile.address || "Chile"}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                {isOpenNow ? "🟢 Abierto ahora" : "🔴 Cerrado"}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/75">
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">{responseTime}</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1">Compra discreta por chat</span>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 bg-gradient-to-b from-black/35 to-black/70 p-6 md:p-8">
          {profile.bio ? <p className="text-sm leading-relaxed text-white/75">{profile.bio}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/chat/${shopId}`} className="rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/90 transition hover:border-white/35 hover:bg-white/10">
              Chatear
            </Link>
            <Link
              href={cart.length ? `/chat/${shopId}?draft=${encodeURIComponent(chatDraftFromCart())}` : `/chat/${shopId}`}
              className="rounded-xl bg-gradient-to-r from-fuchsia-500 via-violet-500 to-purple-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_35px_rgba(168,85,247,0.38)] transition hover:brightness-110"
            >
              Enviar pedido por chat
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {groupedProducts.map(([categoryName, items]) => (
          <section key={categoryName} className="rounded-3xl border border-white/10 bg-black/30 p-5 shadow-[0_20px_55px_rgba(0,0,0,0.45)] backdrop-blur-xl md:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{categoryName}</h3>
              <span className="text-xs text-white/60">{items.length} productos</span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((p) => {
                const img = p.media?.[0]?.url ? resolveMediaUrl(p.media[0].url) : null;
                return (
                  <article
                    key={p.id}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] transition duration-200 hover:-translate-y-0.5 hover:border-fuchsia-300/40 hover:shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-black/35">
                      {img ? (
                        <img
                          src={img ?? undefined}
                          alt={p.name}
                          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.2),rgba(15,23,42,0.9)_65%)]" />
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-4">
                      <div className="font-semibold text-white">{p.name}</div>
                      {p.description ? <div className="mt-1 line-clamp-2 text-sm text-white/60">{p.description}</div> : null}

                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-white/45">Precio</p>
                          <p className="text-xl font-bold text-fuchsia-100">${p.price.toLocaleString("es-CL")}</p>
                        </div>
                        <p className="text-xs text-white/50">Stock {p.stock}</p>
                      </div>

                      <button
                        onClick={() => addToCart(p)}
                        className="mt-4 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition hover:border-fuchsia-300/50 hover:bg-fuchsia-500/20"
                      >
                        Agregar
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {!products.length ? (
        <div className="card p-6 text-sm text-white/60">Esta tienda aún no tiene productos publicados.</div>
      ) : null}

      {cart.length ? (
        <div className="rounded-3xl border border-white/10 bg-black/40 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-2xl md:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Resumen de compra</h2>
            <span className="text-sm text-white/65">{cartItemsCount} producto(s)</span>
          </div>

          <div className="mt-4 space-y-3">
            {cart.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium text-white/95">{c.name}</div>
                  <div className="text-xs text-white/55">{c.category} · x{c.qty}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold">${(c.price * c.qty).toLocaleString("es-CL")}</div>
                  <button onClick={() => removeFromCart(c.id)} className="text-xs text-white/60 underline hover:text-white/85">
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-fuchsia-300/30 bg-fuchsia-500/10 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-white/80">Total referencial</span>
              <span className="text-lg font-bold text-fuchsia-100">${total.toLocaleString("es-CL")}</span>
            </div>
          </div>
        </div>
      ) : null}

      {cart.length ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-black/85 p-4 backdrop-blur-xl md:hidden">
          <Link
            href={`/chat/${shopId}?draft=${encodeURIComponent(chatDraftFromCart())}`}
            className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-fuchsia-500 via-violet-500 to-purple-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(168,85,247,0.35)]"
          >
            <span>Enviar pedido por chat</span>
            <span>${total.toLocaleString("es-CL")}</span>
          </Link>
        </div>
      ) : null}

      {cart.length ? (
        <div className="hidden md:block">
          <Link
            href={`/chat/${shopId}?draft=${encodeURIComponent(chatDraftFromCart())}`}
            className="inline-flex items-center rounded-xl bg-gradient-to-r from-fuchsia-500 via-violet-500 to-purple-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_35px_rgba(168,85,247,0.35)] transition hover:brightness-110"
          >
            Enviar pedido por chat
          </Link>
        </div>
      ) : null}
    </div>
  );
}

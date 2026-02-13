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

  if (loading) return <div className="text-white/60">Cargando...</div>;
  if (!profile) return <div className="card p-6 text-white/60">No encontramos la tienda.</div>;

  return (
    <div className="grid gap-6">
      <div className="card overflow-hidden p-0">
        {profile.coverUrl ? (
          <div className="relative h-40 w-full">
            <img src={resolveMediaUrl(profile.coverUrl) ?? undefined} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </div>
        ) : null}
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 overflow-hidden rounded-full border border-white/10 bg-white/10">
              {profile.avatarUrl ? <img src={resolveMediaUrl(profile.avatarUrl) ?? undefined} alt={profile.name} className="h-full w-full object-cover" /> : null}
            </div>
            <div>
              <div className="text-xl font-semibold">{profile.name}</div>
              <div className="text-sm text-white/60">{profile.city || profile.address || ""}</div>
            </div>
          </div>
          {profile.bio ? <p className="mt-4 text-sm text-white/70">{profile.bio}</p> : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={`/chat/${shopId}`} className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm hover:border-white/30">
              Chatear
            </Link>
            {cart.length ? (
              <Link
                href={`/chat/${shopId}?draft=${encodeURIComponent(chatDraftFromCart())}`}
                className="rounded-2xl bg-white text-black px-4 py-2 text-sm font-semibold"
              >
                Enviar pedido por chat
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {cart.length ? (
        <div className="card p-6">
          <h2 className="text-lg font-semibold">Carro de compra</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {cart.map((c) => (
              <div key={c.id} className="rounded-2xl border border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-500/10 to-white/5 p-4">
                <div className="text-xs text-fuchsia-100/80">{c.category}</div>
                <div className="mt-1 font-medium">{c.name}</div>
                <div className="mt-2 flex items-center justify-between text-sm text-white/80">
                  <span>x{c.qty}</span>
                  <span>${(c.price * c.qty).toLocaleString("es-CL")}</span>
                </div>
                <button onClick={() => removeFromCart(c.id)} className="mt-3 text-xs text-white/70 underline">Quitar</button>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/85">Total referencial: ${total.toLocaleString("es-CL")}</div>
        </div>
      ) : null}

      <div className="card p-6">
        <h2 className="text-lg font-semibold">Productos</h2>
        <div className="mt-4 grid gap-6">
          {groupedProducts.map(([categoryName, items]) => (
            <div key={categoryName} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-base font-semibold">{categoryName}</h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {items.map((p) => {
                  const img = p.media?.[0]?.url ? resolveMediaUrl(p.media[0].url) : null;
                  return (
                    <div key={p.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                      {img ? (
                        <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-black/20">
                          <img src={img ?? undefined} alt={p.name} className="absolute inset-0 h-full w-full object-cover" />
                        </div>
                      ) : null}
                      <div className="font-semibold">{p.name}</div>
                      {p.description ? <div className="mt-1 text-sm text-white/60">{p.description}</div> : null}
                      <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/60">
                        <span>Precio: ${p.price.toLocaleString("es-CL")}</span>
                        <span>Stock: {p.stock}</span>
                      </div>
                      <button onClick={() => addToCart(p)} className="mt-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm hover:bg-white/20">
                        + Agregar al carro
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {!products.length ? <div className="text-white/60">Esta tienda aún no tiene productos publicados.</div> : null}
        </div>
      </div>
    </div>
  );
}

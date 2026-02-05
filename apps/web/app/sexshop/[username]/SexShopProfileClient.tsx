"use client";

import { useEffect, useState } from "react";
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

export default function SexShopProfileClient() {
  const params = useParams<{ username: string }>();
  const username = params?.username as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [shopId, setShopId] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  
  useEffect(() => {
    setLoading(true);
    apiFetch<any>(`/profile/profiles/${username}`)
      .then(async (p) => {
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


  if (loading) return <div className="text-white/60">Cargando...</div>;
  if (!profile) return <div className="card p-6 text-white/60">No encontramos el sex shop.</div>;

  return (
    <div className="grid gap-6">
      <div className="card overflow-hidden p-0">
        {profile.coverUrl ? (
          <div className="relative h-40 w-full">
            <img src={resolveMediaUrl(profile.coverUrl) || ""} alt="" className="absolute inset-0 h-full w-full object-cover" />
          </div>
        ) : null}
        <div className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 overflow-hidden rounded-full border border-white/10 bg-white/10">
              {profile.avatarUrl ? <img src={resolveMediaUrl(profile.avatarUrl) || ""} alt={profile.name} className="h-full w-full object-cover" /> : null}
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
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold">Productos</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {products.map((p) => {
            const img = p.media?.[0]?.url ? resolveMediaUrl(p.media[0].url) : null;
            return (
              <div key={p.id} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                {img ? (
                  <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-black/20">
                    <img src={img || ""} alt={p.name} className="absolute inset-0 h-full w-full object-cover" />
                  </div>
                ) : null}
                <div className="font-semibold">{p.name}</div>
                {p.description ? <div className="mt-1 text-sm text-white/60">{p.description}</div> : null}
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-white/60">
                  <span>💰 ${p.price.toLocaleString("es-CL")}</span>
                  <span>📦 Stock: {p.stock}</span>
                </div>
              </div>
            );
          })}
          {!products.length ? <div className="text-white/60">Este sex shop aún no tiene productos publicados.</div> : null}
        </div>
      </div>
    </div>
  );
}

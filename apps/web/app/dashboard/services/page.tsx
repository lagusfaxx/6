"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";

type ServiceItem = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  price?: number | null;
  createdAt: string;
};

export default function DashboardServicesPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;

  const canManage = useMemo(() => {
    const t = (user?.profileType ?? "").toUpperCase();
    return ["PROFESSIONAL", "ESTABLISHMENT", "SHOP", "CREATOR", "VIEWER"].includes(t) && t !== "CLIENT";
  }, [user?.profileType]);

  const [items, setItems] = useState<ServiceItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState<string>("");

  async function load(userId: string) {
    setError(null);
    try {
      const res = await apiFetch<{ items: ServiceItem[] }>(`/services/${userId}/items`);
      setItems(res?.items ?? []);
    } catch (e) {
      setError("No se pudieron cargar tus servicios.");
    }
  }

  useEffect(() => {
    if (!loading && user?.id) load(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.id]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/services/items", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || null,
          category: category || null,
          price: price ? parseInt(price, 10) : null
        })
      });
      setTitle("");
      setDescription("");
      setCategory("");
      setPrice("");
      if (user?.id) await load(user.id);
    } catch (e) {
      setError("No se pudo crear el servicio.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este servicio?")) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/services/items/${id}`, { method: "DELETE" });
      if (user?.id) await load(user.id);
    } catch {
      setError("No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-white/70">Cargando...</div>;
  if (!user) return <div className="p-6 text-white/70">Debes iniciar sesión.</div>;
  if (!canManage) return <div className="p-6 text-white/70">Este panel es solo para perfiles pagados (no Cliente).</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 text-white">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Mis servicios</h1>
        <Link href="/dashboard" className="text-sm text-white/70 hover:text-white">Volver</Link>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold">Agregar servicio</h2>
        <div className="mt-3 grid gap-3">
          <input className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none" placeholder="Categoría (opcional)" value={category} onChange={(e) => setCategory(e.target.value)} />
          <input className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none" placeholder="Precio CLP (opcional)" value={price} onChange={(e) => setPrice(e.target.value)} />
          <textarea className="min-h-[110px] w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none" placeholder="Descripción (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button
            disabled={busy || !title.trim()}
            onClick={create}
            className="rounded-xl bg-white/15 px-4 py-2 font-semibold hover:bg-white/20 disabled:opacity-50"
          >
            {busy ? "Guardando..." : "Crear"}
          </button>
          {error ? <div className="text-sm text-red-200">{error}</div> : null}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {items.map((it) => (
          <div key={it.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{it.title}</div>
                <div className="text-sm text-white/70">{it.description || "Sin descripción"}</div>
                <div className="mt-2 text-xs text-white/60">
                  {it.category ? `Categoría: ${it.category}` : ""}{it.price ? ` · Precio: $${it.price}` : ""}
                </div>
              </div>
              <button onClick={() => remove(it.id)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30">
                Eliminar
              </button>
            </div>
          </div>
        ))}
        {!items.length ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">Aún no tienes servicios.</div>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch } from "../../../lib/api";

type Banner = {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl?: string | null;
  position: string; // LEFT | RIGHT | INLINE
  isActive: boolean;
  sortOrder: number;
};

export default function AdminBannersPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const isAdmin = useMemo(() => (user?.role ?? "").toUpperCase() === "ADMIN", [user?.role]);

  const [items, setItems] = useState<Banner[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [position, setPosition] = useState("RIGHT");
  const [sortOrder, setSortOrder] = useState("0");

  async function load() {
    setError(null);
    try {
      const res = await apiFetch<{ banners: Banner[] }>("/admin/banners");
      setItems(res?.banners ?? []);
    } catch {
      setError("No se pudieron cargar banners.");
    }
  }

  useEffect(() => {
    if (!loading && isAdmin) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isAdmin]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/admin/banners", {
        method: "POST",
        body: JSON.stringify({
          title,
          imageUrl,
          linkUrl: linkUrl || null,
          position,
          sortOrder: parseInt(sortOrder || "0", 10) || 0,
          isActive: true
        })
      });
      setTitle("");
      setImageUrl("");
      setLinkUrl("");
      setPosition("RIGHT");
      setSortOrder("0");
      await load();
    } catch {
      setError("No se pudo crear.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(b: Banner) {
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/banners/${b.id}`, { method: "PUT", body: JSON.stringify({ isActive: !b.isActive }) });
      await load();
    } catch {
      setError("No se pudo actualizar.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar banner?")) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(`/admin/banners/${id}`, { method: "DELETE" });
      await load();
    } catch {
      setError("No se pudo eliminar.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-white/70">Cargando...</div>;
  if (!user) return <div className="p-6 text-white/70">Debes iniciar sesión.</div>;
  if (!isAdmin) return <div className="p-6 text-white/70">Acceso restringido.</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 text-white">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Banners Home</h1>
        <Link href="/admin" className="text-sm text-white/70 hover:text-white">Volver</Link>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold">Crear banner</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none" placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none" placeholder="Image URL (https://.../uploads/...)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
          <input className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none" placeholder="Link URL (opcional)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <select className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none" value={position} onChange={(e) => setPosition(e.target.value)}>
              <option value="LEFT">LEFT</option>
              <option value="RIGHT">RIGHT</option>
              <option value="INLINE">INLINE</option>
            </select>
            <input className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 outline-none" placeholder="Orden" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </div>
        </div>
        <button disabled={busy || !title.trim() || !imageUrl.trim()} onClick={create} className="mt-3 rounded-xl bg-white/15 px-4 py-2 font-semibold hover:bg-white/20 disabled:opacity-50">
          {busy ? "Guardando..." : "Crear"}
        </button>
        {error ? <div className="mt-2 text-sm text-red-200">{error}</div> : null}
        <div className="mt-2 text-xs text-white/60">
          Tip: para subir imágenes usa el endpoint <span className="text-white/80">POST /admin/banners/upload</span> (form-data: file).
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {items.map((b) => (
          <div key={b.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{b.title}</div>
                <div className="text-sm text-white/70 break-all">{b.imageUrl}</div>
                <div className="mt-1 text-xs text-white/60">Posición: {b.position} · Orden: {b.sortOrder}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => toggle(b)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30">
                  {b.isActive ? "Desactivar" : "Activar"}
                </button>
                <button onClick={() => remove(b.id)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30">
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        ))}
        {!items.length ? <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">Sin banners.</div> : null}
      </div>
    </div>
  );
}

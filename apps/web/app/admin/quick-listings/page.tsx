"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import useMe from "../../../hooks/useMe";
import { apiFetch } from "../../../lib/api";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  X,
  Loader2,
  Globe,
  MapPin,
} from "lucide-react";

const MapboxAddressAutocomplete = dynamic(
  () => import("../../../components/MapboxAddressAutocomplete"),
  { ssr: false },
);

type Category = {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  kind: string;
};

type QuickListing = {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  description: string | null;
  websiteUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  categoryId: string;
  category: { id: string; name: string; displayName: string; slug: string };
  createdAt: string;
};

export default function AdminQuickListingsPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const isAdmin = useMemo(
    () => (user?.role ?? "").toUpperCase() === "ADMIN",
    [user?.role],
  );

  const [items, setItems] = useState<QuickListing[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /* Form state */
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const estCategories = useMemo(
    () => categories.filter((c) => c.kind === "ESTABLISHMENT" || c.kind === "SHOP"),
    [categories],
  );

  function resetForm() {
    setEditingId(null);
    setName("");
    setAddress("");
    setCity("");
    setPhone("");
    setDescription("");
    setWebsiteUrl("");
    setCategoryId("");
    setLatitude(null);
    setLongitude(null);
    setShowForm(false);
  }

  async function loadData() {
    setBusy(true);
    try {
      const [listRes, catRes] = await Promise.all([
        apiFetch<{ listings: QuickListing[]; total: number }>("/admin/quick-listings"),
        apiFetch<Category[]>("/categories"),
      ]);
      setItems(listRes.listings);
      setCategories(catRes);
    } catch {
      setError("Error al cargar datos");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

  function openEdit(item: QuickListing) {
    setEditingId(item.id);
    setName(item.name);
    setAddress(item.address);
    setCity(item.city);
    setPhone(item.phone);
    setDescription(item.description || "");
    setWebsiteUrl(item.websiteUrl || "");
    setCategoryId(item.categoryId);
    setLatitude(item.latitude);
    setLongitude(item.longitude);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);

    const payload = {
      name,
      address,
      city,
      phone,
      description: description || null,
      websiteUrl: websiteUrl || null,
      categoryId,
      latitude,
      longitude,
    };

    try {
      if (editingId) {
        await apiFetch(`/admin/quick-listings/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setSuccess("Listado actualizado");
      } else {
        await apiFetch("/admin/quick-listings", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess("Listado creado");
      }
      resetForm();
      await loadData();
    } catch {
      setError("Error al guardar");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Eliminar este listado?")) return;
    setBusy(true);
    try {
      await apiFetch(`/admin/quick-listings/${id}`, { method: "DELETE" });
      setSuccess("Eliminado");
      await loadData();
    } catch {
      setError("Error al eliminar");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-8 text-white/60">Cargando...</div>;
  if (!isAdmin) return <div className="p-8 text-red-400">Acceso denegado</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="rounded-lg border border-white/10 p-2 hover:bg-white/5">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-bold">Listados Rápidos</h1>
          <span className="rounded-full bg-fuchsia-600/20 px-2 py-0.5 text-xs text-fuchsia-300">
            {items.length}
          </span>
        </div>
        {!showForm && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-semibold hover:bg-fuchsia-500"
          >
            <Plus className="h-4 w-4" /> Agregar
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {success}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {editingId ? "Editar listado" : "Nuevo listado rápido"}
            </h2>
            <button type="button" onClick={resetForm} className="rounded-lg p-1 hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm text-white/70">Nombre *</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Motel Las Rosas"
                required
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm text-white/70">Categoría *</label>
              <select
                className="input"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
              >
                <option value="">Seleccionar...</option>
                {estCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.displayName || c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <MapboxAddressAutocomplete
                label="Dirección *"
                value={address}
                placeholder="Av. Providencia 1234, Santiago"
                required
                onChange={(v) => setAddress(v)}
                onSelect={(suggestion) => {
                  setAddress(suggestion.placeName);
                  setLatitude(suggestion.latitude);
                  setLongitude(suggestion.longitude);
                  if (suggestion.city) setCity(suggestion.city);
                }}
              />
              {latitude != null && longitude != null && (
                <p className="mt-1 flex items-center gap-1 text-xs text-emerald-400/80">
                  <MapPin className="h-3 w-3" />
                  Ubicación: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <label className="text-sm text-white/70">Ciudad *</label>
              <input
                className="input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Santiago"
                required
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm text-white/70">Teléfono</label>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+56 9 1234 5678"
              />
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <label className="flex items-center gap-1.5 text-sm text-white/70">
                <Globe className="h-3.5 w-3.5 text-fuchsia-400" />
                Sitio web (URL externa)
              </label>
              <input
                className="input"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://www.ejemplo.cl"
                type="url"
              />
              <p className="text-xs text-white/40">
                Los usuarios serán redirigidos a este sitio al hacer clic en &quot;Visitar sitio web&quot;
              </p>
            </div>

            <div className="grid gap-2 sm:col-span-2">
              <label className="text-sm text-white/70">Descripción</label>
              <textarea
                className="input min-h-[80px] resize-y"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Breve descripción del establecimiento..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-fuchsia-600 px-5 py-2 text-sm font-semibold hover:bg-fuchsia-500 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? "Guardar cambios" : "Crear listado"}
            </button>
          </div>
        </form>
      )}

      {/* Listings table */}
      {busy && !showForm ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-fuchsia-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center text-white/50">
          No hay listados rápidos aún. Haz clic en &quot;Agregar&quot; para crear uno.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold">{item.name}</h3>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60">
                    {item.category?.displayName || item.category?.name}
                  </span>
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-white/50">
                  <MapPin className="h-3 w-3" />
                  {item.address}, {item.city}
                </p>
                {item.websiteUrl && (
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-fuchsia-400/70">
                    <Globe className="h-3 w-3" />
                    <a href={item.websiteUrl} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                      {item.websiteUrl}
                    </a>
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => openEdit(item)}
                  className="rounded-lg border border-white/10 p-2 hover:bg-white/10"
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="rounded-lg border border-red-500/20 p-2 text-red-400 hover:bg-red-500/10"
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

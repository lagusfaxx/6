"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import useMe from "../../../hooks/useMe";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  X,
  Loader2,
  MapPin,
  ImagePlus,
  Link2,
  User,
  Phone,
  Calendar,
} from "lucide-react";

const MapboxAddressAutocomplete = dynamic(
  () => import("../../../components/MapboxAddressAutocomplete"),
  { ssr: false },
);

/* ── Tag catalogs (same as DirectoryPage.tsx) ── */
const PROFILE_TAG_OPTIONS = [
  "tetona", "culona", "delgada", "fitness", "gordita",
  "rubia", "morena", "pelirroja", "trigueña",
  "sumisa", "dominante", "caliente", "cariñosa", "natural",
  "tatuada", "piercing",
];
const SERVICE_TAG_OPTIONS = [
  "anal", "trios", "packs", "videollamada",
  "masaje erotico", "despedidas", "discapacitados", "fetiches",
  "bdsm", "sexo oral", "lluvia dorada", "rol",
];
const CATEGORY_OPTIONS = [
  "Escort", "Masajes", "Trans", "Despedidas",
];

type MediaItem = { id: string; url: string; type: string };

type QuickProfessional = {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  city: string | null;
  phone: string | null;
  bio: string | null;
  birthdate: string | null;
  gender: string | null;
  latitude: number | null;
  longitude: number | null;
  primaryCategory: string | null;
  serviceCategory: string | null;
  profileTags: string[];
  serviceTags: string[];
  isActive: boolean;
  isVerified: boolean;
  tier: string | null;
  profileMedia: MediaItem[];
  createdAt: string;
};

export default function AdminQuickProfessionalsPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;
  const isAdmin = useMemo(
    () => (user?.role ?? "").toUpperCase() === "ADMIN",
    [user?.role],
  );

  const [items, setItems] = useState<QuickProfessional[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [urlInputOpen, setUrlInputOpen] = useState<string | null>(null);
  const [urlInputValue, setUrlInputValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetId = useRef<string | null>(null);

  /* Form state */
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [primaryCategory, setPrimaryCategory] = useState("Escort");
  const [tier, setTier] = useState("");
  const [profileTags, setProfileTags] = useState<string[]>([]);
  const [serviceTags, setServiceTags] = useState<string[]>([]);

  function resetForm() {
    setEditingId(null);
    setDisplayName("");
    setPhone("");
    setCity("");
    setAddress("");
    setBio("");
    setGender("");
    setBirthdate("");
    setLatitude(null);
    setLongitude(null);
    setPrimaryCategory("Escort");
    setTier("");
    setProfileTags([]);
    setServiceTags([]);
    setShowForm(false);
  }

  async function loadData() {
    setBusy(true);
    try {
      const res = await apiFetch<{ professionals: QuickProfessional[]; total: number }>("/admin/quick-professionals");
      setItems(res.professionals);
    } catch {
      setError("Error al cargar datos");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

  function openEdit(item: QuickProfessional) {
    setEditingId(item.id);
    setDisplayName(item.displayName || "");
    setPhone(item.phone || "");
    setCity(item.city || "");
    setAddress("");
    setBio(item.bio || "");
    setGender(item.gender || "");
    setBirthdate(item.birthdate ? item.birthdate.slice(0, 10) : "");
    setLatitude(item.latitude);
    setLongitude(item.longitude);
    setPrimaryCategory(item.primaryCategory || item.serviceCategory || "Escort");
    setTier(item.tier || "");
    setProfileTags(item.profileTags || []);
    setServiceTags(item.serviceTags || []);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);

    const payload = {
      displayName,
      phone: phone || null,
      city,
      address: address || null,
      bio: bio || null,
      gender: gender || null,
      birthdate: birthdate || null,
      latitude,
      longitude,
      primaryCategory,
      serviceCategory: primaryCategory,
      tier: tier || null,
      profileTags,
      serviceTags,
    };

    try {
      if (editingId) {
        await apiFetch(`/admin/quick-professionals/${editingId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setSuccess("Perfil actualizado");
      } else {
        await apiFetch("/admin/quick-professionals", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSuccess("Perfil creado");
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
    if (!confirm("Eliminar este perfil profesional?")) return;
    setBusy(true);
    try {
      await apiFetch(`/admin/quick-professionals/${id}`, { method: "DELETE" });
      setSuccess("Eliminado");
      await loadData();
    } catch {
      setError("Error al eliminar");
    } finally {
      setBusy(false);
    }
  }

  function triggerUpload(id: string) {
    uploadTargetId.current = id;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = uploadTargetId.current;
    if (!file || !id) return;
    e.target.value = "";

    setUploading(id);
    try {
      const form = new FormData();
      form.append("file", file);
      await apiFetch(`/admin/quick-professionals/${id}/upload`, {
        method: "POST",
        body: form,
      });
      setSuccess("Foto subida");
      await loadData();
    } catch {
      setError("Error al subir foto");
    } finally {
      setUploading(null);
    }
  }

  async function handleUrlUpload(id: string) {
    const url = urlInputValue.trim();
    if (!url) return;
    setUploading(id);
    try {
      await apiFetch(`/admin/quick-professionals/${id}/upload-url`, {
        method: "POST",
        body: JSON.stringify({ imageUrl: url }),
      });
      setSuccess("Foto importada desde URL");
      setUrlInputOpen(null);
      setUrlInputValue("");
      await loadData();
    } catch {
      setError("Error al importar foto desde URL");
    } finally {
      setUploading(null);
    }
  }

  async function handleDeleteMedia(profId: string, mediaId: string) {
    setUploading(profId);
    try {
      await apiFetch(`/admin/quick-professionals/${profId}/media/${mediaId}`, {
        method: "DELETE",
      });
      await loadData();
    } catch {
      setError("Error al eliminar foto");
    } finally {
      setUploading(null);
    }
  }

  function toggleTag(list: string[], setList: (v: string[]) => void, tag: string) {
    setList(list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag]);
  }

  if (loading) return <div className="p-8 text-white/60">Cargando...</div>;
  if (!isAdmin) return <div className="p-8 text-red-400">Acceso denegado</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="rounded-lg border border-white/10 p-2 hover:bg-white/5">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-xl font-bold">Profesionales Rapidos</h1>
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
              {editingId ? "Editar profesional" : "Nuevo perfil profesional"}
            </h2>
            <button type="button" onClick={resetForm} className="rounded-lg p-1 hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Name */}
            <div className="grid gap-2">
              <label className="text-sm text-white/70">Nombre *</label>
              <input
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Camila"
                required
              />
            </div>

            {/* Category */}
            <div className="grid gap-2">
              <label className="text-sm text-white/70">Categoria *</label>
              <select
                className="input"
                value={primaryCategory}
                onChange={(e) => setPrimaryCategory(e.target.value)}
                required
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Address with Mapbox autocomplete */}
            <div className="sm:col-span-2">
              <MapboxAddressAutocomplete
                label="Direccion / Ubicacion *"
                value={address}
                placeholder="Av. Providencia 1234, Santiago"
                required={!editingId}
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
                  Ubicacion: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </p>
              )}
            </div>

            {/* City */}
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

            {/* Phone */}
            <div className="grid gap-2">
              <label className="flex items-center gap-1.5 text-sm text-white/70">
                <Phone className="h-3.5 w-3.5 text-fuchsia-400" />
                Telefono
              </label>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+56 9 1234 5678"
              />
            </div>

            {/* Gender */}
            <div className="grid gap-2">
              <label className="text-sm text-white/70">Genero</label>
              <select
                className="input"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
              >
                <option value="">Sin especificar</option>
                <option value="FEMALE">Mujer</option>
                <option value="MALE">Hombre</option>
                <option value="OTHER">Otro</option>
              </select>
            </div>

            {/* Birthdate */}
            <div className="grid gap-2">
              <label className="flex items-center gap-1.5 text-sm text-white/70">
                <Calendar className="h-3.5 w-3.5 text-fuchsia-400" />
                Fecha de nacimiento
              </label>
              <input
                type="date"
                className="input"
                value={birthdate}
                onChange={(e) => setBirthdate(e.target.value)}
              />
            </div>

            {/* Tier */}
            <div className="grid gap-2">
              <label className="text-sm text-white/70">Nivel</label>
              <select
                className="input"
                value={tier}
                onChange={(e) => setTier(e.target.value)}
              >
                <option value="">Sin nivel</option>
                <option value="PREMIUM">Premium</option>
                <option value="GOLD">Gold</option>
                <option value="SILVER">Silver</option>
              </select>
            </div>

            {/* Bio / Description */}
            <div className="grid gap-2 sm:col-span-2">
              <label className="text-sm text-white/70">Descripcion / Bio</label>
              <textarea
                className="input min-h-[80px] resize-y"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Breve descripcion del perfil..."
              />
            </div>

            {/* Profile Tags */}
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm text-white/70">Etiquetas de perfil</label>
              <div className="flex flex-wrap gap-2">
                {PROFILE_TAG_OPTIONS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(profileTags, setProfileTags, tag)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      profileTags.includes(tag)
                        ? "bg-fuchsia-600 text-white"
                        : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Service Tags */}
            <div className="sm:col-span-2">
              <label className="mb-2 block text-sm text-white/70">Etiquetas de servicio</label>
              <div className="flex flex-wrap gap-2">
                {SERVICE_TAG_OPTIONS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(serviceTags, setServiceTags, tag)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                      serviceTags.includes(tag)
                        ? "bg-violet-600 text-white"
                        : "border border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
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
              {editingId ? "Guardar cambios" : "Crear perfil"}
            </button>
          </div>
        </form>
      )}

      {/* Listing */}
      {busy && !showForm ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-fuchsia-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center text-white/50">
          No hay profesionales rapidos aun. Haz clic en &quot;Agregar&quot; para crear uno.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const age = item.birthdate
              ? Math.floor((Date.now() - new Date(item.birthdate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
              : null;
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                {/* Top row */}
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Avatar */}
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/5">
                      {item.avatarUrl ? (
                        <img
                          src={resolveMediaUrl(item.avatarUrl) ?? item.avatarUrl}
                          alt={item.displayName || ""}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <User className="h-5 w-5 text-white/30" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-semibold">{item.displayName}</h3>
                        {age != null && (
                          <span className="shrink-0 text-xs text-white/40">{age} anos</span>
                        )}
                        <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/60">
                          {item.primaryCategory || item.serviceCategory || "Escort"}
                        </span>
                        {item.tier && (
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            item.tier === "PREMIUM" ? "bg-violet-500/20 text-violet-300" :
                            item.tier === "GOLD" ? "bg-amber-500/20 text-amber-300" :
                            "bg-slate-500/20 text-slate-300"
                          }`}>
                            {item.tier}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-white/50">
                        <MapPin className="h-3 w-3" />
                        {item.city}
                        {item.latitude != null && (
                          <span className="text-emerald-400/60">({item.latitude.toFixed(2)}, {item.longitude?.toFixed(2)})</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => triggerUpload(item.id)}
                      disabled={uploading === item.id}
                      className="flex items-center gap-1.5 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-2 text-xs font-medium text-fuchsia-300 hover:bg-fuchsia-500/20 disabled:opacity-50"
                      title="Subir foto desde dispositivo"
                    >
                      {uploading === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImagePlus className="h-4 w-4" />
                      )}
                      Foto
                    </button>
                    <button
                      onClick={() => { setUrlInputOpen(urlInputOpen === item.id ? null : item.id); setUrlInputValue(""); }}
                      disabled={uploading === item.id}
                      className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-xs font-medium text-violet-300 hover:bg-violet-500/20 disabled:opacity-50"
                      title="Importar foto desde URL"
                    >
                      <Link2 className="h-4 w-4" />
                      URL
                    </button>
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

                {/* Tags */}
                {(item.profileTags.length > 0 || item.serviceTags.length > 0) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.profileTags.map((tag) => (
                      <span key={`p-${tag}`} className="rounded-full bg-fuchsia-600/20 px-2 py-0.5 text-[10px] text-fuchsia-300">
                        {tag}
                      </span>
                    ))}
                    {item.serviceTags.map((tag) => (
                      <span key={`s-${tag}`} className="rounded-full bg-violet-600/20 px-2 py-0.5 text-[10px] text-violet-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* URL import input */}
                {urlInputOpen === item.id && (
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="url"
                      placeholder="https://ejemplo.com/foto.jpg"
                      value={urlInputValue}
                      onChange={(e) => setUrlInputValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleUrlUpload(item.id); }}
                      className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm outline-none placeholder:text-white/20 focus:border-violet-500/40"
                    />
                    <button
                      onClick={() => handleUrlUpload(item.id)}
                      disabled={!urlInputValue.trim() || uploading === item.id}
                      className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                    >
                      {uploading === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Importar"}
                    </button>
                    <button
                      onClick={() => { setUrlInputOpen(null); setUrlInputValue(""); }}
                      className="rounded-lg border border-white/10 p-1.5 text-white/40 hover:bg-white/10"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                {/* Gallery */}
                {item.profileMedia && item.profileMedia.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {item.profileMedia.map((media) => (
                      <div key={media.id} className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-white/10">
                        <img
                          src={resolveMediaUrl(media.url) ?? media.url}
                          alt="Foto"
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteMedia(item.id, media.id)}
                          className="absolute right-0.5 top-0.5 hidden rounded-full bg-black/70 p-0.5 text-red-400 hover:text-red-300 group-hover:block"
                          title="Eliminar foto"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

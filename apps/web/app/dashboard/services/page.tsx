"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useMe from "../../../hooks/useMe";
import { apiFetch, friendlyErrorMessage, resolveMediaUrl } from "../../../lib/api";

type ServiceMedia = { id: string; url: string; type: "IMAGE" | "VIDEO" };
type ServiceItem = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  price?: number | null;
  createdAt: string;
  media?: ServiceMedia[];
};

type ProfileType = "PROFESSIONAL" | "ESTABLISHMENT" | "SHOP" | "CREATOR" | "VIEWER" | "CLIENT";

const labelsByProfile: Record<string, { item: string; panel: string; upload: string; helper: string }> = {
  PROFESSIONAL: {
    item: "servicio",
    panel: "Panel profesional",
    upload: "Subir fotos del servicio",
    helper: "Define perfil, fotos, edad y servicios que ofrecerás."
  },
  ESTABLISHMENT: {
    item: "habitación/servicio",
    panel: "Panel de establecimiento",
    upload: "Subir fotos de habitación",
    helper: "Publica habitaciones/servicios para solicitudes tipo booking por chat."
  },
  SHOP: {
    item: "producto",
    panel: "Panel de tienda",
    upload: "Subir fotos del producto",
    helper: "Sube productos con precio para el flujo de carro + envío de pedido por chat."
  }
};

function extractAge(source?: string | null) {
  const raw = source || "";
  const m = raw.match(/^\[edad:(\d{1,2})\]\s*/i);
  return m?.[1] ?? "";
}

function stripAge(source?: string | null) {
  const raw = source || "";
  return raw.replace(/^\[edad:(\d{1,2})\]\s*/i, "").trim();
}

export default function DashboardServicesPage() {
  const { me, loading } = useMe();
  const user = me?.user ?? null;

  const canManage = useMemo(() => {
    const t = (user?.profileType ?? "").toUpperCase();
    return ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"].includes(t);
  }, [user?.profileType]);

  const profileType = (user?.profileType ?? "CLIENT") as ProfileType;
  const labels = labelsByProfile[profileType] ?? labelsByProfile.PROFESSIONAL;

  const categoryOptions = useMemo(() => {
    if (profileType === "PROFESSIONAL") return ["Acompañamiento", "Bienestar", "Masajes"];
    if (profileType === "ESTABLISHMENT") return ["Motel", "Night Club", "Cafes"];
    return ["Lencería", "Juguetes", "Lubricantes", "Accesorios"];
  }, [profileType]);

  const [items, setItems] = useState<ServiceItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMessage, setOkMessage] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categoryOptions[0] || "");
  const [price, setPrice] = useState<string>("");

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("FEMALE");

  useEffect(() => {
    setCategory((prev) => (prev ? prev : categoryOptions[0] || ""));
  }, [categoryOptions]);

  async function load(userId: string) {
    setError(null);
    try {
      const [servicesRes, meRes] = await Promise.all([
        apiFetch<{ items: ServiceItem[] }>(`/services/${userId}/items`),
        apiFetch<{ user: any }>("/auth/me")
      ]);
      setItems(servicesRes?.items ?? []);
      setDisplayName(meRes?.user?.displayName ?? "");
      setBio(stripAge(meRes?.user?.bio));
      setAge(extractAge(meRes?.user?.bio));
      setServiceDescription(meRes?.user?.serviceDescription ?? "");
      setGender(meRes?.user?.gender || "FEMALE");
    } catch {
      setError("No se pudieron cargar tus datos del panel.");
    }
  }

  useEffect(() => {
    if (!loading && user?.id) load(user.id);
  }, [loading, user?.id]);

  async function create() {
    setBusy(true);
    setError(null);
    setOkMessage(null);
    try {
      await apiFetch("/services/items", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || null,
          category,
          price: price ? parseInt(price, 10) : null
        })
      });
      setTitle("");
      setDescription("");
      setPrice("");
      if (user?.id) await load(user.id);
      setOkMessage(`Tu ${labels.item} fue creado correctamente.`);
    } catch (e: any) {
      setError(friendlyErrorMessage(e) || `No se pudo crear el ${labels.item}.`);
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile() {
    setBusy(true);
    setError(null);
    setOkMessage(null);
    try {
      const normalizedAge = age.trim();
      const agePrefix = normalizedAge ? `[edad:${normalizedAge}] ` : "";
      await apiFetch("/profile", {
        method: "PUT",
        body: JSON.stringify({
          displayName,
          bio: `${agePrefix}${bio}`.trim(),
          serviceDescription,
          gender
        })
      });
      setOkMessage("Perfil actualizado.");
    } catch (e: any) {
      setError(friendlyErrorMessage(e) || "No se pudo guardar tu perfil.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(`¿Eliminar este ${labels.item}?`)) return;
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

  async function uploadImage(itemId: string, files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    setBusy(true);
    setError(null);
    try {
      const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
      const res = await fetch(`${base}/services/items/${itemId}/media`, {
        method: "POST",
        credentials: "include",
        body: form
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "UPLOAD_ERROR");
      }
      if (user?.id) await load(user.id);
      setOkMessage("Fotos cargadas correctamente.");
    } catch (e: any) {
      setError(friendlyErrorMessage(e) || "No se pudieron subir las fotos.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadProfileImage(kind: "avatar" | "cover", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    setError(null);
    try {
      const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");
      const res = await fetch(`${base}/profile/${kind}`, {
        method: "POST",
        credentials: "include",
        body: form
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "UPLOAD_ERROR");
      }
      if (user?.id) await load(user.id);
      setOkMessage(kind === "avatar" ? "Foto de perfil actualizada." : "Foto de portada actualizada.");
    } catch (e: any) {
      setError(friendlyErrorMessage(e) || "No se pudo subir la imagen.");
    } finally {
      event.target.value = "";
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-white/70">Cargando...</div>;
  if (!user) return <div className="p-6 text-white/70">Debes iniciar sesión.</div>;
  if (!canManage) return <div className="p-6 text-white/70">Este panel es solo para profesionales, tiendas y establecimientos.</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{labels.panel}</h1>
          <p className="text-sm text-white/70">{labels.helper}</p>
        </div>
        <Link href="/cuenta" className="text-sm text-white/70 hover:text-white">Volver a cuenta</Link>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold">Perfil público</h2>
          <div className="mt-3 grid gap-3">
            <input className="input" placeholder="Nombre visible" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="FEMALE">Mujer</option>
              <option value="MALE">Hombre</option>
              <option value="OTHER">Otro</option>
            </select>
            <input className="input" type="number" min={18} max={99} placeholder="Edad" value={age} onChange={(e) => setAge(e.target.value)} />
            <textarea className="input min-h-[90px]" placeholder="Descripción general" value={bio} onChange={(e) => setBio(e.target.value)} />
            <textarea className="input min-h-[90px]" placeholder="Descripción de servicios" value={serviceDescription} onChange={(e) => setServiceDescription(e.target.value)} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30 cursor-pointer">
                Foto de perfil
                <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadProfileImage("avatar", e)} />
              </label>
              <label className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30 cursor-pointer">
                Foto de portada
                <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadProfileImage("cover", e)} />
              </label>
            </div>
            <button disabled={busy} onClick={saveProfile} className="rounded-xl bg-white/15 px-4 py-2 font-semibold hover:bg-white/20 disabled:opacity-50">
              Guardar perfil
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-lg font-semibold">Agregar {labels.item}</h2>
          <div className="mt-3 grid gap-3">
            <input className="input" placeholder={profileType === "SHOP" ? "Nombre del producto" : "Título del servicio"} value={title} onChange={(e) => setTitle(e.target.value)} />

            <div className="grid gap-1">
              <label className="text-xs text-white/60">Categoría (predefinida)</label>
              <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <input className="input" placeholder="Precio CLP (opcional)" value={price} onChange={(e) => setPrice(e.target.value)} />
            <textarea className="input min-h-[110px]" placeholder="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
            <button
              disabled={busy || !title.trim() || !category}
              onClick={create}
              className="rounded-xl bg-white/15 px-4 py-2 font-semibold hover:bg-white/20 disabled:opacity-50"
            >
              {busy ? "Guardando..." : `Crear ${labels.item}`}
            </button>
          </div>
        </div>
      </div>

      {okMessage ? <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">{okMessage}</div> : null}
      {error ? <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</div> : null}

      <div className="mt-6 space-y-3">
        {items.map((it) => (
          <div key={it.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold">{it.title}</div>
                <div className="text-sm text-white/70">{it.description || "Sin descripción"}</div>
                <div className="mt-2 text-xs text-white/60">
                  {it.category ? `Categoría: ${it.category}` : "Sin categoría"}{it.price ? ` · Precio: $${it.price}` : ""}
                </div>
              </div>
              <button onClick={() => remove(it.id)} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30">
                Eliminar
              </button>
            </div>

            <div className="mt-3 grid gap-2">
              <label className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm hover:bg-black/30 cursor-pointer w-fit">
                {labels.upload}
                <input type="file" multiple accept="image/*" className="hidden" onChange={(e) => uploadImage(it.id, e.target.files)} />
              </label>
              {it.media?.length ? (
                <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                  {it.media.map((m) => (
                    <div key={m.id} className="h-24 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                      <img src={resolveMediaUrl(m.url) || ""} alt={it.title} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-white/60">Sin fotos todavía.</div>
              )}
            </div>
          </div>
        ))}
        {!items.length ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-white/70">Aún no tienes {labels.item}s.</div>
        ) : null}
      </div>
    </div>
  );
}

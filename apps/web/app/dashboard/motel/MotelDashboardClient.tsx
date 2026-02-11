"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MapboxMap from "../../../components/MapboxMap";
import { apiFetch, friendlyErrorMessage, getApiBase, resolveMediaUrl } from "../../../lib/api";

type Dashboard = { profile: any; rooms: any[]; promotions: any[]; bookings: any[] };
type TabKey = "overview" | "profile" | "location" | "rooms" | "promos" | "bookings";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Publicación" },
  { key: "profile", label: "Branding" },
  { key: "location", label: "Ubicación" },
  { key: "rooms", label: "Tarifas" },
  { key: "promos", label: "Promociones" },
  { key: "bookings", label: "Reservas" },
];

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("es-CL");
}

export default function MotelDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const roomFilesRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [msg, setMsg] = useState<string | null>(null);
  const [geocodeBusy, setGeocodeBusy] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<"cover" | "avatar" | "room" | null>(null);

  const [profileDraft, setProfileDraft] = useState({
    phone: "",
    coverUrl: "",
    avatarUrl: "",
    isOpen: true,
    isPublished: true,
    address: "",
    latitude: "",
    longitude: "",
    addressLastChangedAt: null as string | null,
  });

  const [roomForm, setRoomForm] = useState<any>({ name: "", roomType: "Normal", location: "", description: "", amenities: "", photoUrls: [], price3h: "", price6h: "", priceNight: "" });
  const [promoForm, setPromoForm] = useState<any>({ title: "", description: "", discountPercent: "", discountClp: "", startsAt: "", endsAt: "", roomIds: [] });

  useEffect(() => {
    const requested = String(searchParams.get("tab") || "").toLowerCase();
    const allowed: TabKey[] = ["overview", "profile", "location", "rooms", "promos", "bookings"];
    if (requested && (allowed as string[]).includes(requested)) setTab(requested as TabKey);
  }, [searchParams]);

  async function load() {
    setError(null);
    try {
      const next = await apiFetch<Dashboard>("/motel/dashboard");
      setData(next);
      setProfileDraft({
        phone: next.profile?.phone || "",
        coverUrl: next.profile?.coverUrl || "",
        avatarUrl: next.profile?.avatarUrl || "",
        isOpen: Boolean(next.profile?.isOpen ?? true),
        isPublished: Boolean(next.profile?.isPublished ?? true),
        address: next.profile?.address || "",
        latitude: next.profile?.latitude != null ? String(next.profile.latitude) : "",
        longitude: next.profile?.longitude != null ? String(next.profile.longitude) : "",
        addressLastChangedAt: next.profile?.addressLastChangedAt || null,
      });
    } catch (e: any) {
      setError(friendlyErrorMessage(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function logout() {
    await apiFetch("/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  async function saveProfile() {
    await apiFetch("/motel/dashboard/profile", {
      method: "PUT",
      body: JSON.stringify({ phone: profileDraft.phone, isOpen: profileDraft.isOpen, isPublished: profileDraft.isPublished }),
    });
    setMsg("Publicación y contacto actualizados.");
    await load();
  }

  async function saveLocation() {
    try {
      await apiFetch("/motel/dashboard/profile", {
        method: "PUT",
        body: JSON.stringify({ address: profileDraft.address, latitude: Number(profileDraft.latitude), longitude: Number(profileDraft.longitude) }),
      });
      setMsg("Ubicación actualizada.");
      await load();
    } catch (e: any) {
      if (e?.message === "ADDRESS_LOCKED" && e?.body?.nextEditAt) {
        const nextDate = new Date(e.body.nextEditAt).toLocaleDateString("es-CL");
        setMsg(`Podrás volver a editar la dirección el ${nextDate}.`);
        return;
      }
      setMsg(friendlyErrorMessage(e));
    }
  }

  async function geocodeProfileAddress() {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
    if (!token || !profileDraft.address.trim()) return;
    setGeocodeBusy(true);
    try {
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(profileDraft.address)}.json?access_token=${token}&limit=1&language=es`);
      const first = (await res.json())?.features?.[0];
      if (first?.center?.length) {
        setProfileDraft((prev) => ({ ...prev, longitude: String(first.center[0]), latitude: String(first.center[1]), address: first.place_name || prev.address }));
      }
    } finally {
      setGeocodeBusy(false);
    }
  }

  async function uploadProfileImage(kind: "cover" | "avatar", file?: File) {
    if (!file) return;
    setUploadingAsset(kind);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await fetch(`${getApiBase()}/profile/${kind}`, { method: "POST", credentials: "include", body: fd });
      await load();
    } finally {
      setUploadingAsset(null);
    }
  }

  async function uploadRoomPhotos(files: FileList | null) {
    if (!files?.length) return;
    setUploadingAsset("room");
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append("files", f));
      const res = await fetch(`${getApiBase()}/profile/media`, { method: "POST", credentials: "include", body: fd });
      const payload = await res.json();
      const urls = (payload?.media || []).map((m: any) => String(m.url)).filter(Boolean);
      setRoomForm((f: any) => ({ ...f, photoUrls: [...(f.photoUrls || []), ...urls] }));
    } finally {
      setUploadingAsset(null);
    }
  }

  async function saveRoom() {
    const payload = {
      ...roomForm,
      amenities: String(roomForm.amenities || "").split(",").map((s) => s.trim()).filter(Boolean),
      price3h: Number(roomForm.price3h || 0),
      price6h: Number(roomForm.price6h || 0),
      priceNight: Number(roomForm.priceNight || 0),
      isActive: roomForm.isActive !== false,
    };
    if (roomForm.id) await apiFetch(`/motel/dashboard/rooms/${roomForm.id}`, { method: "PUT", body: JSON.stringify(payload) });
    else await apiFetch("/motel/dashboard/rooms", { method: "POST", body: JSON.stringify(payload) });
    setRoomForm({ name: "", roomType: "Normal", location: "", description: "", amenities: "", photoUrls: [], price3h: "", price6h: "", priceNight: "" });
    await load();
  }

  async function savePromo() {
    const payload = {
      ...promoForm,
      discountPercent: promoForm.discountPercent ? Number(promoForm.discountPercent) : null,
      discountClp: promoForm.discountClp ? Number(promoForm.discountClp) : null,
      roomIds: promoForm.roomIds,
      roomId: promoForm.roomIds?.[0] || null,
      startsAt: promoForm.startsAt || null,
      endsAt: promoForm.endsAt || null,
    };
    if (promoForm.id) await apiFetch(`/motel/dashboard/promotions/${promoForm.id}`, { method: "PUT", body: JSON.stringify(payload) });
    else await apiFetch("/motel/dashboard/promotions", { method: "POST", body: JSON.stringify(payload) });
    setPromoForm({ title: "", description: "", discountPercent: "", discountClp: "", startsAt: "", endsAt: "", roomIds: [] });
    await load();
  }

  if (loading) return <div className="text-white/70">Cargando panel motel...</div>;
  if (!data) return <div className="card p-6">No pudimos cargar el panel. {error}</div>;

  const draftLat = Number(profileDraft.latitude);
  const draftLng = Number(profileDraft.longitude);
  const hasCoords = Number.isFinite(draftLat) && Number.isFinite(draftLng);

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold">Centro de operación Motel/Hotel</h1>
            <p className="text-sm text-white/70">Gestiona publicación, disponibilidad, tarifas y reservas.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/hospedaje/${data.profile.id}?preview=true`} className="btn-primary">Ver perfil público</Link>
            <Link href="/chats" className="btn-secondary">Mensajes</Link>
            <button className="btn-secondary" onClick={logout}>Cerrar sesión</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{tabs.map((t) => <button key={t.key} className={`px-3 py-1.5 rounded-full border text-sm ${tab === t.key ? "border-fuchsia-300 bg-fuchsia-500/20" : "border-white/20 text-white/75"}`} onClick={() => setTab(t.key)}>{t.label}</button>)}</div>
      </div>

      {msg ? <div className="card p-3 text-sm">{msg}</div> : null}

      {tab === "overview" ? <div className="card p-4 grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-white/10 p-3">Estado de publicación: <b>{profileDraft.isPublished ? "Publicado" : "Borrador"}</b></div><div className="rounded-xl border border-white/10 p-3">Estado operativo: <b>{profileDraft.isOpen ? "Abierto" : "Cerrado"}</b></div><div className="rounded-xl border border-white/10 p-3">Última actualización: <b>{formatDate(data.profile?.operationalStatusUpdatedAt)}</b></div></div> : null}

      {tab === "profile" ? (
        <div className="card p-4 space-y-4">
          <div className="relative overflow-hidden rounded-3xl border border-white/10">
            <img src={resolveMediaUrl(profileDraft.coverUrl) || "/brand/splash.jpg"} className="h-52 w-full object-cover" alt="cover" />
            <button className="absolute right-3 top-3 rounded-xl border border-white/40 bg-black/40 px-3 py-1.5 text-xs" onClick={() => coverInputRef.current?.click()}>{uploadingAsset === "cover" ? "Subiendo..." : "Subir portada"}</button>
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadProfileImage("cover", e.target.files?.[0])} />
            <div className="absolute left-4 bottom-[-26px] h-20 w-20 overflow-hidden rounded-2xl border-4 border-[#1a0727] bg-[#1a0727]"><img src={resolveMediaUrl(profileDraft.avatarUrl) || "/brand/isotipo.png"} className="h-full w-full object-cover" alt="avatar" /></div>
          </div>
          <div className="pt-8 flex gap-2">
            <button className="btn-secondary" onClick={() => avatarInputRef.current?.click()}>{uploadingAsset === "avatar" ? "Subiendo..." : "Subir foto de perfil"}</button>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadProfileImage("avatar", e.target.files?.[0])} />
          </div>
          <div className="text-xs text-white/60">Recomendado: portada 1600x600 px · perfil 512x512 px.</div>
          <label className="grid gap-1 text-xs text-white/70">Teléfono de contacto
            <input className="input" value={profileDraft.phone} onChange={(e) => setProfileDraft((p) => ({ ...p, phone: e.target.value }))} />
          </label>
          <div className="grid gap-2 md:grid-cols-2">
            <button className={`rounded-xl border px-3 py-2 text-sm ${profileDraft.isPublished ? "border-emerald-300/40 bg-emerald-500/20" : "border-white/20"}`} onClick={() => setProfileDraft((p) => ({ ...p, isPublished: !p.isPublished }))}>Publicación: {profileDraft.isPublished ? "Publicado" : "Borrador"}</button>
            <button className={`rounded-xl border px-3 py-2 text-sm ${profileDraft.isOpen ? "border-emerald-300/40 bg-emerald-500/20" : "border-rose-300/40 bg-rose-500/20"}`} onClick={() => setProfileDraft((p) => ({ ...p, isOpen: !p.isOpen }))}>Establecimiento: {profileDraft.isOpen ? "Abierto" : "Cerrado"}</button>
          </div>
          <button className="btn-primary" onClick={saveProfile}>Guardar branding y estado</button>
        </div>
      ) : null}

      {tab === "location" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="card p-4 space-y-2">
            <label className="text-xs text-white/70">Dirección (editable cada 60 días)</label>
            <input className="input" value={profileDraft.address} onChange={(e) => setProfileDraft((p) => ({ ...p, address: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2"><input className="input" value={profileDraft.latitude} onChange={(e) => setProfileDraft((p) => ({ ...p, latitude: e.target.value }))} /><input className="input" value={profileDraft.longitude} onChange={(e) => setProfileDraft((p) => ({ ...p, longitude: e.target.value }))} /></div>
            <div className="text-xs text-white/60">Último cambio de dirección: {formatDate(profileDraft.addressLastChangedAt)}</div>
            <div className="flex gap-2"><button className="btn-secondary" disabled={geocodeBusy} onClick={geocodeProfileAddress}>{geocodeBusy ? "Buscando..." : "Buscar en mapa"}</button><button className="btn-primary" onClick={saveLocation}>Guardar ubicación</button></div>
          </div>
          <div className="card p-3">{hasCoords ? <MapboxMap markers={[{ id: data.profile.id, name: "Establecimiento", lat: draftLat, lng: draftLng, subtitle: profileDraft.address || "" }]} userLocation={[draftLat, draftLng]} height={340} /> : <div className="h-[340px] rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center">Sin coordenadas</div>}</div>
        </div>
      ) : null}

      {tab === "rooms" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="card p-4 space-y-2">
            <input className="input" placeholder="Nombre habitación" value={roomForm.name} onChange={(e) => setRoomForm((f: any) => ({ ...f, name: e.target.value }))} />
            <input className="input" placeholder="Ubicación interna" value={roomForm.location} onChange={(e) => setRoomForm((f: any) => ({ ...f, location: e.target.value }))} />
            <textarea className="input min-h-20" placeholder="Descripción" value={roomForm.description} onChange={(e) => setRoomForm((f: any) => ({ ...f, description: e.target.value }))} />
            <input className="input" placeholder="Amenidades coma" value={roomForm.amenities} onChange={(e) => setRoomForm((f: any) => ({ ...f, amenities: e.target.value }))} />
            <div className="grid grid-cols-3 gap-2"><input className="input" placeholder="3h" value={roomForm.price3h} onChange={(e) => setRoomForm((f: any) => ({ ...f, price3h: e.target.value }))} /><input className="input" placeholder="6h" value={roomForm.price6h} onChange={(e) => setRoomForm((f: any) => ({ ...f, price6h: e.target.value }))} /><input className="input" placeholder="Noche" value={roomForm.priceNight} onChange={(e) => setRoomForm((f: any) => ({ ...f, priceNight: e.target.value }))} /></div>
            <div className="rounded-xl border border-dashed border-white/20 p-3 text-sm" onDrop={(e) => { e.preventDefault(); uploadRoomPhotos(e.dataTransfer.files); }} onDragOver={(e) => e.preventDefault()}><div className="flex justify-between"><span>{uploadingAsset === "room" ? "Subiendo..." : "Fotos de habitación"}</span><button className="btn-secondary text-xs" onClick={() => roomFilesRef.current?.click()}>Seleccionar</button></div><input ref={roomFilesRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadRoomPhotos(e.target.files)} /></div>
            <button className="btn-primary" onClick={saveRoom}>{roomForm.id ? "Guardar" : "Crear habitación"}</button>
          </div>
          <div className="card p-4 space-y-2">{data.rooms.map((r) => <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm"><div className="flex justify-between"><div>{r.name} · {r.isActive ? "Activa" : "Inactiva"}</div><div className="flex gap-1"><button className="btn-secondary text-xs" onClick={() => setRoomForm({ id: r.id, name: r.name || "", roomType: r.roomType || "Normal", location: r.location || "", description: r.description || "", amenities: (r.amenities || []).join(","), photoUrls: r.photoUrls || [], price3h: String(r.price3h || ""), price6h: String(r.price6h || ""), priceNight: String(r.priceNight || "") })}>Editar</button><button className="btn-secondary text-xs" onClick={() => apiFetch(`/motel/dashboard/rooms/${r.id}`, { method: "PUT", body: JSON.stringify({ isActive: !r.isActive }) }).then(load)}>{r.isActive ? "Desactivar" : "Activar"}</button><button className="btn-secondary text-xs" onClick={() => apiFetch(`/motel/dashboard/rooms/${r.id}`, { method: "DELETE" }).then(load)}>Eliminar</button></div></div></div>)}</div>
        </div>
      ) : null}

      {tab === "promos" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="card p-4 space-y-2">
            <input className="input" placeholder="Título" value={promoForm.title} onChange={(e) => setPromoForm((f: any) => ({ ...f, title: e.target.value }))} />
            <textarea className="input min-h-20" placeholder="Descripción" value={promoForm.description} onChange={(e) => setPromoForm((f: any) => ({ ...f, description: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2"><input className="input" placeholder="%" value={promoForm.discountPercent} onChange={(e) => setPromoForm((f: any) => ({ ...f, discountPercent: e.target.value }))} /><input className="input" placeholder="CLP" value={promoForm.discountClp} onChange={(e) => setPromoForm((f: any) => ({ ...f, discountClp: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2"><input type="datetime-local" className="input" value={promoForm.startsAt} onChange={(e) => setPromoForm((f: any) => ({ ...f, startsAt: e.target.value }))} /><input type="datetime-local" className="input" value={promoForm.endsAt} onChange={(e) => setPromoForm((f: any) => ({ ...f, endsAt: e.target.value }))} /></div>
            <div className="rounded-xl border border-white/10 p-2">{data.rooms.map((r) => <label key={r.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={promoForm.roomIds.includes(r.id)} onChange={(e) => setPromoForm((f: any) => ({ ...f, roomIds: e.target.checked ? [...f.roomIds, r.id] : f.roomIds.filter((x: string) => x !== r.id) }))} />{r.name}</label>)}</div>
            <button className="btn-primary" onClick={savePromo}>{promoForm.id ? "Guardar" : "Crear promoción"}</button>
          </div>
          <div className="card p-4 space-y-2">{data.promotions.map((p) => <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm"><div className="flex items-center justify-between"><b>{p.title}</b><span>{p.isActive ? "Activa" : "Pausada"}</span></div><div className="mt-2 flex gap-1"><button className="btn-secondary text-xs" onClick={() => setPromoForm({ id: p.id, title: p.title || "", description: p.description || "", discountPercent: p.discountPercent ? String(p.discountPercent) : "", discountClp: p.discountClp ? String(p.discountClp) : "", startsAt: p.startsAt ? new Date(p.startsAt).toISOString().slice(0, 16) : "", endsAt: p.endsAt ? new Date(p.endsAt).toISOString().slice(0, 16) : "", roomIds: p.roomIds?.length ? p.roomIds : p.roomId ? [p.roomId] : [] })}>Editar</button><button className="btn-secondary text-xs" onClick={() => apiFetch(`/motel/dashboard/promotions/${p.id}`, { method: "PUT", body: JSON.stringify({ isActive: !p.isActive }) }).then(load)}>{p.isActive ? "Pausar" : "Activar"}</button><button className="btn-secondary text-xs" onClick={() => apiFetch(`/motel/dashboard/promotions/${p.id}`, { method: "DELETE" }).then(load)}>Eliminar</button></div></div>)}</div>
        </div>
      ) : null}

      {tab === "bookings" ? <div className="card p-4 text-sm text-white/75">Reservas pendientes: {data.bookings.filter((b) => b.status === "PENDIENTE").length}. Gestiona aceptación/rechazo desde este módulo.</div> : null}
    </div>
  );
}

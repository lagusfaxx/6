"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import MapboxMap from "../../../components/MapboxMap";
import { apiFetch, friendlyErrorMessage, getApiBase, resolveMediaUrl } from "../../../lib/api";

type Dashboard = { profile: any; rooms: any[]; promotions: any[]; bookings: any[] };
type RejectState = Record<string, { reason: "CERRADO" | "SIN_HABITACIONES" | "OTRO"; note: string }>;
type TabKey = "overview" | "profile" | "location" | "rooms" | "promos" | "bookings";

type RoomForm = {
  id?: string;
  name: string;
  roomType: string;
  description: string;
  location: string;
  amenities: string;
  photoUrls: string[];
  price3h: string;
  price6h: string;
  priceNight: string;
  isActive?: boolean;
};

type PromoForm = {
  id?: string;
  title: string;
  description: string;
  discountPercent: string;
  discountClp: string;
  startsAt: string;
  endsAt: string;
  roomIds: string[];
  isActive?: boolean;
};

const emptyRoom: RoomForm = {
  name: "",
  roomType: "Normal",
  description: "",
  location: "",
  amenities: "",
  photoUrls: [],
  price3h: "",
  price6h: "",
  priceNight: "",
};

const emptyPromo: PromoForm = {
  title: "",
  description: "",
  discountPercent: "",
  discountClp: "",
  startsAt: "",
  endsAt: "",
  roomIds: [],
};

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "overview", label: "Resumen" },
  { key: "profile", label: "Perfil" },
  { key: "location", label: "Ubicación" },
  { key: "rooms", label: "Habitaciones" },
  { key: "promos", label: "Promociones" },
  { key: "bookings", label: "Reservas" },
];

function getPromoStatus(promo: any): "ACTIVA" | "PROGRAMADA" | "EXPIRADA" | "PAUSADA" {
  const now = Date.now();
  const starts = promo.startsAt ? new Date(promo.startsAt).getTime() : null;
  const ends = promo.endsAt ? new Date(promo.endsAt).getTime() : null;
  if (promo.isActive === false) return "PAUSADA";
  if (starts && starts > now) return "PROGRAMADA";
  if (ends && ends < now) return "EXPIRADA";
  return "ACTIVA";
}

export default function MotelDashboardPage() {
  const searchParams = useSearchParams();
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const roomFilesRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [msg, setMsg] = useState<string | null>(null);
  const [rejectByBooking, setRejectByBooking] = useState<RejectState>({});
  const [roomForm, setRoomForm] = useState<RoomForm>(emptyRoom);
  const [promoForm, setPromoForm] = useState<PromoForm>(emptyPromo);
  const [geocodeBusy, setGeocodeBusy] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [uploadingAsset, setUploadingAsset] = useState<"cover" | "avatar" | "room" | null>(null);

  const profileForm = useMemo(
    () => ({
      displayName: data?.profile?.displayName || "",
      address: data?.profile?.address || "",
      city: data?.profile?.city || "",
      phone: data?.profile?.phone || "",
      schedule: data?.profile?.schedule || "",
      rules: data?.profile?.rules || "",
      latitude: data?.profile?.latitude != null ? String(data?.profile?.latitude) : "",
      longitude: data?.profile?.longitude != null ? String(data?.profile?.longitude) : "",
      coverUrl: data?.profile?.coverUrl || "",
      avatarUrl: data?.profile?.avatarUrl || "",
    }),
    [data?.profile]
  );
  const [profileDraft, setProfileDraft] = useState(profileForm);
  useEffect(() => setProfileDraft(profileForm), [profileForm]);

  useEffect(() => {
    const requested = String(searchParams.get("tab") || "").toLowerCase();
    const allowed: TabKey[] = ["overview", "profile", "location", "rooms", "promos", "bookings"];
    if (requested && (allowed as string[]).includes(requested)) setTab(requested as TabKey);
  }, [searchParams]);

  const load = async () => {
    setError(null);
    try {
      const next = await apiFetch<Dashboard>("/motel/dashboard");
      setData(next);
    } catch (e: any) {
      setError(friendlyErrorMessage(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  async function uploadProfileImage(kind: "cover" | "avatar", file?: File) {
    if (!file) return;
    setUploadingAsset(kind);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await fetch(`${getApiBase()}/profile/${kind}`, { method: "POST", credentials: "include", body: fd });
      setMsg(kind === "cover" ? "Portada actualizada" : "Foto de perfil actualizada");
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
      if (!res.ok) throw new Error("UPLOAD_FAILED");
      const payload = await res.json();
      const urls = (payload?.media || []).map((m: any) => String(m.url)).filter(Boolean);
      setRoomForm((f) => ({ ...f, photoUrls: [...f.photoUrls, ...urls] }));
      setMsg("Fotos de habitación cargadas.");
    } catch {
      setMsg("No se pudieron subir las fotos de habitación.");
    } finally {
      setUploadingAsset(null);
    }
  }

  if (loading) return <div className="text-white/70">Cargando panel motel...</div>;
  if (!data) return <div className="card p-6">No pudimos cargar el panel. {error}</div>;

  async function saveProfile() {
    await apiFetch("/motel/dashboard/profile", { method: "PUT", body: JSON.stringify(profileDraft) });
    setMsg("Perfil actualizado");
    await load();
  }

  async function rejectBooking(bookingId: string) {
    const reject = rejectByBooking[bookingId] || { reason: "CERRADO", note: "" };
    if (reject.reason === "OTRO" && !reject.note.trim()) return setMsg("Si eliges OTRO, debes escribir un motivo.");
    await apiFetch(`/motel/bookings/${bookingId}/action`, {
      method: "POST",
      body: JSON.stringify({ action: "REJECT", rejectReason: reject.reason, rejectNote: reject.note || null }),
    });
    setMsg("Reserva rechazada y cliente notificado por chat.");
    await load();
  }

  async function geocodeProfileAddress() {
    const address = profileDraft.address.trim();
    if (!address) return setGeocodeError("Ingresa una dirección para ubicar en el mapa.");
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
    if (!token) return setGeocodeError("Falta NEXT_PUBLIC_MAPBOX_TOKEN para buscar la dirección en el mapa.");
    setGeocodeBusy(true);
    setGeocodeError(null);
    try {
      const res = await fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=1&language=es`);
      if (!res.ok) throw new Error("GEOCODE_FAILED");
      const first = (await res.json())?.features?.[0];
      if (!first?.center?.length) throw new Error("NO_RESULTS");
      setProfileDraft((prev) => ({ ...prev, longitude: String(first.center[0]), latitude: String(first.center[1]), address: first.place_name || prev.address }));
      setMsg("Dirección vinculada al mapa. Guarda los cambios para persistir coordenadas.");
    } catch {
      setGeocodeError("No pudimos geocodificar la dirección. Revisa el texto e intenta nuevamente.");
    } finally {
      setGeocodeBusy(false);
    }
  }

  async function saveRoom() {
    const payload = {
      ...roomForm,
      amenities: roomForm.amenities.split(",").map((s) => s.trim()).filter(Boolean),
      price3h: Number(roomForm.price3h || 0),
      price6h: Number(roomForm.price6h || 0),
      priceNight: Number(roomForm.priceNight || 0),
      isActive: roomForm.isActive !== false,
    };
    if (roomForm.id) {
      await apiFetch(`/motel/dashboard/rooms/${roomForm.id}`, { method: "PUT", body: JSON.stringify(payload) });
      setMsg("Habitación actualizada.");
    } else {
      await apiFetch("/motel/dashboard/rooms", { method: "POST", body: JSON.stringify(payload) });
      setMsg("Habitación creada.");
    }
    setRoomForm(emptyRoom);
    await load();
  }

  async function deleteRoom(id: string) {
    if (!confirm("¿Eliminar esta habitación?")) return;
    await apiFetch(`/motel/dashboard/rooms/${id}`, { method: "DELETE" });
    setMsg("Habitación eliminada.");
    await load();
  }

  async function savePromo() {
    const payload = {
      ...promoForm,
      discountPercent: promoForm.discountPercent ? Number(promoForm.discountPercent) : null,
      discountClp: promoForm.discountClp ? Number(promoForm.discountClp) : null,
      startsAt: promoForm.startsAt || null,
      endsAt: promoForm.endsAt || null,
      roomIds: promoForm.roomIds,
      roomId: promoForm.roomIds[0] || null,
      isActive: promoForm.isActive !== false,
    };
    if (promoForm.id) {
      await apiFetch(`/motel/dashboard/promotions/${promoForm.id}`, { method: "PUT", body: JSON.stringify(payload) });
      setMsg("Promoción actualizada.");
    } else {
      await apiFetch("/motel/dashboard/promotions", { method: "POST", body: JSON.stringify(payload) });
      setMsg("Promoción creada.");
    }
    setPromoForm(emptyPromo);
    await load();
  }

  async function deletePromo(id: string) {
    if (!confirm("¿Eliminar esta promoción?")) return;
    await apiFetch(`/motel/dashboard/promotions/${id}`, { method: "DELETE" });
    setMsg("Promoción eliminada.");
    await load();
  }

  const draftLat = Number(profileDraft.latitude);
  const draftLng = Number(profileDraft.longitude);
  const hasCoords = Number.isFinite(draftLat) && Number.isFinite(draftLng);

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard Motel/Hotel</h1>
            <p className="text-sm text-white/70 mt-1">Panel operativo unificado para perfil, habitaciones, promociones, reservas y ubicación.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/hospedaje/${data.profile.id}?preview=true`} className="btn-primary">Ver perfil público</Link>
            <Link href="/chats" className="btn-secondary">Mensajes</Link>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">{tabs.map((t) => <button key={t.key} className={`px-3 py-1.5 rounded-full border text-sm ${tab === t.key ? "border-fuchsia-300 bg-fuchsia-500/20" : "border-white/20 text-white/75"}`} onClick={() => setTab(t.key)}>{t.label}</button>)}</div>
      </div>

      {msg ? <div className="card p-3 text-sm">{msg}</div> : null}

      {tab === "profile" ? (
        <div className="card p-4 space-y-4">
          <div className="relative overflow-hidden rounded-3xl border border-white/10">
            <img src={resolveMediaUrl(profileDraft.coverUrl) || "/brand/splash.jpg"} className="h-52 w-full object-cover" alt="cover" />
            <button className="absolute right-3 top-3 rounded-xl border border-white/40 bg-black/40 px-3 py-1.5 text-xs" onClick={() => coverInputRef.current?.click()}>{uploadingAsset === "cover" ? "Subiendo..." : "Subir portada"}</button>
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadProfileImage("cover", e.target.files?.[0])} />
            <div className="absolute left-4 bottom-[-26px] h-20 w-20 overflow-hidden rounded-2xl border-4 border-[#1a0727] bg-[#1a0727]">
              <img src={resolveMediaUrl(profileDraft.avatarUrl) || "/brand/isotipo.png"} className="h-full w-full object-cover" alt="avatar" />
            </div>
          </div>
          <div className="pt-8 flex gap-2">
            <button className="btn-secondary" onClick={() => avatarInputRef.current?.click()}>{uploadingAsset === "avatar" ? "Subiendo..." : "Subir foto de perfil"}</button>
            <button className="btn-secondary" onClick={() => setProfileDraft((prev) => ({ ...prev, avatarUrl: "", coverUrl: "" }))}>Limpiar imágenes</button>
            <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadProfileImage("avatar", e.target.files?.[0])} />
          </div>
          <div className="text-xs text-white/60">Recomendado: portada 1600x600 px · perfil 512x512 px.</div>
          <div className="grid gap-3 md:grid-cols-2">
            {(["displayName", "city", "phone", "schedule", "rules"] as const).map((key) => (
              <label key={key} className="grid gap-1 text-xs text-white/70">{key}
                <input className="input" value={profileDraft[key]} onChange={(e) => setProfileDraft((prev) => ({ ...prev, [key]: e.target.value }))} />
              </label>
            ))}
            <label className="grid gap-1 text-xs text-white/70 md:col-span-2">address
              <input className="input" value={profileDraft.address} onChange={(e) => setProfileDraft((prev) => ({ ...prev, address: e.target.value }))} />
            </label>
          </div>
          <button className="btn-primary" onClick={saveProfile}>Guardar perfil</button>
        </div>
      ) : null}

      {tab === "location" ? (
        <div className="grid gap-3 lg:grid-cols-2"><div className="card p-4 space-y-2"><input className="input" value={profileDraft.address} onChange={(e) => setProfileDraft((prev) => ({ ...prev, address: e.target.value }))} /><div className="grid grid-cols-2 gap-2"><input className="input" value={profileDraft.latitude} onChange={(e) => setProfileDraft((prev) => ({ ...prev, latitude: e.target.value }))} /><input className="input" value={profileDraft.longitude} onChange={(e) => setProfileDraft((prev) => ({ ...prev, longitude: e.target.value }))} /></div>{geocodeError ? <div className="text-xs text-rose-300">{geocodeError}</div> : null}<div className="flex gap-2"><button className="btn-secondary" onClick={geocodeProfileAddress} disabled={geocodeBusy}>{geocodeBusy ? "Buscando..." : "Buscar en mapa"}</button><button className="btn-primary" onClick={saveProfile}>Guardar ubicación</button></div></div><div className="card p-3">{hasCoords ? <MapboxMap markers={[{ id: data.profile.id, name: profileDraft.displayName || "Establecimiento", lat: draftLat, lng: draftLng, subtitle: profileDraft.address || "" }]} userLocation={[draftLat, draftLng]} height={340} /> : <div className="h-[340px] rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-sm text-white/60">Sin coordenadas aún</div>}</div></div>
      ) : null}

      {tab === "rooms" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="card p-4 space-y-2">
            <h3 className="font-semibold">{roomForm.id ? "Editar habitación" : "Nueva habitación"}</h3>
            <input className="input" placeholder="Nombre" value={roomForm.name} onChange={(e) => setRoomForm((f) => ({ ...f, name: e.target.value }))} />
            <input className="input" placeholder="Ubicación de la habitación (piso, torre)" value={roomForm.location} onChange={(e) => setRoomForm((f) => ({ ...f, location: e.target.value }))} />
            <textarea className="input min-h-24" placeholder="Descripción" value={roomForm.description} onChange={(e) => setRoomForm((f) => ({ ...f, description: e.target.value }))} />
            <input className="input" placeholder="Amenidades separadas por coma" value={roomForm.amenities} onChange={(e) => setRoomForm((f) => ({ ...f, amenities: e.target.value }))} />
            <div className="grid grid-cols-3 gap-2"><input className="input" placeholder="3h" value={roomForm.price3h} onChange={(e) => setRoomForm((f) => ({ ...f, price3h: e.target.value }))} /><input className="input" placeholder="6h" value={roomForm.price6h} onChange={(e) => setRoomForm((f) => ({ ...f, price6h: e.target.value }))} /><input className="input" placeholder="Noche" value={roomForm.priceNight} onChange={(e) => setRoomForm((f) => ({ ...f, priceNight: e.target.value }))} /></div>
            <div className="rounded-xl border border-dashed border-white/20 p-3 text-sm text-white/80" onDrop={(e) => { e.preventDefault(); uploadRoomPhotos(e.dataTransfer.files); }} onDragOver={(e) => e.preventDefault()}>
              <div className="flex justify-between items-center"><span>{uploadingAsset === "room" ? "Subiendo fotos..." : "Arrastra fotos aquí o selecciónalas"}</span><button type="button" className="btn-secondary text-xs" onClick={() => roomFilesRef.current?.click()}>Seleccionar</button></div>
              <input ref={roomFilesRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadRoomPhotos(e.target.files)} />
            </div>
            <div className="space-y-1">{roomForm.photoUrls.map((url, idx) => <div key={`${url}-${idx}`} className="flex items-center gap-2 text-xs"><img src={resolveMediaUrl(url) || ""} className="h-10 w-14 rounded object-cover" alt="foto" /><button className="btn-secondary text-xs" onClick={() => setRoomForm((f) => ({ ...f, photoUrls: f.photoUrls.filter((_, i) => i !== idx) }))}>Eliminar</button><button className="btn-secondary text-xs" disabled={idx === 0} onClick={() => setRoomForm((f) => ({ ...f, photoUrls: f.photoUrls.map((v, i) => i === idx - 1 ? f.photoUrls[idx] : i === idx ? f.photoUrls[idx - 1] : v) }))}>↑</button><button className="btn-secondary text-xs" disabled={idx === roomForm.photoUrls.length - 1} onClick={() => setRoomForm((f) => ({ ...f, photoUrls: f.photoUrls.map((v, i) => i === idx + 1 ? f.photoUrls[idx] : i === idx ? f.photoUrls[idx + 1] : v) }))}>↓</button></div>)}</div>
            <div className="flex gap-2"><button className="btn-primary" onClick={saveRoom}>{roomForm.id ? "Guardar cambios" : "Crear habitación"}</button>{roomForm.id ? <button className="btn-secondary" onClick={() => setRoomForm(emptyRoom)}>Cancelar</button> : null}</div>
          </div>
          <div className="card p-4 space-y-2"><h3 className="font-semibold">Habitaciones actuales</h3>{data.rooms.length ? data.rooms.map((r) => <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm"><div className="flex justify-between"><div>{r.name} · {r.isActive ? "Activa" : "Inactiva"}</div><div className="flex gap-1"><button className="btn-secondary text-xs" onClick={() => setRoomForm({ id: r.id, name: r.name || "", roomType: r.roomType || "Normal", description: r.description || "", location: r.location || "", amenities: (r.amenities || []).join(", "), photoUrls: r.photoUrls || [], price3h: String(r.price3h || r.price || ""), price6h: String(r.price6h || ""), priceNight: String(r.priceNight || ""), isActive: Boolean(r.isActive) })}>Editar</button><button className="btn-secondary text-xs" onClick={() => apiFetch(`/motel/dashboard/rooms/${r.id}`, { method: "PUT", body: JSON.stringify({ isActive: !r.isActive }) }).then(load)}>{r.isActive ? "Desactivar" : "Activar"}</button><button className="btn-secondary text-xs" onClick={() => deleteRoom(r.id)}>Eliminar</button></div></div><div className="text-white/70">3h ${Number(r.price3h || r.price || 0).toLocaleString("es-CL")} · 6h ${Number(r.price6h || r.price || 0).toLocaleString("es-CL")} · Noche ${Number(r.priceNight || r.price || 0).toLocaleString("es-CL")}</div></div>) : <div className="text-white/60 text-sm">No hay habitaciones.</div>}</div>
        </div>
      ) : null}

      {tab === "promos" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="card p-4 space-y-2">
            <h3 className="font-semibold">{promoForm.id ? "Editar promoción" : "Nueva promoción"}</h3>
            <input className="input" placeholder="Título" value={promoForm.title} onChange={(e) => setPromoForm((f) => ({ ...f, title: e.target.value }))} />
            <textarea className="input min-h-20" placeholder="Descripción" value={promoForm.description} onChange={(e) => setPromoForm((f) => ({ ...f, description: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2"><input className="input" placeholder="% descuento" value={promoForm.discountPercent} onChange={(e) => setPromoForm((f) => ({ ...f, discountPercent: e.target.value }))} /><input className="input" placeholder="Monto fijo CLP" value={promoForm.discountClp} onChange={(e) => setPromoForm((f) => ({ ...f, discountClp: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-2"><input type="datetime-local" className="input" value={promoForm.startsAt} onChange={(e) => setPromoForm((f) => ({ ...f, startsAt: e.target.value }))} /><input type="datetime-local" className="input" value={promoForm.endsAt} onChange={(e) => setPromoForm((f) => ({ ...f, endsAt: e.target.value }))} /></div>
            <div className="rounded-xl border border-white/10 p-2 space-y-1">{data.rooms.map((r) => <label key={r.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={promoForm.roomIds.includes(r.id)} onChange={(e) => setPromoForm((f) => ({ ...f, roomIds: e.target.checked ? [...f.roomIds, r.id] : f.roomIds.filter((id) => id !== r.id) }))} />{r.name}</label>)}</div>
            <button className="btn-primary" onClick={savePromo}>{promoForm.id ? "Guardar promoción" : "Crear promoción"}</button>
          </div>
          <div className="card p-4 space-y-2"><h3 className="font-semibold">Promociones</h3>{data.promotions.length ? data.promotions.map((p) => <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm"><div className="flex items-center justify-between"><div>{p.title}</div><span className="text-xs px-2 py-0.5 rounded-full border border-fuchsia-300/30">{getPromoStatus(p)}</span></div><div className="text-white/70">{p.discountPercent ? `-${p.discountPercent}%` : p.discountClp ? `-$${Number(p.discountClp).toLocaleString("es-CL")}` : "Sin descuento"}</div><div className="text-xs text-white/60">{p.startsAt ? new Date(p.startsAt).toLocaleDateString("es-CL") : "Inmediata"} → {p.endsAt ? new Date(p.endsAt).toLocaleDateString("es-CL") : "Sin término"}</div><div className="mt-2 flex gap-1"><button className="btn-secondary text-xs" onClick={() => setPromoForm({ id: p.id, title: p.title || "", description: p.description || "", discountPercent: p.discountPercent ? String(p.discountPercent) : "", discountClp: p.discountClp ? String(p.discountClp) : "", startsAt: p.startsAt ? new Date(p.startsAt).toISOString().slice(0, 16) : "", endsAt: p.endsAt ? new Date(p.endsAt).toISOString().slice(0, 16) : "", roomIds: p.roomIds?.length ? p.roomIds : p.roomId ? [p.roomId] : [], isActive: Boolean(p.isActive) })}>Editar</button><button className="btn-secondary text-xs" onClick={() => apiFetch(`/motel/dashboard/promotions/${p.id}`, { method: "PUT", body: JSON.stringify({ isActive: !p.isActive }) }).then(load)}>{p.isActive ? "Pausar" : "Activar"}</button><button className="btn-secondary text-xs" onClick={() => setPromoForm((f) => ({ ...f, id: p.id, title: p.title, startsAt: new Date().toISOString().slice(0, 16) }))}>Renovar</button><button className="btn-secondary text-xs" onClick={() => deletePromo(p.id)}>Eliminar</button></div></div>) : <div className="text-sm text-white/60">No hay promociones.</div>}</div>
        </div>
      ) : null}

      {tab === "bookings" ? (
        <div className="card p-4 space-y-3">{data.bookings.map((b) => { const reject = rejectByBooking[b.id] || { reason: "CERRADO", note: "" }; return <div key={b.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm"><div className="flex items-center justify-between gap-2"><div>{b.clientName || b.clientUsername || "Cliente"} · {b.roomName || "Suite"}</div><Link className="text-xs underline text-fuchsia-200" href={`/chat/${b.clientId}`}>Abrir chat</Link></div><div className="text-white/70">{b.durationType} · ${Number(b.priceClp || 0).toLocaleString("es-CL")} · {b.status}</div>{b.status === "PENDIENTE" ? <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]"><select className="input" value={reject.reason} onChange={(e) => setRejectByBooking((prev) => ({ ...prev, [b.id]: { ...reject, reason: e.target.value as any } }))}><option value="CERRADO">Cerrado</option><option value="SIN_HABITACIONES">Sin habitaciones</option><option value="OTRO">Otro motivo</option></select><input className="input" value={reject.note} onChange={(e) => setRejectByBooking((prev) => ({ ...prev, [b.id]: { ...reject, note: e.target.value } }))} /><button className="btn-primary text-xs" onClick={async () => { await apiFetch(`/motel/bookings/${b.id}/action`, { method: "POST", body: JSON.stringify({ action: "ACCEPT" }) }); await load(); }}>Aceptar</button><button className="btn-secondary text-xs" onClick={() => rejectBooking(b.id)}>Rechazar</button></div> : null}</div>; })}</div>
      ) : null}

      {tab === "overview" ? <div className="card p-4 text-sm text-white/75">Usa este panel para completar identidad visual, administrar habitaciones, promociones y reservas.</div> : null}
    </div>
  );
}

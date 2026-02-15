"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import MapboxMap from "../../../components/MapboxMap";
import { apiFetch, friendlyErrorMessage, getApiBase, resolveMediaUrl } from "../../../lib/api";

type Dashboard = { profile: any; rooms: any[]; promotions: any[]; bookings: any[] };
type TabKey = "overview" | "profile" | "location" | "rooms" | "promos" | "bookings";

const tabsMeta: Array<{ key: TabKey; label: string; icon: string }> = [
  { key: "overview", label: "Resumen", icon: "📊" },
  { key: "profile", label: "Branding", icon: "🎨" },
  { key: "location", label: "Ubicación", icon: "📍" },
  { key: "rooms", label: "Habitaciones", icon: "🛏️" },
  { key: "promos", label: "Promociones", icon: "🏷️" },
  { key: "bookings", label: "Reservas", icon: "📅" },
];

function formatDate(iso?: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("es-CL");
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "Por confirmar";
  return new Date(iso).toLocaleString("es-CL");
}

function formatMoney(value?: number | null) {
  return `$${Number(value || 0).toLocaleString("es-CL")}`;
}

function durationLabel(duration?: string | null) {
  const normalized = String(duration || "3H").toUpperCase();
  if (normalized === "6H") return "6 horas";
  if (normalized === "NIGHT") return "Noche";
  return "3 horas";
}

function statusColor(status?: string | null) {
  const s = String(status || "").toUpperCase();
  if (s === "PENDIENTE") return "border-amber-400/30 bg-amber-500/15 text-amber-200";
  if (s === "ACEPTADA") return "border-blue-400/30 bg-blue-500/15 text-blue-200";
  if (s === "CONFIRMADA") return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
  if (s === "RECHAZADA") return "border-red-400/30 bg-red-500/15 text-red-200";
  if (s === "FINALIZADA") return "border-white/10 bg-white/5 text-white/60";
  if (s === "CANCELADA") return "border-white/10 bg-white/5 text-white/40";
  return "border-white/10 bg-white/5 text-white/60";
}

function bookingStatusLabel(status?: string | null) {
  const s = String(status || "").toUpperCase();
  if (s === "PENDIENTE") return "Pendiente";
  if (s === "ACEPTADA") return "Aceptada";
  if (s === "CONFIRMADA") return "Confirmada";
  if (s === "RECHAZADA") return "Rechazada";
  if (s === "FINALIZADA") return "Finalizada";
  if (s === "CANCELADA") return "Cancelada";
  return s || "-";
}

/* ── Glassmorphism input component ── */
function GlassInput({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="group block">
      <span className="mb-1.5 block text-xs font-medium text-white/50 transition-colors group-focus-within:text-fuchsia-400">{label}</span>
      <input
        {...props}
        className={`w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-fuchsia-500/40 focus:bg-white/[0.06] focus:ring-1 focus:ring-fuchsia-500/20 [color-scheme:dark] ${props.className || ""}`}
      />
    </label>
  );
}

function GlassTextarea({ label, ...props }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="group block">
      <span className="mb-1.5 block text-xs font-medium text-white/50 transition-colors group-focus-within:text-fuchsia-400">{label}</span>
      <textarea
        {...props}
        className={`w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-fuchsia-500/40 focus:bg-white/[0.06] focus:ring-1 focus:ring-fuchsia-500/20 ${props.className || ""}`}
      />
    </label>
  );
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
  const [bookingBusyId, setBookingBusyId] = useState<string | null>(null);
  const [agendaDate, setAgendaDate] = useState(new Date().toISOString().slice(0, 10));
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
      });
    } catch (e: any) {
      setError(friendlyErrorMessage(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

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
      amenities: String(roomForm.amenities || "").split(",").map((s: string) => s.trim()).filter(Boolean),
      price3h: Number(roomForm.price3h || 0),
      price6h: Number(roomForm.price6h || 0),
      priceNight: Number(roomForm.priceNight || 0),
      isActive: roomForm.isActive !== false,
    };
    if (roomForm.id) await apiFetch(`/motel/dashboard/rooms/${roomForm.id}`, { method: "PUT", body: JSON.stringify(payload) });
    else await apiFetch("/motel/dashboard/rooms", { method: "POST", body: JSON.stringify(payload) });
    setRoomForm({ name: "", roomType: "Normal", location: "", description: "", amenities: "", photoUrls: [], price3h: "", price6h: "", priceNight: "" });
    setMsg(roomForm.id ? "Habitación actualizada." : "Habitación creada.");
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
    setMsg(promoForm.id ? "Promoción actualizada." : "Promoción creada.");
    await load();
  }

  async function applyBookingAction(bookingId: string, action: "ACCEPT" | "REJECT" | "FINISH" | "DELETE") {
    setBookingBusyId(bookingId);
    try {
      if (action === "DELETE") {
        await apiFetch(`/motel/bookings/${bookingId}`, { method: "DELETE" });
        setMsg("Reserva eliminada.");
      } else {
        const payload: Record<string, any> = { action };
        if (action === "REJECT") {
          payload.rejectReason = "OTRO";
          payload.rejectNote = "No disponible";
        }
        await apiFetch(`/motel/bookings/${bookingId}/action`, { method: "POST", body: JSON.stringify(payload) });
        setMsg(action === "ACCEPT" ? "Reserva aceptada." : action === "REJECT" ? "Reserva rechazada." : "Reserva finalizada.");
      }
      await load();
    } catch (e: any) {
      setMsg(friendlyErrorMessage(e));
    } finally {
      setBookingBusyId(null);
    }
  }

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-48 rounded-3xl bg-white/[0.04]" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-white/[0.04]" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-2xl">⚠️</div>
          <h2 className="mb-2 text-xl font-semibold">Error al cargar</h2>
          <p className="text-sm text-white/60">{error || "No pudimos cargar el panel del motel."}</p>
          <button onClick={() => { setLoading(true); load(); }} className="mt-4 rounded-xl bg-white/10 px-6 py-2.5 text-sm font-medium transition hover:bg-white/15">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const draftLat = Number(profileDraft.latitude);
  const draftLng = Number(profileDraft.longitude);
  const hasCoords = Number.isFinite(draftLat) && Number.isFinite(draftLng);
  const pendingBookings = data.bookings.filter((b: any) => b.status === "PENDIENTE").length;
  const confirmedBookings = data.bookings.filter((b: any) => b.status === "CONFIRMADA").length;
  const totalRevenue = data.bookings
    .filter((b: any) => ["CONFIRMADA", "FINALIZADA"].includes(String(b.status).toUpperCase()))
    .reduce((acc: number, b: any) => acc + Number(b.priceClp || 0), 0);
  const agendaItems = data.bookings
    .filter((b: any) => (b.startAt ? new Date(b.startAt).toISOString().slice(0, 10) === agendaDate : false))
    .sort((a: any, b: any) => new Date(a.startAt || 0).getTime() - new Date(b.startAt || 0).getTime());

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-20">
      {/* ── Toast notification ── */}
      {msg && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 animate-[slideDown_0.3s_ease-out]">
          <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-black/90 px-5 py-3 shadow-2xl backdrop-blur-xl">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-xs">✓</div>
            <span className="text-sm text-white/90">{msg}</span>
            <button onClick={() => setMsg(null)} className="ml-2 text-white/40 transition hover:text-white/70">✕</button>
          </div>
        </div>
      )}

      {/* ── Hero header with cover ── */}
      <section className="relative mb-8 overflow-hidden rounded-3xl border border-white/[0.08]">
        {/* Cover image */}
        <div className="relative h-44 sm:h-52">
          {profileDraft.coverUrl ? (
            <img src={resolveMediaUrl(profileDraft.coverUrl) || "/brand/splash.jpg"} className="h-full w-full object-cover" alt="cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-fuchsia-600/20 via-violet-600/15 to-indigo-900/30">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(168,85,247,0.15),transparent_60%)]" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e12] via-[#0e0e12]/40 to-transparent" />
        </div>

        {/* Profile info overlay */}
        <div className="relative -mt-12 px-5 pb-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              {/* Avatar */}
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border-4 border-[#0e0e12] bg-[#0e0e12] shadow-xl sm:h-24 sm:w-24">
                <img
                  src={resolveMediaUrl(profileDraft.avatarUrl) || "/brand/isotipo-new.png"}
                  className="h-full w-full object-cover"
                  alt="avatar"
                />
              </div>
              <div className="mb-1">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{data.profile?.displayName || data.profile?.username || "Mi Motel"}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${profileDraft.isOpen ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300" : "border-red-400/30 bg-red-500/15 text-red-300"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${profileDraft.isOpen ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-red-400"}`} />
                    {profileDraft.isOpen ? "Abierto" : "Cerrado"}
                  </span>
                  <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${profileDraft.isPublished ? "border-violet-400/30 bg-violet-500/15 text-violet-300" : "border-white/10 bg-white/5 text-white/50"}`}>
                    {profileDraft.isPublished ? "Publicado" : "Borrador"}
                  </span>
                  {pendingBookings > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-300">
                      {pendingBookings} pendiente{pendingBookings !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/hospedaje/${data.profile.username || data.profile.id}?preview=true`}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/80 transition-all hover:border-white/20 hover:bg-white/[0.08]"
              >
                👁️ Ver perfil
              </Link>
              <Link
                href="/chats"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/80 transition-all hover:border-white/20 hover:bg-white/[0.08]"
              >
                💬 Mensajes
              </Link>
              <button
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-white/50 transition-all hover:border-red-500/20 hover:bg-red-500/5 hover:text-red-300"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Tab navigation ── */}
      <nav className="scrollbar-none mb-6 -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {tabsMeta.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
              tab === t.key
                ? "border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300 shadow-[0_0_20px_rgba(192,38,211,0.1)]"
                : "border border-transparent text-white/50 hover:bg-white/[0.04] hover:text-white/70"
            }`}
          >
            <span className="text-sm">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {/* ═══════════════════════════════════
          OVERVIEW TAB
         ═══════════════════════════════════ */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 transition-all hover:border-fuchsia-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-fuchsia-500/10 text-lg">🛏️</div>
                <div className="text-xs font-medium text-white/40">Habitaciones</div>
                <div className="mt-1 text-3xl font-bold">{data.rooms.length}</div>
                <div className="mt-1 text-xs text-white/40">{data.rooms.filter((r: any) => r.isActive).length} activas</div>
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 transition-all hover:border-amber-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-amber-600/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-lg">📋</div>
                <div className="text-xs font-medium text-white/40">Reservas pendientes</div>
                <div className="mt-1 text-3xl font-bold text-amber-300">{pendingBookings}</div>
                <div className="mt-1 text-xs text-white/40">{data.bookings.length} total</div>
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 transition-all hover:border-emerald-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-lg">✅</div>
                <div className="text-xs font-medium text-white/40">Confirmadas</div>
                <div className="mt-1 text-3xl font-bold text-emerald-300">{confirmedBookings}</div>
                <div className="mt-1 text-xs text-white/40">activas ahora</div>
              </div>
            </div>
            <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 transition-all hover:border-violet-500/20">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-lg">💰</div>
                <div className="text-xs font-medium text-white/40">Ingresos estimados</div>
                <div className="mt-1 text-3xl font-bold text-violet-300">{formatMoney(totalRevenue)}</div>
                <div className="mt-1 text-xs text-white/40">confirmadas + finalizadas</div>
              </div>
            </div>
          </div>

          {/* Quick status toggles */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Estado operativo</div>
                  <div className="mt-0.5 text-xs text-white/40">Controla si tu motel aparece como disponible</div>
                </div>
                <button
                  onClick={() => {
                    setProfileDraft((p) => ({ ...p, isOpen: !p.isOpen }));
                    apiFetch("/motel/dashboard/profile", { method: "PUT", body: JSON.stringify({ isOpen: !profileDraft.isOpen }) }).then(load);
                  }}
                  className={`relative h-8 w-14 rounded-full transition-all ${profileDraft.isOpen ? "bg-emerald-500" : "bg-white/10"}`}
                >
                  <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-all ${profileDraft.isOpen ? "left-7" : "left-1"}`} />
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">Publicación</div>
                  <div className="mt-0.5 text-xs text-white/40">Mostrar en el directorio de hospedajes</div>
                </div>
                <button
                  onClick={() => {
                    setProfileDraft((p) => ({ ...p, isPublished: !p.isPublished }));
                    apiFetch("/motel/dashboard/profile", { method: "PUT", body: JSON.stringify({ isPublished: !profileDraft.isPublished }) }).then(load);
                  }}
                  className={`relative h-8 w-14 rounded-full transition-all ${profileDraft.isPublished ? "bg-violet-500" : "bg-white/10"}`}
                >
                  <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-all ${profileDraft.isPublished ? "left-7" : "left-1"}`} />
                </button>
              </div>
            </div>
          </div>

          {/* Recent bookings preview */}
          {data.bookings.length > 0 && (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">Últimas reservas</h3>
                <button onClick={() => setTab("bookings")} className="text-xs text-fuchsia-400 transition hover:text-fuchsia-300">
                  Ver todas →
                </button>
              </div>
              <div className="space-y-2">
                {data.bookings.slice(0, 3).map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{b.clientName || b.clientUsername || "Cliente"}</div>
                      <div className="text-xs text-white/40">{b.roomName || "Habitación"} · {durationLabel(b.durationType)} · {formatDateTime(b.startAt)}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">{formatMoney(b.priceClp)}</span>
                      <span className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${statusColor(b.status)}`}>
                        {bookingStatusLabel(b.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active promos */}
          {data.promotions.filter((p: any) => p.isActive).length > 0 && (
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">Promociones activas</h3>
                <button onClick={() => setTab("promos")} className="text-xs text-fuchsia-400 transition hover:text-fuchsia-300">
                  Gestionar →
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {data.promotions.filter((p: any) => p.isActive).map((p: any) => (
                  <div key={p.id} className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 px-4 py-2.5">
                    <div className="text-sm font-semibold text-fuchsia-300">{p.title}</div>
                    <div className="mt-0.5 text-xs text-white/40">
                      {p.discountPercent ? `-${p.discountPercent}%` : p.discountClp ? `-${formatMoney(p.discountClp)}` : "Oferta"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════
          BRANDING TAB
         ═══════════════════════════════════ */}
      {tab === "profile" && (
        <div className="space-y-6">
          {/* Cover + Avatar editor */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
            <div className="relative h-48 sm:h-56">
              <img
                src={resolveMediaUrl(profileDraft.coverUrl) || "/brand/splash.jpg"}
                className="h-full w-full object-cover"
                alt="cover"
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/brand/splash.jpg"; }}
              />
              <div className="absolute inset-0 bg-black/30" />
              <button
                className="absolute right-4 top-4 flex items-center gap-2 rounded-xl border border-white/30 bg-black/50 px-4 py-2 text-xs font-medium text-white backdrop-blur-xl transition hover:bg-black/60"
                onClick={() => coverInputRef.current?.click()}
              >
                {uploadingAsset === "cover" ? (
                  <span className="flex items-center gap-2"><span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" /> Subiendo...</span>
                ) : (
                  <>📷 Cambiar portada</>
                )}
              </button>
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadProfileImage("cover", e.target.files?.[0])} />
            </div>

            <div className="bg-white/[0.03] px-5 pb-5 pt-0">
              <div className="-mt-10 flex items-end gap-4">
                <div className="relative">
                  <div className="h-20 w-20 overflow-hidden rounded-2xl border-4 border-[#0e0e12] bg-[#0e0e12] shadow-xl">
                    <img src={resolveMediaUrl(profileDraft.avatarUrl) || "/brand/isotipo-new.png"} className="h-full w-full object-cover" alt="avatar" />
                  </div>
                  <button
                    className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/70 text-xs backdrop-blur-xl transition hover:bg-black/90"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    {uploadingAsset === "avatar" ? "⏳" : "📷"}
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadProfileImage("avatar", e.target.files?.[0])} />
                </div>
                <div className="mb-1">
                  <div className="text-sm font-semibold">{data.profile?.displayName || data.profile?.username}</div>
                  <div className="text-xs text-white/40">Portada: 1600×600px · Perfil: 512×512px</div>
                </div>
              </div>
            </div>
          </div>

          {/* Settings form */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
            <h3 className="mb-5 text-lg font-semibold">Configuración de contacto</h3>
            <div className="space-y-4">
              <GlassInput label="Teléfono de contacto" placeholder="+56 9 1234 5678" value={profileDraft.phone} onChange={(e) => setProfileDraft((p) => ({ ...p, phone: e.target.value }))} />

              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setProfileDraft((p) => ({ ...p, isPublished: !p.isPublished }))}
                  className={`flex items-center justify-between rounded-xl border p-4 transition-all ${profileDraft.isPublished ? "border-violet-400/30 bg-violet-500/10" : "border-white/10 bg-white/[0.03]"}`}
                >
                  <div className="text-left">
                    <div className="text-sm font-medium">Publicación</div>
                    <div className="text-xs text-white/40">Visible en directorio</div>
                  </div>
                  <div className={`h-3 w-3 rounded-full ${profileDraft.isPublished ? "bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.6)]" : "bg-white/20"}`} />
                </button>
                <button
                  onClick={() => setProfileDraft((p) => ({ ...p, isOpen: !p.isOpen }))}
                  className={`flex items-center justify-between rounded-xl border p-4 transition-all ${profileDraft.isOpen ? "border-emerald-400/30 bg-emerald-500/10" : "border-white/10 bg-white/[0.03]"}`}
                >
                  <div className="text-left">
                    <div className="text-sm font-medium">Estado</div>
                    <div className="text-xs text-white/40">{profileDraft.isOpen ? "Abierto ahora" : "Cerrado"}</div>
                  </div>
                  <div className={`h-3 w-3 rounded-full ${profileDraft.isOpen ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" : "bg-white/20"}`} />
                </button>
              </div>

              <button
                onClick={saveProfile}
                className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 py-3.5 text-sm font-semibold shadow-[0_8px_30px_rgba(168,85,247,0.2)] transition-all hover:shadow-[0_12px_40px_rgba(168,85,247,0.3)] active:scale-[0.98] sm:w-auto"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════
          LOCATION TAB
         ═══════════════════════════════════ */}
      {tab === "location" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
            <h3 className="mb-5 text-lg font-semibold">Dirección del establecimiento</h3>
            <div className="space-y-4">
              <GlassInput label="Dirección completa" value={profileDraft.address} onChange={(e) => setProfileDraft((p) => ({ ...p, address: e.target.value }))} placeholder="Av. Libertador Bernardo O'Higgins 1234" />
              <div className="grid grid-cols-2 gap-3">
                <GlassInput label="Latitud" value={profileDraft.latitude} onChange={(e) => setProfileDraft((p) => ({ ...p, latitude: e.target.value }))} placeholder="-33.45" />
                <GlassInput label="Longitud" value={profileDraft.longitude} onChange={(e) => setProfileDraft((p) => ({ ...p, longitude: e.target.value }))} placeholder="-70.66" />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={geocodeProfileAddress}
                  disabled={geocodeBusy}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium transition-all hover:bg-white/[0.08] disabled:opacity-50"
                >
                  {geocodeBusy ? (
                    <span className="flex items-center gap-2"><span className="h-3 w-3 animate-spin rounded-full border-2 border-white/20 border-t-white" /> Buscando...</span>
                  ) : (
                    <>🔍 Buscar en mapa</>
                  )}
                </button>
                <button
                  onClick={saveLocation}
                  className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-2.5 text-sm font-semibold shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
                >
                  Guardar ubicación
                </button>
              </div>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
            {hasCoords ? (
              <MapboxMap markers={[{ id: data.profile.id, name: "Establecimiento", lat: draftLat, lng: draftLng, subtitle: profileDraft.address || "" }]} height={380} />
            ) : (
              <div className="flex h-[380px] items-center justify-center bg-white/[0.02]">
                <div className="text-center">
                  <div className="mb-2 text-3xl">📍</div>
                  <div className="text-sm text-white/40">Ingresa una dirección para ver el mapa</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════
          ROOMS TAB
         ═══════════════════════════════════ */}
      {tab === "rooms" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          {/* Room form */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
            <h3 className="mb-5 text-lg font-semibold">{roomForm.id ? "Editar habitación" : "Nueva habitación"}</h3>
            <div className="space-y-4">
              <GlassInput label="Nombre" placeholder="Suite Premium, Habitación Estándar..." value={roomForm.name} onChange={(e) => setRoomForm((f: any) => ({ ...f, name: e.target.value }))} />
              <GlassInput label="Ubicación interna" placeholder="Piso 2, Ala Norte..." value={roomForm.location} onChange={(e) => setRoomForm((f: any) => ({ ...f, location: e.target.value }))} />
              <GlassTextarea label="Descripción" placeholder="Describe la habitación..." value={roomForm.description} onChange={(e) => setRoomForm((f: any) => ({ ...f, description: e.target.value }))} className="min-h-[80px]" />
              <GlassInput label="Amenidades (separadas por coma)" placeholder="WiFi, Jacuzzi, TV, Minibar..." value={roomForm.amenities} onChange={(e) => setRoomForm((f: any) => ({ ...f, amenities: e.target.value }))} />

              <div>
                <span className="mb-1.5 block text-xs font-medium text-white/50">Tarifas (CLP)</span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
                    <div className="mb-1 text-[10px] font-medium text-white/40">3 HORAS</div>
                    <input className="w-full bg-transparent text-center text-lg font-bold text-white outline-none" placeholder="0" value={roomForm.price3h} onChange={(e) => setRoomForm((f: any) => ({ ...f, price3h: e.target.value }))} />
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
                    <div className="mb-1 text-[10px] font-medium text-white/40">6 HORAS</div>
                    <input className="w-full bg-transparent text-center text-lg font-bold text-white outline-none" placeholder="0" value={roomForm.price6h} onChange={(e) => setRoomForm((f: any) => ({ ...f, price6h: e.target.value }))} />
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
                    <div className="mb-1 text-[10px] font-medium text-white/40">NOCHE</div>
                    <input className="w-full bg-transparent text-center text-lg font-bold text-white outline-none" placeholder="0" value={roomForm.priceNight} onChange={(e) => setRoomForm((f: any) => ({ ...f, priceNight: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Photo upload */}
              <div
                className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4 text-center transition-colors hover:border-fuchsia-500/30 hover:bg-fuchsia-500/[0.02]"
                onDrop={(e) => { e.preventDefault(); uploadRoomPhotos(e.dataTransfer.files); }}
                onDragOver={(e) => e.preventDefault()}
              >
                {uploadingAsset === "room" ? (
                  <div className="flex items-center justify-center gap-2 py-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-fuchsia-400" />
                    <span className="text-sm text-white/60">Subiendo fotos...</span>
                  </div>
                ) : (
                  <>
                    <div className="mb-1 text-2xl">📸</div>
                    <div className="text-xs text-white/40">Arrastra fotos aquí o</div>
                    <button className="mt-1 text-xs font-medium text-fuchsia-400 transition hover:text-fuchsia-300" onClick={() => roomFilesRef.current?.click()}>
                      selecciona archivos
                    </button>
                  </>
                )}
                <input ref={roomFilesRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => uploadRoomPhotos(e.target.files)} />
              </div>

              {/* Photo thumbnails */}
              {roomForm.photoUrls?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {roomForm.photoUrls.map((url: string, i: number) => (
                    <div key={i} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-white/10">
                      <img src={resolveMediaUrl(url) || ""} className="h-full w-full object-cover" alt="" />
                      <button
                        onClick={() => setRoomForm((f: any) => ({ ...f, photoUrls: f.photoUrls.filter((_: any, j: number) => j !== i) }))}
                        className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition group-hover:opacity-100"
                      >
                        <span className="text-xs">✕</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={saveRoom}
                  className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-3 text-sm font-semibold shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
                >
                  {roomForm.id ? "Guardar cambios" : "Crear habitación"}
                </button>
                {roomForm.id && (
                  <button
                    onClick={() => setRoomForm({ name: "", roomType: "Normal", location: "", description: "", amenities: "", photoUrls: [], price3h: "", price6h: "", priceNight: "" })}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm transition hover:bg-white/[0.08]"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Rooms list */}
          <div className="space-y-3">
            {data.rooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] p-12 text-center">
                <div className="mb-3 text-4xl">🏨</div>
                <div className="text-sm font-semibold">Sin habitaciones</div>
                <div className="mt-1 text-xs text-white/40">Crea tu primera habitación para empezar a recibir reservas</div>
              </div>
            ) : (
              data.rooms.map((r: any) => (
                <div key={r.id} className={`overflow-hidden rounded-2xl border transition-all ${r.isActive ? "border-white/[0.08] bg-white/[0.03]" : "border-white/[0.05] bg-white/[0.01] opacity-60"}`}>
                  <div className="flex items-start gap-4 p-4">
                    {/* Room photo */}
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-white/[0.04]">
                      {r.photoUrls?.[0] ? (
                        <img src={resolveMediaUrl(r.photoUrls[0]) || ""} className="h-full w-full object-cover" alt="" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-2xl text-white/20">🛏️</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">{r.name}</div>
                          <div className="mt-0.5 text-xs text-white/40">{r.location || "Sin ubicación"} · {r.isActive ? "Activa" : "Inactiva"}</div>
                        </div>
                      </div>
                      {/* Pricing pills */}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs">
                          3h: <strong>{formatMoney(r.price3h)}</strong>
                        </span>
                        <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs">
                          6h: <strong>{formatMoney(r.price6h)}</strong>
                        </span>
                        <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs">
                          Noche: <strong>{formatMoney(r.priceNight)}</strong>
                        </span>
                      </div>
                      {/* Actions */}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setRoomForm({ id: r.id, name: r.name || "", roomType: r.roomType || "Normal", location: r.location || "", description: r.description || "", amenities: (r.amenities || []).join(","), photoUrls: r.photoUrls || [], price3h: String(r.price3h || ""), price6h: String(r.price6h || ""), priceNight: String(r.priceNight || "") })}
                          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium transition hover:bg-white/[0.08]"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => apiFetch(`/motel/dashboard/rooms/${r.id}`, { method: "PUT", body: JSON.stringify({ isActive: !r.isActive }) }).then(load)}
                          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium transition hover:bg-white/[0.08]"
                        >
                          {r.isActive ? "Desactivar" : "Activar"}
                        </button>
                        <button
                          onClick={() => apiFetch(`/motel/dashboard/rooms/${r.id}`, { method: "DELETE" }).then(load)}
                          className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/10"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════
          PROMOTIONS TAB
         ═══════════════════════════════════ */}
      {tab === "promos" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Promo form */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
            <h3 className="mb-5 text-lg font-semibold">{promoForm.id ? "Editar promoción" : "Nueva promoción"}</h3>
            <div className="space-y-4">
              <GlassInput label="Título de la promo" placeholder="Oferta de fin de semana, Happy Hour..." value={promoForm.title} onChange={(e) => setPromoForm((f: any) => ({ ...f, title: e.target.value }))} />
              <GlassTextarea label="Descripción" placeholder="Describe la promoción..." value={promoForm.description} onChange={(e) => setPromoForm((f: any) => ({ ...f, description: e.target.value }))} className="min-h-[80px]" />

              <div>
                <span className="mb-1.5 block text-xs font-medium text-white/50">Descuento</span>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="mb-1 text-[10px] font-medium text-white/40">PORCENTAJE (%)</div>
                    <input className="w-full bg-transparent text-lg font-bold text-white outline-none" placeholder="0" value={promoForm.discountPercent} onChange={(e) => setPromoForm((f: any) => ({ ...f, discountPercent: e.target.value }))} />
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                    <div className="mb-1 text-[10px] font-medium text-white/40">MONTO FIJO (CLP)</div>
                    <input className="w-full bg-transparent text-lg font-bold text-white outline-none" placeholder="0" value={promoForm.discountClp} onChange={(e) => setPromoForm((f: any) => ({ ...f, discountClp: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <GlassInput label="Inicio" type="datetime-local" value={promoForm.startsAt} onChange={(e) => setPromoForm((f: any) => ({ ...f, startsAt: e.target.value }))} />
                <GlassInput label="Fin" type="datetime-local" value={promoForm.endsAt} onChange={(e) => setPromoForm((f: any) => ({ ...f, endsAt: e.target.value }))} />
              </div>

              {/* Room selector */}
              {data.rooms.length > 0 && (
                <div>
                  <span className="mb-2 block text-xs font-medium text-white/50">Habitaciones aplicables</span>
                  <div className="space-y-1.5">
                    {data.rooms.map((r: any) => (
                      <label key={r.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${promoForm.roomIds.includes(r.id) ? "border-fuchsia-500/30 bg-fuchsia-500/5" : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"}`}>
                        <input
                          type="checkbox"
                          checked={promoForm.roomIds.includes(r.id)}
                          onChange={(e) => setPromoForm((f: any) => ({ ...f, roomIds: e.target.checked ? [...f.roomIds, r.id] : f.roomIds.filter((x: string) => x !== r.id) }))}
                          className="sr-only"
                        />
                        <div className={`flex h-5 w-5 items-center justify-center rounded-md border transition ${promoForm.roomIds.includes(r.id) ? "border-fuchsia-500 bg-fuchsia-500" : "border-white/20"}`}>
                          {promoForm.roomIds.includes(r.id) && <span className="text-[10px] text-white">✓</span>}
                        </div>
                        <span className="text-sm">{r.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={savePromo} className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 py-3 text-sm font-semibold shadow-lg transition-all hover:shadow-xl active:scale-[0.98]">
                  {promoForm.id ? "Guardar cambios" : "Crear promoción"}
                </button>
                {promoForm.id && (
                  <button onClick={() => setPromoForm({ title: "", description: "", discountPercent: "", discountClp: "", startsAt: "", endsAt: "", roomIds: [] })} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm transition hover:bg-white/[0.08]">
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Promos list */}
          <div className="space-y-3">
            {data.promotions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] p-12 text-center">
                <div className="mb-3 text-4xl">🏷️</div>
                <div className="text-sm font-semibold">Sin promociones</div>
                <div className="mt-1 text-xs text-white/40">Crea tu primera promoción para atraer más clientes</div>
              </div>
            ) : (
              data.promotions.map((p: any) => (
                <div key={p.id} className={`rounded-2xl border p-4 transition-all ${p.isActive ? "border-fuchsia-500/15 bg-gradient-to-r from-fuchsia-500/5 to-transparent" : "border-white/[0.06] bg-white/[0.02] opacity-60"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{p.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.isActive ? "bg-emerald-500/15 text-emerald-300" : "bg-white/5 text-white/40"}`}>
                          {p.isActive ? "Activa" : "Pausada"}
                        </span>
                      </div>
                      {p.description && <div className="mt-1 text-xs text-white/50">{p.description}</div>}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/60">
                        {p.discountPercent && <span className="rounded-lg bg-fuchsia-500/10 px-2 py-1 text-fuchsia-300">-{p.discountPercent}%</span>}
                        {p.discountClp && <span className="rounded-lg bg-fuchsia-500/10 px-2 py-1 text-fuchsia-300">-{formatMoney(p.discountClp)}</span>}
                        {p.startsAt && <span>Desde: {formatDate(p.startsAt)}</span>}
                        {p.endsAt && <span>Hasta: {formatDate(p.endsAt)}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setPromoForm({ id: p.id, title: p.title || "", description: p.description || "", discountPercent: p.discountPercent ? String(p.discountPercent) : "", discountClp: p.discountClp ? String(p.discountClp) : "", startsAt: p.startsAt ? new Date(p.startsAt).toISOString().slice(0, 16) : "", endsAt: p.endsAt ? new Date(p.endsAt).toISOString().slice(0, 16) : "", roomIds: p.roomIds?.length ? p.roomIds : p.roomId ? [p.roomId] : [] })}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium transition hover:bg-white/[0.08]"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => apiFetch(`/motel/dashboard/promotions/${p.id}`, { method: "PUT", body: JSON.stringify({ isActive: !p.isActive }) }).then(load)}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium transition hover:bg-white/[0.08]"
                    >
                      {p.isActive ? "Pausar" : "Activar"}
                    </button>
                    <button
                      onClick={() => apiFetch(`/motel/dashboard/promotions/${p.id}`, { method: "DELETE" }).then(load)}
                      className="rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/10"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════
          BOOKINGS TAB
         ═══════════════════════════════════ */}
      {tab === "bookings" && (
        <div className="space-y-6">
          {/* Summary bar */}
          <div className="flex flex-wrap gap-3">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5">
              <span className="text-lg font-bold text-amber-300">{pendingBookings}</span>
              <span className="ml-2 text-xs text-white/40">Pendientes</span>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5">
              <span className="text-lg font-bold text-emerald-300">{confirmedBookings}</span>
              <span className="ml-2 text-xs text-white/40">Confirmadas</span>
            </div>
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-2.5">
              <span className="text-lg font-bold text-violet-300">{data.bookings.length}</span>
              <span className="ml-2 text-xs text-white/40">Total</span>
            </div>
          </div>

          {/* Booking cards */}
          <div className="space-y-3">
            {data.bookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] p-12 text-center">
                <div className="mb-3 text-4xl">📅</div>
                <div className="text-sm font-semibold">Sin reservas</div>
                <div className="mt-1 text-xs text-white/40">Las reservas de tus clientes aparecerán aquí</div>
              </div>
            ) : (
              data.bookings.map((b: any) => {
                const isBusy = bookingBusyId === b.id;
                return (
                  <div key={b.id} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] transition-all hover:border-white/[0.12]">
                    <div className="p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{b.clientName || b.clientUsername || "Cliente"}</span>
                            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${statusColor(b.status)}`}>
                              {bookingStatusLabel(b.status)}
                            </span>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
                            <span>🛏️ {b.roomName || "Habitación"}</span>
                            <span>⏱️ {durationLabel(b.durationType)}</span>
                            <span>📅 {formatDateTime(b.startAt)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          {b.basePriceClp && Number(b.basePriceClp) > Number(b.priceClp || 0) ? (
                            <>
                              <div className="text-xs text-white/30 line-through">{formatMoney(b.basePriceClp)}</div>
                              <div className="text-lg font-bold text-emerald-300">{formatMoney(b.priceClp)}</div>
                            </>
                          ) : (
                            <div className="text-lg font-bold">{formatMoney(b.priceClp)}</div>
                          )}
                        </div>
                      </div>

                      {/* Extra details */}
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/40">
                        {b.confirmationCode && <span>Código: <strong className="text-white/70">{b.confirmationCode}</strong></span>}
                        {Number(b.discountClp || 0) > 0 && <span>Descuento: -{formatMoney(b.discountClp)}</span>}
                        {b.note && <span>Nota: {b.note}</span>}
                      </div>

                      {/* Actions */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {b.status === "PENDIENTE" && (
                          <>
                            <button
                              disabled={isBusy}
                              onClick={() => applyBookingAction(b.id, "ACCEPT")}
                              className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2 text-xs font-semibold shadow-lg transition-all hover:shadow-xl active:scale-[0.98] disabled:opacity-50"
                            >
                              {isBusy ? "..." : "✓ Aceptar"}
                            </button>
                            <button
                              disabled={isBusy}
                              onClick={() => applyBookingAction(b.id, "REJECT")}
                              className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                            >
                              {isBusy ? "..." : "✕ Rechazar"}
                            </button>
                          </>
                        )}
                        {b.status === "CONFIRMADA" && (
                          <button
                            disabled={isBusy}
                            onClick={() => applyBookingAction(b.id, "FINISH")}
                            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium transition hover:bg-white/[0.08] disabled:opacity-50"
                          >
                            {isBusy ? "..." : "Marcar finalizada"}
                          </button>
                        )}
                        <Link
                          href={`/chat/${b.clientId || b.clientUsername}`}
                          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-medium transition hover:bg-white/[0.08]"
                        >
                          💬 Chat
                        </Link>
                        <button
                          disabled={isBusy}
                          onClick={() => applyBookingAction(b.id, "DELETE")}
                          className="rounded-xl border border-red-500/10 px-4 py-2 text-xs text-red-300/60 transition hover:bg-red-500/5 hover:text-red-300 disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Daily agenda */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">📆 Agenda diaria</h3>
              <input
                type="date"
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white outline-none transition focus:border-fuchsia-500/40 [color-scheme:dark]"
                value={agendaDate}
                onChange={(e) => setAgendaDate(e.target.value)}
              />
            </div>
            {!agendaItems.length ? (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-sm text-white/40">
                Sin reservas para esta fecha
              </div>
            ) : (
              <div className="space-y-2">
                {agendaItems.map((b: any) => (
                  <div key={`agenda-${b.id}`} className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="text-center">
                      <div className="text-lg font-bold">{new Date(b.startAt).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</div>
                      <div className="text-[10px] text-white/30">{durationLabel(b.durationType)}</div>
                    </div>
                    <div className="h-8 w-px bg-white/10" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{b.clientName || b.clientUsername || "Cliente"}</div>
                      <div className="text-xs text-white/40">
                        {b.roomName || "Habitación"} · Código: {b.confirmationCode || "-"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatMoney(b.priceClp)}</div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColor(b.status)}`}>
                        {bookingStatusLabel(b.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

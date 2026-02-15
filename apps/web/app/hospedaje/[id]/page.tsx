"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import MapboxMap from "../../../components/MapboxMap";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";

type Room = {
  id: string;
  name: string;
  description?: string | null;
  amenities?: string[];
  photoUrls?: string[];
  price?: number;
  price3h?: number;
  price6h?: number;
  priceNight?: number;
  roomType?: string;
  location?: string | null;
};

type Promotion = {
  id: string;
  title: string;
  description?: string;
  discountPercent?: number | null;
  discountClp?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  isActive?: boolean;
  roomId?: string | null;
  roomIds?: string[];
};

type Detail = {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string;
  rules?: string | null;
  schedule?: string | null;
  rating?: number | null;
  reviewsCount?: number;
  isOpen?: boolean;
  operationalStatusUpdatedAt?: string | null;
  coverUrl?: string | null;
  avatarUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  gallery: string[];
  rooms: Room[];
  promotions: Promotion[];
};

function formatMoney(value?: number | null) {
  return `$${Number(value || 0).toLocaleString("es-CL")}`;
}

export default function HospedajeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const galleryScrollRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [durationType, setDurationType] = useState((sp.get("duration") || "3H").toUpperCase());
  const [roomId, setRoomId] = useState<string>("");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const now = new Date();
  const minStartDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  useEffect(() => {
    apiFetch<{ establishment: Detail }>(`/motels/${id}`)
      .then((r) => setData(r.establishment))
      .finally(() => setLoading(false));
  }, [id]);

  const selectedRoom = useMemo(() => data?.rooms.find((r) => r.id === roomId) || data?.rooms[0], [data, roomId]);

  const activePromos = useMemo(() => {
    const nowMs = Date.now();
    return (data?.promotions || []).filter((p) => {
      if (p.isActive === false) return false;
      const starts = p.startsAt ? new Date(p.startsAt).getTime() : null;
      const ends = p.endsAt ? new Date(p.endsAt).getTime() : null;
      if (starts && starts > nowMs) return false;
      if (ends && ends < nowMs) return false;
      return true;
    });
  }, [data?.promotions]);

  const promoForRoom = useMemo(() => {
    if (!selectedRoom) return null;
    return activePromos.find((p) => p.roomId === selectedRoom.id || (p.roomIds || []).includes(selectedRoom.id)) || null;
  }, [activePromos, selectedRoom]);

  const basePrice = durationType === "6H"
    ? Number((selectedRoom as any)?.price6h || selectedRoom?.price || 0)
    : durationType === "NIGHT"
      ? Number((selectedRoom as any)?.priceNight || selectedRoom?.price || 0)
      : Number((selectedRoom as any)?.price3h || selectedRoom?.price || 0);

  const discountedPrice = useMemo(() => {
    if (!promoForRoom) return basePrice;
    if (promoForRoom.discountPercent) return Math.max(0, Math.round(basePrice * (1 - promoForRoom.discountPercent / 100)));
    if (promoForRoom.discountClp) return Math.max(0, basePrice - Number(promoForRoom.discountClp));
    return basePrice;
  }, [promoForRoom, basePrice]);

  const gallery = useMemo(() => {
    if (!data) return ["/brand/splash.jpg"];
    const roomGallery = selectedRoom?.photoUrls?.length ? selectedRoom.photoUrls : [];
    const out = [data.coverUrl, ...roomGallery, ...data.gallery].filter(Boolean) as string[];
    return out.length ? out : ["/brand/splash.jpg"];
  }, [data, selectedRoom]);

  const reserve = async () => {
    if (!data || !selectedRoom) return;
    const startAt = startDate && startTime ? `${startDate}T${startTime}` : null;
    if (startAt) {
      const selectedStart = new Date(startAt);
      if (Number.isNaN(selectedStart.getTime()) || selectedStart.getTime() < Date.now()) {
        setMsg("La fecha de reserva debe ser desde ahora en adelante.");
        return;
      }
    }
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch(`/motels/${data.id}/bookings`, {
        method: "POST",
        body: JSON.stringify({ roomId: selectedRoom.id, durationType, startAt, note: note || null }),
      });
      router.push(`/chat/${data.id}`);
    } catch {
      setMsg("No pudimos crear la reserva. Inicia sesión y vuelve a intentar.");
    } finally {
      setBusy(false);
    }
  };

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <div className="animate-pulse">
          <div className="h-72 rounded-3xl bg-white/[0.04]" />
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <div className="h-40 rounded-2xl bg-white/[0.04]" />
              <div className="h-60 rounded-2xl bg-white/[0.04]" />
            </div>
            <div className="h-80 rounded-2xl bg-white/[0.04]" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-3xl border border-white/[0.08] bg-white/[0.03] p-12 text-center">
          <div className="mb-4 text-5xl">🏨</div>
          <h2 className="text-xl font-semibold">No encontrado</h2>
          <p className="mt-1 text-sm text-white/40">No pudimos encontrar este hospedaje.</p>
          <Link href="/hospedaje" className="mt-4 inline-block text-sm text-fuchsia-400 transition hover:text-fuchsia-300">
            ← Volver a hospedajes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-32 lg:pb-12">
      {/* ── Hero gallery ── */}
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-white/[0.08]">
        {/* Main image */}
        <div className="relative cursor-pointer" onClick={() => setLightboxOpen(true)}>
          <img
            src={resolveMediaUrl(gallery[galleryIndex]) || "/brand/splash.jpg"}
            alt={data.name}
            onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/brand/splash.jpg"; }}
            className="h-64 w-full object-cover sm:h-80 md:h-[400px]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

          {/* Photo count badge */}
          <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-xs text-white/80 backdrop-blur-xl">
            📷 {gallery.length} fotos
          </div>

          {/* Header info */}
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-6">
            <div className="flex items-end gap-4">
              {/* Avatar */}
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-white/30 bg-black/40 shadow-xl sm:h-20 sm:w-20">
                <img
                  src={resolveMediaUrl(data.avatarUrl) || "/brand/isotipo-new.png"}
                  alt={data.name}
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/brand/isotipo-new.png"; }}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">{data.name}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-white/70">
                  <span className="flex items-center gap-1">📍 {data.address}, {data.city}</span>
                  {data.rating != null && (
                    <span className="flex items-center gap-1">
                      ⭐ {data.rating} · {data.reviewsCount ?? 0} reseñas
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${data.isOpen ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300" : "border-red-400/30 bg-red-500/15 text-red-300"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${data.isOpen ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]" : "bg-red-400"}`} />
                    {data.isOpen ? "Abierto ahora" : "Cerrado"}
                  </span>
                  {activePromos.length > 0 && (
                    <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/15 px-3 py-1 text-xs font-medium text-fuchsia-300">
                      🏷️ {activePromos.length} oferta{activePromos.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Gallery thumbnails */}
        {gallery.length > 1 && (
          <div ref={galleryScrollRef} className="scrollbar-none flex gap-1.5 overflow-x-auto bg-black/40 p-2">
            {gallery.slice(0, 12).map((g, i) => (
              <button
                key={`${g}-${i}`}
                onClick={() => setGalleryIndex(i)}
                className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${galleryIndex === i ? "border-fuchsia-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]" : "border-transparent opacity-60 hover:opacity-100"}`}
              >
                <img
                  src={resolveMediaUrl(g) || "/brand/splash.jpg"}
                  onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/brand/splash.jpg"; }}
                  className="h-full w-full object-cover"
                  alt=""
                />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Lightbox */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4" onClick={() => setLightboxOpen(false)}>
          <button className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg text-white backdrop-blur-xl">✕</button>
          <button
            className="absolute left-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-xl"
            onClick={(e) => { e.stopPropagation(); setGalleryIndex((prev) => (prev === 0 ? gallery.length - 1 : prev - 1)); }}
          >
            ‹
          </button>
          <button
            className="absolute right-4 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-xl"
            onClick={(e) => { e.stopPropagation(); setGalleryIndex((prev) => (prev + 1) % gallery.length); }}
          >
            ›
          </button>
          <img
            src={resolveMediaUrl(gallery[galleryIndex]) || "/brand/splash.jpg"}
            alt=""
            className="max-h-[90vh] max-w-[95vw] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white/70">
            {galleryIndex + 1} / {gallery.length}
          </div>
        </div>
      )}

      {/* ── Content grid ── */}
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Left: Details */}
        <div className="space-y-5">
          {/* About */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">📋 Sobre este hospedaje</h2>
            <div className="mt-3 space-y-2 text-sm text-white/60">
              {data.rules && <p>{data.rules}</p>}
              <p>📞 Teléfono: {data.phone || "No disponible"}</p>
              <p>🕐 Horario: {data.schedule || "24/7"}</p>
            </div>
          </div>

          {/* Rooms */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <h2 className="flex items-center gap-2 text-lg font-semibold">🛏️ Habitaciones</h2>
            <div className="mt-4 space-y-3">
              {data.rooms.map((r) => {
                const isSelected = selectedRoom?.id === r.id;
                const promo = activePromos.find((p) => p.roomId === r.id || (p.roomIds || []).includes(r.id));
                const roomBase = Number(
                  durationType === "6H" ? (r as any).price6h : durationType === "NIGHT" ? (r as any).priceNight : (r as any).price3h
                ) || Number(r.price || 0);
                const roomFinal = promo?.discountPercent
                  ? Math.round(roomBase * (1 - promo.discountPercent / 100))
                  : promo?.discountClp
                    ? Math.max(0, roomBase - Number(promo.discountClp))
                    : roomBase;

                return (
                  <button
                    key={r.id}
                    onClick={() => setRoomId(r.id)}
                    className={`w-full rounded-2xl border p-4 text-left transition-all ${
                      isSelected
                        ? "border-fuchsia-500/30 bg-fuchsia-500/5 shadow-[0_0_20px_rgba(168,85,247,0.08)]"
                        : "border-white/[0.08] bg-white/[0.02] hover:border-white/15"
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Room photo thumbnail */}
                      {r.photoUrls?.[0] && (
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                          <img src={resolveMediaUrl(r.photoUrls[0]) || ""} className="h-full w-full object-cover" alt="" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold">{r.name}</div>
                          {isSelected && (
                            <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-medium text-fuchsia-300">Seleccionada</span>
                          )}
                        </div>
                        {r.description && <div className="mt-0.5 text-xs text-white/40">{r.description}</div>}
                        {r.location && <div className="mt-0.5 text-xs text-white/30">📍 {r.location}</div>}

                        {/* Amenities */}
                        {r.amenities && r.amenities.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {r.amenities.slice(0, 5).map((a, i) => (
                              <span key={i} className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/50">{a}</span>
                            ))}
                            {r.amenities.length > 5 && (
                              <span className="rounded-full bg-white/[0.04] px-2 py-0.5 text-[10px] text-white/30">+{r.amenities.length - 5}</span>
                            )}
                          </div>
                        )}

                        {/* Pricing */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs">
                            3h: <strong>{formatMoney((r as any).price3h || r.price)}</strong>
                          </span>
                          <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs">
                            6h: <strong>{formatMoney((r as any).price6h || r.price)}</strong>
                          </span>
                          <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-xs">
                            Noche: <strong>{formatMoney((r as any).priceNight || r.price)}</strong>
                          </span>
                        </div>

                        {/* Promo badge */}
                        {promo && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2.5 py-0.5 text-xs font-medium text-fuchsia-300">
                              🏷️ {promo.title} {promo.discountPercent ? `(-${promo.discountPercent}%)` : ""}
                            </span>
                            <span className="text-xs text-white/30 line-through">{formatMoney(roomBase)}</span>
                            <span className="text-sm font-bold text-emerald-300">{formatMoney(roomFinal)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}

              {data.rooms.length === 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-center text-sm text-white/40">
                  No hay habitaciones disponibles en este momento
                </div>
              )}
            </div>
          </div>

          {/* Active promotions */}
          {activePromos.length > 0 && (
            <div className="rounded-2xl border border-fuchsia-500/15 bg-gradient-to-r from-fuchsia-500/5 to-transparent p-5">
              <h2 className="flex items-center gap-2 text-lg font-semibold">🏷️ Ofertas activas</h2>
              <div className="mt-3 space-y-2">
                {activePromos.map((p) => (
                  <div key={p.id} className="rounded-xl border border-fuchsia-500/10 bg-fuchsia-500/5 p-3">
                    <div className="font-semibold text-fuchsia-300">{p.title}</div>
                    {p.description && <div className="mt-0.5 text-xs text-white/50">{p.description}</div>}
                    <div className="mt-1 text-xs text-white/40">
                      {p.discountPercent ? `${p.discountPercent}% de descuento` : p.discountClp ? `${formatMoney(p.discountClp)} de descuento` : "Oferta especial"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Map */}
          {data.latitude != null && data.longitude != null && (
            <div className="overflow-hidden rounded-2xl border border-white/[0.08]">
              <div className="bg-white/[0.03] p-4 pb-0">
                <h2 className="flex items-center gap-2 text-lg font-semibold">📍 Ubicación</h2>
                <p className="mt-1 text-sm text-white/40">{data.address}, {data.city}</p>
              </div>
              <div className="mt-3">
                <MapboxMap
                  markers={[{ id: data.id, name: data.name, lat: Number(data.latitude), lng: Number(data.longitude), subtitle: data.address }]}
                  height={250}
                />
              </div>
            </div>
          )}
        </div>

        {/* Right: Booking panel (sticky on desktop) */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
            <h3 className="text-lg font-semibold">Reservar</h3>

            {/* Duration selector */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              {(["3H", "6H", "NIGHT"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDurationType(d)}
                  className={`rounded-xl border py-3 text-center text-sm font-medium transition-all ${
                    durationType === d
                      ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-300 shadow-[0_0_15px_rgba(168,85,247,0.1)]"
                      : "border-white/10 text-white/50 hover:bg-white/[0.04]"
                  }`}
                >
                  {d === "NIGHT" ? "Noche" : d === "6H" ? "6 horas" : "3 horas"}
                </button>
              ))}
            </div>

            {/* Pricing */}
            <div className="mt-4 rounded-xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-500/10 to-violet-500/5 p-4">
              <div className="text-xs font-medium text-white/40">
                {selectedRoom?.name || "Habitación"} · {durationType === "NIGHT" ? "Noche" : durationType === "6H" ? "6 horas" : "3 horas"}
              </div>
              {promoForRoom && (
                <div className="mt-1 text-sm text-white/40 line-through">{formatMoney(basePrice)}</div>
              )}
              <div className="mt-0.5 text-3xl font-bold text-fuchsia-200">{formatMoney(discountedPrice)}</div>
              {promoForRoom && (
                <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-emerald-300">
                  🏷️ {promoForRoom.title}
                </div>
              )}
            </div>

            {/* Form */}
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/40">Fecha</label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-fuchsia-500/40 focus:ring-1 focus:ring-fuchsia-500/20 [color-scheme:dark]"
                  type="date"
                  value={startDate}
                  min={minStartDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/40">Hora</label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-fuchsia-500/40 focus:ring-1 focus:ring-fuchsia-500/20 [color-scheme:dark]"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/40">Nota (opcional)</label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition focus:border-fuchsia-500/40 focus:ring-1 focus:ring-fuchsia-500/20"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Comentario para recepción"
                />
              </div>

              <button
                disabled={busy || !data.rooms.length}
                onClick={reserve}
                className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 py-4 text-sm font-semibold shadow-[0_8px_30px_rgba(168,85,247,0.25)] transition-all hover:shadow-[0_12px_40px_rgba(168,85,247,0.35)] active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                    Procesando...
                  </span>
                ) : (
                  "Confirmar reserva"
                )}
              </button>
            </div>

            {msg && (
              <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm text-white/70">
                {msg}
                <div className="mt-1">
                  <Link className="text-fuchsia-400 underline transition hover:text-fuchsia-300" href={`/chat/${data.id}`}>
                    Ir al chat →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Quick contact */}
          <div className="mt-4 flex gap-2">
            <Link
              href={`/chat/${data.id}`}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-3 text-sm font-medium transition hover:bg-white/[0.08]"
            >
              💬 Enviar mensaje
            </Link>
            {data.phone && (
              <a
                href={`tel:${data.phone}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] py-3 text-sm font-medium transition hover:bg-white/[0.08]"
              >
                📞 Llamar
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

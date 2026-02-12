"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { MapPin, Star } from "lucide-react";
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

export default function HospedajeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [durationType, setDurationType] = useState((sp.get("duration") || "3H").toUpperCase());
  const [roomId, setRoomId] = useState<string>("");
  const [galleryIndex, setGalleryIndex] = useState(0);
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
  const minStartTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  useEffect(() => {
    apiFetch<{ establishment: Detail }>(`/motels/${id}`).then((r) => setData(r.establishment)).finally(() => setLoading(false));
  }, [id]);

  const selectedRoom = useMemo(() => data?.rooms.find((r) => r.id === roomId) || data?.rooms[0], [data, roomId]);

  const activePromos = useMemo(() => {
    const now = Date.now();
    return (data?.promotions || []).filter((p) => {
      if (p.isActive === false) return false;
      const starts = p.startsAt ? new Date(p.startsAt).getTime() : null;
      const ends = p.endsAt ? new Date(p.endsAt).getTime() : null;
      if (starts && starts > now) return false;
      if (ends && ends < now) return false;
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
      await apiFetch(`/motels/${data.id}/bookings`, { method: "POST", body: JSON.stringify({ roomId: selectedRoom.id, durationType, startAt, note: note || null }) });
      router.push(`/chat/${data.id}`);
    } catch {
      setMsg("No pudimos crear la reserva. Inicia sesión y vuelve a intentar.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="text-white/70">Cargando hospedaje...</div>;
  if (!data) return <div className="text-white/70">No encontramos este hospedaje.</div>;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-white/15 bg-white/5">
        <div className="relative">
          <img
            src={resolveMediaUrl(gallery[galleryIndex]) || "/brand/splash.jpg"}
            alt=""
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "/brand/splash.jpg";
            }}
            className="h-56 w-full object-cover sm:h-64 md:h-72"
          />
          <div className="absolute inset-0 hidden bg-gradient-to-t from-black/70 to-transparent md:block" />

          <div className="space-y-3 p-4 md:hidden">
            <div className="flex items-start gap-3">
              <img
                src={resolveMediaUrl(data.avatarUrl) || "/brand/isotipo.png"}
                alt=""
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/brand/isotipo.png";
                }}
                className="h-16 w-16 shrink-0 rounded-2xl border-2 border-white/50 object-cover"
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-semibold leading-tight">{data.name}</h1>
                <div className="mt-1 flex items-start gap-1 text-sm text-white/80"><MapPin className="mt-0.5 h-4 w-4 shrink-0" /><span className="break-words">{data.address}, {data.city}</span></div>
                <div className="mt-1 flex items-center gap-1 text-sm text-white/90"><Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />{data.rating ?? "N/A"} · {data.reviewsCount ?? 0} reseñas</div>
                <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs ${data.isOpen ? "border-emerald-300/40 bg-emerald-500/20" : "border-rose-300/40 bg-rose-500/20"}`}>{data.isOpen ? "Abierto ahora" : "Cerrado"}</div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-4 left-4 right-4 hidden items-end justify-between gap-3 md:flex">
            <div className="flex items-end gap-3">
              <img
                src={resolveMediaUrl(data.avatarUrl) || "/brand/isotipo.png"}
                alt="perfil"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/brand/isotipo.png";
                }}
                className="h-20 w-20 rounded-2xl border-2 border-white/50 object-cover"
              />
              <div>
                <h1 className="text-3xl font-semibold">{data.name}</h1>
                <div className="flex items-center gap-1 text-sm text-white/80"><MapPin className="h-4 w-4" />{data.address}, {data.city}</div>
                <div className="flex items-center gap-1 text-sm text-white/90"><Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />{data.rating ?? "N/A"} · {data.reviewsCount ?? 0} reseñas</div>
                <div className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs ${data.isOpen ? "border-emerald-300/40 bg-emerald-500/20" : "border-rose-300/40 bg-rose-500/20"}`}>{data.isOpen ? "Abierto ahora" : "Cerrado"}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 overflow-auto p-3">{gallery.slice(0, 10).map((g, i) => <button key={`${g}-${i}`} onClick={() => setGalleryIndex(i)} className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border ${galleryIndex === i ? "border-fuchsia-300" : "border-white/20"}`}><img src={resolveMediaUrl(g) || "/brand/splash.jpg"} onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/brand/splash.jpg"; }} className="h-full w-full object-cover" alt="" /></button>)}</div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <div className="card p-4">
            <h2 className="font-semibold text-lg">Servicios y descripción</h2>
            <p className="text-sm text-white/75 mt-2">{data.rules || "Sin reglas adicionales."}</p>
            <p className="text-sm text-white/75 mt-2">Horario: {data.schedule || "24/7"}</p>
          </div>

          <div className="card p-4">
            <h2 className="font-semibold text-lg">Habitaciones</h2>
            <div className="mt-3 space-y-2">{data.rooms.map((r) => {
              const promo = activePromos.find((p) => p.roomId === r.id || (p.roomIds || []).includes(r.id));
              const roomBase = Number((durationType === "6H" ? (r as any).price6h : durationType === "NIGHT" ? (r as any).priceNight : (r as any).price3h) || r.price || 0);
              const roomFinal = promo?.discountPercent ? Math.round(roomBase * (1 - promo.discountPercent / 100)) : promo?.discountClp ? Math.max(0, roomBase - Number(promo.discountClp)) : roomBase;
              return <div key={r.id} className={`rounded-2xl border p-3 ${selectedRoom?.id === r.id ? "border-fuchsia-300/60 bg-fuchsia-500/10" : "border-white/10 bg-white/5"}`}>
                <div className="flex justify-between gap-2"><div><div className="font-semibold">{r.name}</div><div className="text-xs text-white/70">{r.description || "Sin descripción"}</div><div className="text-xs text-white/60">{r.location || "Ubicación no especificada"}</div></div><button onClick={() => setRoomId(r.id)} className="btn-secondary text-xs">Seleccionar</button></div>
                <div className="mt-2 text-sm text-white/85">3h ${Number((r as any).price3h || r.price || 0).toLocaleString("es-CL")} · 6h ${Number((r as any).price6h || r.price || 0).toLocaleString("es-CL")} · Noche ${Number((r as any).priceNight || r.price || 0).toLocaleString("es-CL")}</div>
                {promo ? <div className="mt-2 text-sm"><span className="mr-2 rounded-full border border-rose-300/40 bg-rose-500/20 px-2 py-0.5 text-rose-100">Oferta {promo.discountPercent ? `-${promo.discountPercent}%` : ""}</span><span className="line-through text-white/50">${roomBase.toLocaleString("es-CL")}</span><span className="ml-2 font-semibold text-fuchsia-200">${roomFinal.toLocaleString("es-CL")}</span></div> : null}
              </div>;
            })}</div>
          </div>

        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <div className="mt-3 flex flex-wrap gap-2">{["3H", "6H", "NIGHT"].map((d) => <button key={d} onClick={() => setDurationType(d)} className={`rounded-full px-3 py-1.5 text-sm border ${durationType === d ? "border-fuchsia-300 bg-fuchsia-500/25" : "border-white/20 bg-white/5"}`}>{d === "NIGHT" ? "Noche" : d.toLowerCase()}</button>)}</div>
            <div className="mt-3 rounded-xl border border-fuchsia-300/25 bg-fuchsia-500/10 p-3"><div className="text-xs text-fuchsia-100/80">Precio final</div>{promoForRoom ? <div className="text-sm text-white/60 line-through">${basePrice.toLocaleString("es-CL")}</div> : null}<div className="text-2xl font-semibold text-fuchsia-100">${discountedPrice.toLocaleString("es-CL")}</div></div>
            <div className="mt-3 grid gap-3">
              <div>
                <label className="block text-xs text-white/70 mb-1.5">Fecha de reserva</label>
                <input
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white text-base text-center focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-300/50 [color-scheme:dark]"
                  type="date"
                  value={startDate}
                  min={minStartDate}
                  aria-label="Fecha de reserva"
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-white/70 mb-1.5">Hora de reserva</label>
                <input
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white text-base text-center focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-300/50 [color-scheme:dark]"
                  type="time"
                  value={startTime}
                  min={startDate === minStartDate ? minStartTime : undefined}
                  aria-label="Hora de reserva"
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Comentario para recepción" />
              <button className="btn-primary" disabled={busy} onClick={reserve}>{busy ? "Enviando..." : "Confirmar reserva"}</button>
            </div>
            {msg ? <div className="mt-2 text-sm">{msg}<div><Link className="underline text-fuchsia-200" href={`/chat/${data.id}`}>Ir al chat</Link></div></div> : null}
          </div>

          <div className="card p-4"><h3 className="font-semibold">Ubicación</h3><p className="text-sm text-white/75">{data.address}, {data.city} · Estado: Ubicación verificada.</p>{data.latitude != null && data.longitude != null ? <div className="mt-2"><MapboxMap markers={[{ id: data.id, name: data.name, lat: Number(data.latitude), lng: Number(data.longitude), subtitle: data.address }]} userLocation={[Number(data.latitude), Number(data.longitude)]} height={220} /></div> : null}</div>
        </div>
      </section>
    </div>
  );
}

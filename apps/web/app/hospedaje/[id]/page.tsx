"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { MapPin, Star } from "lucide-react";
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
  gallery: string[];
  rooms: Room[];
  promotions: any[];
};

export default function HospedajeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [durationType, setDurationType] = useState((sp.get("duration") || "3H").toUpperCase());
  const [roomId, setRoomId] = useState<string>("");
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [startAt, setStartAt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ establishment: Detail }>(`/motels/${id}`)
      .then((r) => setData(r.establishment))
      .finally(() => setLoading(false));
  }, [id]);

  const selectedRoom = useMemo(() => data?.rooms.find((r) => r.id === roomId) || data?.rooms[0], [data, roomId]);
  const selectedPrice = durationType === "6H"
    ? Number((selectedRoom as any)?.price6h || selectedRoom?.price || 0)
    : durationType === "NIGHT"
      ? Number((selectedRoom as any)?.priceNight || selectedRoom?.price || 0)
      : Number((selectedRoom as any)?.price3h || selectedRoom?.price || 0);

  const gallery = useMemo(() => {
    if (!data) return ["/brand/splash.jpg"];
    return data.gallery.length ? data.gallery : (selectedRoom?.photoUrls?.length ? selectedRoom.photoUrls : ["/brand/splash.jpg"]);
  }, [data, selectedRoom]);

  const reserve = async () => {
    if (!data) return;
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch(`/motels/${data.id}/bookings`, {
        method: "POST",
        body: JSON.stringify({ roomId: selectedRoom?.id, durationType, startAt: startAt || null, note: note || null }),
      });
      setMsg("Reserva enviada con éxito. Estado inicial: PENDIENTE.");
    } catch {
      setMsg("No pudimos crear la reserva. Inicia sesión y vuelve a intentar.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="text-white/70">Cargando hospedaje...</div>;
  if (!data) return <div className="text-white/70">No encontramos este hospedaje.</div>;

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-fuchsia-300/20 bg-gradient-to-br from-[#2e0a4c] via-[#23063a] to-[#150222] p-4 md:p-5 shadow-[0_20px_60px_rgba(137,47,255,0.28)]">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="overflow-hidden rounded-2xl border border-white/20">
              <img src={resolveMediaUrl(gallery[galleryIndex]) || "/brand/splash.jpg"} alt={data.name} className="h-72 w-full object-cover" />
            </div>
            <div className="mt-2 flex gap-2 overflow-auto pb-1">{gallery.slice(0, 8).map((g, i) => <button key={`${g}-${i}`} onClick={() => setGalleryIndex(i)} className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg border ${galleryIndex === i ? "border-fuchsia-300" : "border-white/20"}`}><img src={resolveMediaUrl(g) || "/brand/splash.jpg"} alt="miniatura" className="h-full w-full object-cover" /></button>)}</div>
          </div>

          <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
            <h1 className="text-3xl font-semibold">{data.name}</h1>
            <div className="mt-2 flex items-center gap-2 text-white/85"><Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />{data.rating ?? "N/A"} · {data.reviewsCount ?? 0} reviews</div>
            <div className="mt-2 flex gap-2 text-sm text-white/75"><MapPin className="h-4 w-4 mt-0.5" />{data.address}, {data.city}</div>
            <div className="mt-3 rounded-xl border border-white/15 bg-black/20 p-3 text-sm text-white/80">Horario: {data.schedule || "24/7"}<br />Reglas: {data.rules || "Confirmar reglas al reservar"}</div>
            <div className="mt-3 flex items-end justify-between rounded-xl border border-fuchsia-300/25 bg-fuchsia-500/15 p-3">
              <div>
                <div className="text-xs text-fuchsia-100/70">Precio seleccionado</div>
                <div className="text-2xl font-semibold text-fuchsia-100">${selectedPrice.toLocaleString("es-CL")}</div>
              </div>
              <button onClick={reserve} disabled={busy} className="btn-primary">{busy ? "Enviando..." : "Reservar"}</button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <div className="mb-3 flex flex-wrap gap-2">{["3H", "6H", "NIGHT"].map((d) => <button key={d} onClick={() => setDurationType(d)} className={`rounded-full px-3 py-1.5 text-sm border ${durationType === d ? "border-fuchsia-300 bg-fuchsia-500/25" : "border-white/20 bg-white/5"}`}>{d === "NIGHT" ? "Noche" : d.toLowerCase()}</button>)}</div>
        <div className="grid gap-3 md:grid-cols-2">
          {data.rooms.map((r) => (
            <div key={r.id} className={`rounded-2xl border p-3 ${selectedRoom?.id === r.id ? "border-fuchsia-300/60 bg-fuchsia-500/10" : "border-white/10 bg-white/5"}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{r.name}</div>
                  <div className="text-xs text-white/70">{r.roomType || "Normal"} · {(r.amenities || []).join(" · ") || "Amenidades por confirmar"}</div>
                </div>
                <button onClick={() => setRoomId(r.id)} className="btn-secondary text-xs">Ver habitaciones</button>
              </div>
              <div className="mt-2 text-sm text-white/80">3h ${Number((r as any).price3h || r.price || 0).toLocaleString("es-CL")} · 6h ${Number((r as any).price6h || r.price || 0).toLocaleString("es-CL")} · Noche ${Number((r as any).priceNight || r.price || 0).toLocaleString("es-CL")}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/5 p-4">
        <h2 className="font-semibold text-lg">Completar reserva</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <input className="input" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          <input className="input" value={note} placeholder="Comentario opcional" onChange={(e) => setNote(e.target.value)} />
          <button onClick={reserve} disabled={busy} className="btn-primary">{busy ? "Enviando..." : "Confirmar reserva"}</button>
        </div>
        {msg ? <div className="mt-2 space-y-2 text-sm text-white/85"><div>{msg}</div><Link className="inline-flex rounded-xl border border-fuchsia-300/30 bg-fuchsia-500/15 px-3 py-2 text-fuchsia-100" href={`/chat/${data.id}`}>Ir al chat con el hotel/motel</Link></div> : null}
      </section>
    </div>
  );
}

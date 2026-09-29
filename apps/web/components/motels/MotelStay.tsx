"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { BadgePercent, BedDouble, CalendarClock, CheckCircle2, Globe, MessageCircle, Navigation, Phone, Store } from "lucide-react";
import { apiFetch, friendlyErrorMessage, resolveMediaUrl } from "../../lib/api";
import {
  DURATION_LABEL,
  DURATION_SHORT,
  applyPromo,
  formatClp,
  promoLabel,
  type MotelDetail,
  type MotelDurationKey,
  type MotelPromotion,
  type MotelRoom,
} from "../../lib/motels";
import { amenityIcon, roomAmenityLabel } from "./amenities";

const DURATIONS: MotelDurationKey[] = ["3H", "6H", "NIGHT"];

function roomPrice(room: MotelRoom | undefined, d: MotelDurationKey) {
  if (!room) return 0;
  return Number((d === "3H" ? room.price3h : d === "6H" ? room.price6h : room.priceNight) || 0);
}

/** Mejor promo vigente para la habitación (una sin habitaciones vale para todas). */
function promoFor(promos: MotelPromotion[], roomId?: string) {
  const list = promos.filter((p) => !p.roomIds.length || (roomId && p.roomIds.includes(roomId)));
  return list.sort((a, b) => applyPromo(10000, a) - applyPromo(10000, b))[0] || null;
}

function localDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nextSlot() {
  const d = new Date(Date.now() + 20 * 60000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return { date: localDate(d), time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` };
}

const STATUS_TEXT: Record<string, string> = {
  PENDIENTE: "Tu solicitud está esperando que el motel la acepte.",
  ACEPTADA: "El motel aceptó tu reserva. Confírmala en el chat para activarla.",
  CONFIRMADA: "Tienes una reserva confirmada en este motel.",
};

/**
 * Habitaciones + tarjeta de reserva. Van juntas porque elegir una habitación
 * en la lista la deja elegida en la tarjeta. El resto de la ficha (descripción,
 * comodidades, mapa, reseñas) llega del servidor en `intro` y `after`.
 */
export default function MotelStay({ motel, intro, after }: { motel: MotelDetail; intro?: ReactNode; after?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const cardRef = useRef<HTMLDivElement>(null);
  const bookable = motel.kind === "profile" && motel.rooms.length > 0;

  const [duration, setDuration] = useState<MotelDurationKey>("3H");
  const [roomId, setRoomId] = useState<string>(() => motel.rooms.find((r) => roomPrice(r, "3H") > 0)?.id || motel.rooms[0]?.id || "");
  const [slot, setSlot] = useState(nextSlot);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<any>(null);
  const [existing, setExisting] = useState<any>(null);

  useEffect(() => {
    if (!bookable || motel.isOwner) return;
    apiFetch<{ booking: any }>(`/motel/bookings/with/${motel.id}`)
      .then((r) => { if (r?.booking && STATUS_TEXT[r.booking.status]) setExisting(r.booking); })
      .catch(() => {});
  }, [bookable, motel.id, motel.isOwner]);

  const room = motel.rooms.find((r) => r.id === roomId) || motel.rooms[0];
  const base = roomPrice(room, duration);
  const promo = promoFor(motel.promotions, room?.id);
  const total = base > 0 ? applyPromo(base, promo) : 0;
  const cheapest = useMemo(() => {
    /* Con la promo vigente: es lo que de verdad paga quien reserva ahora. */
    const prices = motel.rooms
      .map((r) => (roomPrice(r, "3H") > 0 ? applyPromo(roomPrice(r, "3H"), promoFor(motel.promotions, r.id)) : 0))
      .filter((p) => p > 0);
    return prices.length ? Math.min(...prices) : null;
  }, [motel.rooms, motel.promotions]);

  function pickRoom(id: string) {
    setRoomId(id);
    const r = motel.rooms.find((x) => x.id === id);
    if (r && roomPrice(r, duration) <= 0) {
      const d = DURATIONS.find((k) => roomPrice(r, k) > 0);
      if (d) setDuration(d);
    }
    setError(null);
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function submit() {
    if (!room) return;
    if (!motel.isOpen) return setError("El motel está cerrado ahora. Escríbele por chat.");
    if (base <= 0) return setError("Esta habitación no tiene tarifa para esa duración.");
    const start = new Date(`${slot.date}T${slot.time}`);
    if (Number.isNaN(start.getTime()) || start.getTime() < Date.now() - 5 * 60000) {
      return setError("Elige una hora de llegada desde ahora en adelante.");
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ booking: any }>(`/motels/${motel.id}/bookings`, {
        method: "POST",
        body: JSON.stringify({ roomId: room.id, durationType: duration, startAt: start.toISOString(), note: note.trim() || null }),
      });
      setSent(res.booking);
    } catch (e: any) {
      if (e?.status === 401) {
        router.push(`/login?next=${encodeURIComponent(pathname || `/motel/${motel.slug}`)}`);
        return;
      }
      setError(friendlyErrorMessage(e) || "No pudimos enviar la solicitud. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const bookingCard = (
    <div ref={cardRef} id="reservar" className="scroll-mt-28 rounded-3xl border border-white/10 bg-[#11121f]/90 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      {motel.kind === "listing" ? (
        <ListingCard motel={motel} />
      ) : motel.isOwner ? (
        <div className="space-y-3 text-sm">
          <p className="font-semibold">Así ven tu ficha los clientes</p>
          <p className="text-white/55">Desde tu panel cambias fotos, habitaciones, tarifas y promociones.</p>
          <Link href="/dashboard/motel" className="btn-primary w-full py-3 text-sm">Ir a mi panel</Link>
        </div>
      ) : sent ? (
        <div className="space-y-3 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
          <p className="text-lg font-semibold">Solicitud enviada</p>
          <p className="text-sm text-white/60">
            {motel.name} la revisa y te responde por chat. Cuando la acepte, confírmala ahí para recibir tu código de reserva.
          </p>
          <Link href={`/chat/${motel.id}`} className="btn-primary w-full py-3 text-sm">Ir al chat</Link>
        </div>
      ) : !bookable ? (
        <div className="space-y-3 text-sm">
          <p className="font-semibold">Este motel todavía no cargó sus habitaciones</p>
          <p className="text-white/55">Escríbele por chat para consultar disponibilidad y tarifas.</p>
          <Link href={`/chat/${motel.id}`} className="btn-primary w-full py-3 text-sm"><MessageCircle className="mr-2 h-4 w-4" /> Enviar mensaje</Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {total > 0 ? (
                <>
                  <p className="whitespace-nowrap">
                    <span className="text-2xl font-bold">{formatClp(total)}</span>
                    <span className="text-sm text-white/50"> · {DURATION_LABEL[duration]}</span>
                  </p>
                  {promo && total < base && (
                    <p className="text-[13px] text-white/45">
                      <span className="line-through">{formatClp(base)}</span> <span className="text-emerald-300">{promoLabel(promo)} {promo.title}</span>
                    </p>
                  )}
                </>
              ) : (
                <span className="text-sm text-white/60">Sin tarifa para {DURATION_LABEL[duration]}</span>
              )}
            </div>
            <span className={`shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ${motel.isOpen ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}`}>
              {motel.isOpen ? "Abierto" : "Cerrado"}
            </span>
          </div>

          {existing && (
            <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-3 text-[13px] text-amber-100">
              {STATUS_TEXT[existing.status]}{" "}
              <Link href={`/chat/${motel.id}`} className="font-semibold underline">Ver en el chat</Link>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-white/15">
            <label className="block border-b border-white/15 px-3.5 py-2.5">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/50">Habitación</span>
              <select
                value={room?.id}
                onChange={(e) => pickRoom(e.target.value)}
                className="mt-0.5 w-full bg-transparent text-sm text-white outline-none [color-scheme:dark]"
              >
                {motel.rooms.map((r) => (
                  <option key={r.id} value={r.id} className="bg-[#161726]">{r.name}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2">
              <label className="block border-r border-white/15 px-3.5 py-2.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/50">Llegada</span>
                <input type="date" value={slot.date} min={localDate(new Date())} onChange={(e) => setSlot((s) => ({ ...s, date: e.target.value }))} className="mt-0.5 w-full bg-transparent text-sm text-white outline-none [color-scheme:dark]" />
              </label>
              <label className="block px-3.5 py-2.5">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/50">Hora</span>
                <input type="time" step={900} value={slot.time} onChange={(e) => setSlot((s) => ({ ...s, time: e.target.value }))} className="mt-0.5 w-full bg-transparent text-sm text-white outline-none [color-scheme:dark]" />
              </label>
            </div>
          </div>

          <div role="group" aria-label="Duración" className="grid grid-cols-3 gap-2">
            {DURATIONS.map((d) => {
              const p = roomPrice(room, d);
              return (
                <button
                  key={d}
                  onClick={() => { setDuration(d); setError(null); }}
                  disabled={p <= 0}
                  aria-pressed={duration === d}
                  className={`rounded-xl border px-2 py-2.5 text-center transition disabled:cursor-not-allowed disabled:opacity-35 ${
                    duration === d ? "border-fuchsia-400/60 bg-fuchsia-500/15" : "border-white/10 hover:bg-white/[0.05]"
                  }`}
                >
                  <span className="block text-[13px] font-semibold">{DURATION_LABEL[d][0].toUpperCase() + DURATION_LABEL[d].slice(1)}</span>
                  <span className="block text-[11px] text-white/50">{p > 0 ? formatClp(p) : "—"}</span>
                </button>
              );
            })}
          </div>

          {showNote ? (
            <textarea
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Comentario para recepción (opcional)"
              className="input-studio min-h-[72px] resize-none"
            />
          ) : (
            <button onClick={() => setShowNote(true)} className="text-[13px] text-white/55 underline-offset-2 hover:text-white hover:underline">
              Agregar un comentario para recepción
            </button>
          )}

          {error && <p className="rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-[13px] text-red-100">{error}</p>}

          <button
            onClick={submit}
            disabled={busy || !motel.isOpen || total <= 0}
            className="btn-primary w-full py-3.5 text-[15px] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Enviando..." : !motel.isOpen ? "Cerrado ahora" : "Solicitar reserva"}
          </button>
          <p className="text-center text-[12px] text-white/40">No pagas nada ahora. El motel confirma por chat.</p>

          {total > 0 && (
            <div className="space-y-1.5 border-t border-white/10 pt-3 text-sm">
              <div className="flex justify-between text-white/65">
                <span className="truncate pr-2">{room?.name} · {DURATION_SHORT[duration]}</span>
                <span>{formatClp(base)}</span>
              </div>
              {promo && total < base && (
                <div className="flex justify-between text-emerald-300">
                  <span className="truncate pr-2">{promo.title}</span>
                  <span>-{formatClp(base - total)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 font-semibold">
                <span>Total a pagar en el motel</span>
                <span>{formatClp(total)}</span>
              </div>
            </div>
          )}

          <Link href={`/chat/${motel.id}`} className="flex items-center justify-center gap-2 text-[13px] text-white/60 hover:text-white">
            <MessageCircle className="h-4 w-4" /> Preguntar algo al motel
          </Link>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          {intro}

          {motel.promotions.length > 0 && (
            <section className="mt-8 space-y-2">
              {motel.promotions.map((p) => (
                <div key={p.id} className="flex items-start gap-3 rounded-2xl border border-fuchsia-400/25 bg-gradient-to-r from-fuchsia-600/15 to-transparent p-4">
                  <BadgePercent className="mt-0.5 h-5 w-5 shrink-0 text-fuchsia-300" />
                  <div className="text-sm">
                    <p className="font-semibold text-fuchsia-100">{p.title} <span className="ml-1 rounded-full bg-fuchsia-500/25 px-2 py-0.5 text-[11px]">{promoLabel(p)}</span></p>
                    <p className="mt-0.5 text-white/60">
                      {p.description || (p.roomIds.length ? "En habitaciones seleccionadas." : "En todas las habitaciones.")}
                      {p.endsAt ? ` Hasta el ${new Date(p.endsAt).toLocaleDateString("es-CL", { day: "numeric", month: "long" })}.` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </section>
          )}

          {motel.rooms.length > 0 && (
            <section className="mt-10">
              <h2 className="text-xl font-semibold">Habitaciones</h2>
              <div className="mt-4 space-y-4">
                {motel.rooms.map((r) => {
                  const photo = resolveMediaUrl(r.photoUrls?.[0]);
                  const rPromo = promoFor(motel.promotions, r.id);
                  const selected = r.id === room?.id;
                  return (
                    <article
                      key={r.id}
                      className={`flex flex-col gap-4 rounded-2xl border p-3 transition sm:flex-row ${selected ? "border-fuchsia-400/40 bg-fuchsia-500/[0.05]" : "border-white/[0.08] bg-white/[0.02]"}`}
                    >
                      <div className="relative aspect-[4/3] shrink-0 overflow-hidden rounded-xl bg-[#0a0a10] sm:w-56">
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photo} alt={`${r.name} en ${motel.name}`} loading="lazy" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center"><BedDouble className="h-8 w-8 text-white/15" /></div>
                        )}
                        {r.photoUrls.length > 1 && (
                          <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px]">{r.photoUrls.length} fotos</span>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold">{r.name}</h3>
                            {r.roomType && <p className="text-[13px] text-white/45">{r.roomType}</p>}
                          </div>
                          {rPromo && <span className="shrink-0 rounded-full bg-fuchsia-600/80 px-2 py-0.5 text-[11px] font-semibold">{promoLabel(rPromo)}</span>}
                        </div>
                        {r.description && <p className="mt-1.5 line-clamp-2 text-[13px] text-white/60">{r.description}</p>}
                        {r.amenities.length > 0 && (
                          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                            {r.amenities.slice(0, 6).map((a) => {
                              const Icon = amenityIcon(a);
                              return (
                                <li key={a} className="flex items-center gap-1 text-[12px] text-white/60">
                                  <Icon className="h-3.5 w-3.5 text-white/40" /> {roomAmenityLabel(a)}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-3">
                          <dl className="flex gap-4 text-[13px]">
                            {DURATIONS.map((d) => {
                              const p = roomPrice(r, d);
                              if (p <= 0) return null;
                              return (
                                <div key={d}>
                                  <dt className="text-[11px] text-white/40">{DURATION_SHORT[d]}</dt>
                                  <dd className="font-semibold">{formatClp(applyPromo(p, rPromo))}</dd>
                                </div>
                              );
                            })}
                          </dl>
                          {bookable && !motel.isOwner && (
                            <button
                              onClick={() => pickRoom(r.id)}
                              className={`rounded-xl px-4 py-2 text-[13px] font-semibold transition ${selected ? "bg-white text-black" : "border border-white/15 bg-white/[0.05] hover:bg-white/10"}`}
                            >
                              {selected ? "Elegida" : "Elegir"}
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {after}
        </div>

        <aside className="lg:block">
          <div className="lg:sticky lg:top-24">{bookingCard}</div>
        </aside>
      </div>

      {/* Teléfono: barra fija con el precio, encima del menú inferior */}
      {bookable && !motel.isOwner && !sent && (
        <div className="fixed inset-x-0 bottom-[calc(58px+env(safe-area-inset-bottom))] z-30 border-t border-white/10 bg-[#0d0e1a]/95 px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
            <div className="text-sm">
              {cheapest ? (
                <>
                  <span className="text-white/50">desde </span>
                  <span className="font-semibold">{formatClp(cheapest)}</span>
                  <span className="text-white/50"> · 3 h</span>
                </>
              ) : (
                <span className="text-white/60">Consulta tarifas</span>
              )}
            </div>
            <button
              onClick={() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
              className="btn-primary px-5 py-2.5 text-sm"
            >
              <CalendarClock className="mr-1.5 h-4 w-4" /> Reservar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Ficha cargada por el equipo: todavía no reserva en UZEED. */
function ListingCard({ motel }: { motel: MotelDetail }) {
  const maps = motel.latitude != null && motel.longitude != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${motel.latitude},${motel.longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${motel.name} ${motel.address || ""}`)}`;
  return (
    <div className="space-y-3 text-sm">
      <p className="font-semibold">Tarifas y reservas en el sitio del motel</p>
      <p className="text-white/55">{motel.name} todavía no recibe reservas por UZEED.</p>
      <div className="grid gap-2">
        {motel.websiteUrl && (
          <a href={motel.websiteUrl} target="_blank" rel="noopener nofollow" className="btn-primary w-full py-3 text-sm">
            <Globe className="mr-2 h-4 w-4" /> Ver sitio web
          </a>
        )}
        {motel.phone && (
          <a href={`tel:${motel.phone.replace(/\s+/g, "")}`} className="btn-secondary w-full py-3 text-sm">
            <Phone className="mr-2 h-4 w-4" /> Llamar
          </a>
        )}
        <a href={maps} target="_blank" rel="noopener" className="btn-secondary w-full py-3 text-sm">
          <Navigation className="mr-2 h-4 w-4" /> Cómo llegar
        </a>
      </div>
      <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[13px] text-white/60">
        <p className="flex items-center gap-1.5 font-medium text-white/80"><Store className="h-4 w-4" /> ¿Es tu motel?</p>
        <p className="mt-1">Crea tu cuenta y maneja la ficha: fotos, habitaciones, tarifas y reservas por chat.</p>
        <Link href="/register?type=ESTABLISHMENT" className="mt-2 inline-block font-semibold text-fuchsia-300 hover:text-fuchsia-200">Publicar mi motel →</Link>
      </div>
    </div>
  );
}

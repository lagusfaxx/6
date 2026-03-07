"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import useMe from "../../hooks/useMe";
import {
  Video,
  Calendar,
  Coins,
  Play,
  XCircle,
  AlertTriangle,
  Phone,
  User,
  Plus,
  Trash2,
  Clock3,
} from "lucide-react";

type AvailabilitySlot = {
  day: number;
  from: string;
  to: string;
};

type Config = {
  id: string;
  pricePerMinute: number;
  minDurationMin: number;
  maxDurationMin: number;
  availableSlots: AvailabilitySlot[] | null;
  isActive: boolean;
  professional: { id: string; displayName: string; username: string; avatarUrl: string | null };
};

type Booking = {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  totalTokens: number;
  platformFee: number;
  professionalPay: number;
  status: string;
  roomId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  client: { id: string; displayName: string; username: string; avatarUrl: string | null };
  professional: { id: string; displayName: string; username: string; avatarUrl: string | null };
};

const STATUS_UI: Record<string, { label: string; color: string; help: string }> = {
  PENDING: {
    label: "Pendiente",
    color: "text-amber-300 border-amber-500/30 bg-amber-500/10",
    help: "Pago retenido en escrow hasta que la llamada se complete.",
  },
  CONFIRMED: {
    label: "Confirmada",
    color: "text-blue-300 border-blue-500/30 bg-blue-500/10",
    help: "Reserva confirmada. Se puede iniciar dentro de la ventana de gracia.",
  },
  IN_PROGRESS: {
    label: "En curso",
    color: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10",
    help: "La videollamada está activa.",
  },
  COMPLETED: {
    label: "Completada",
    color: "text-white/70 border-white/20 bg-white/5",
    help: "Servicio completado, fondos liberados.",
  },
  CANCELLED_CLIENT: {
    label: "Cancelada",
    color: "text-red-300 border-red-500/30 bg-red-500/10",
    help: "Cancelada por cliente, fondos devueltos según política.",
  },
  NO_SHOW_PROFESSIONAL: {
    label: "No-show profesional",
    color: "text-red-300 border-red-500/30 bg-red-500/10",
    help: "No se presentó la profesional. Se aplica devolución y penalización.",
  },
};

const DAY_OPTIONS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
];

const DEFAULT_SLOT: AvailabilitySlot = { day: 1, from: "09:00", to: "18:00" };

function VideocallPageContent() {
  const { me } = useMe();
  const params = useSearchParams();
  const professionalId = params?.get("professional") || null;

  const [config, setConfig] = useState<Config | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tab, setTab] = useState<"book" | "my">(professionalId ? "book" : "my");

  const [duration, setDuration] = useState(10);
  const [scheduledAt, setScheduledAt] = useState("");
  const [bookLoading, setBookLoading] = useState(false);
  const [bookMsg, setBookMsg] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);

  const [configPrice, setConfigPrice] = useState("10");
  const [configMin, setConfigMin] = useState("5");
  const [configMax, setConfigMax] = useState("60");
  const [configActive, setConfigActive] = useState(true);
  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([]);
  const [configSaving, setConfigSaving] = useState(false);

  const isProfessional = me?.user?.profileType === "PROFESSIONAL";
  const myId = me?.user?.id;

  const loadBookings = useCallback(async () => {
    try {
      const role = isProfessional ? "professional" : "client";
      const res = await apiFetch<{ bookings: Booking[] }>(`/videocall/bookings?role=${role}`);
      setBookings(res.bookings || []);
    } catch {}
  }, [isProfessional]);

  useEffect(() => {
    loadBookings();
    apiFetch<{ balance: number }>("/wallet")
      .then((w) => setWalletBalance(w.balance))
      .catch(() => {});
  }, [loadBookings]);

  useEffect(() => {
    if (professionalId) {
      apiFetch<{ config: Config }>(`/videocall/config/${professionalId}`)
        .then((r) => {
          setConfig(r.config);
          setDuration(r.config.minDurationMin || 10);
        })
        .catch(() => setConfig(null));
    }
  }, [professionalId]);

  useEffect(() => {
    if (isProfessional && myId) {
      apiFetch<{ config: Config }>(`/videocall/config/${myId}`)
        .then((r) => {
          if (!r.config) return;
          setConfigPrice(String(r.config.pricePerMinute));
          setConfigMin(String(r.config.minDurationMin));
          setConfigMax(String(r.config.maxDurationMin));
          setConfigActive(r.config.isActive);
          setAvailableSlots(Array.isArray(r.config.availableSlots) ? r.config.availableSlots : []);
        })
        .catch(() => {});
    }
  }, [isProfessional, myId]);

  const totalCost = config ? config.pricePerMinute * duration : 0;

  const bookingValidationMsg = useMemo(() => {
    if (!config || !scheduledAt) return "";
    const date = new Date(scheduledAt);
    if (Number.isNaN(date.getTime())) return "Fecha inválida.";
    const slots = Array.isArray(config.availableSlots) ? config.availableSlots : [];
    if (!slots.length) return "";

    const day = date.getDay();
    const start = date.getHours() * 60 + date.getMinutes();
    const end = start + duration;
    const inSlot = slots.some((slot) => {
      if (slot.day !== day) return false;
      const [fh, fm] = slot.from.split(":").map(Number);
      const [th, tm] = slot.to.split(":").map(Number);
      const from = fh * 60 + fm;
      const to = th * 60 + tm;
      return start >= from && end <= to;
    });

    return inSlot ? "" : "La hora seleccionada está fuera de la disponibilidad de la profesional.";
  }, [config, scheduledAt, duration]);

  const addSlot = () => {
    setAvailableSlots((prev) => [...prev, { ...DEFAULT_SLOT }]);
  };

  const updateSlot = (index: number, key: keyof AvailabilitySlot, value: string | number) => {
    setAvailableSlots((prev) => prev.map((slot, idx) => (idx === index ? { ...slot, [key]: value } : slot)));
  };

  const removeSlot = (index: number) => {
    setAvailableSlots((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleBook = async () => {
    if (!professionalId || !scheduledAt || bookingValidationMsg) return;
    setBookLoading(true);
    setBookMsg("");
    try {
      await apiFetch("/videocall/book", {
        method: "POST",
        body: JSON.stringify({ professionalId, scheduledAt, durationMinutes: duration }),
      });
      setBookMsg("Videollamada reservada con pago retenido correctamente.");
      loadBookings();
      setTab("my");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error al reservar";
      setBookMsg(message);
    } finally {
      setBookLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    try {
      await apiFetch("/videocall/config", {
        method: "PUT",
        body: JSON.stringify({
          pricePerMinute: parseInt(configPrice, 10),
          minDurationMin: parseInt(configMin, 10),
          maxDurationMin: parseInt(configMax, 10),
          availableSlots,
          isActive: configActive,
        }),
      });
      setBookMsg("");
    } catch {
    } finally {
      setConfigSaving(false);
    }
  };

  const handleAction = async (bookingId: string, action: string) => {
    try {
      await apiFetch(`/videocall/${bookingId}/${action}`, { method: "POST" });
      loadBookings();
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      <div className="mx-auto max-w-3xl px-4 py-8 pb-28">
        <div className="mb-6 rounded-3xl border border-violet-500/20 bg-gradient-to-r from-violet-600/10 to-fuchsia-600/10 p-5">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-600/20">
              <Video className="h-5 w-5 text-violet-300" />
            </div>
            <h1 className="text-2xl font-bold">Videollamadas</h1>
          </div>
          <p className="text-xs text-white/60">
            Reserva, pago en escrow y ejecución dentro de la app. El dinero solo se libera si la llamada se completa.
          </p>
        </div>

        <div className="mb-6 flex gap-2">
          {professionalId && (
            <button
              onClick={() => setTab("book")}
              className={`rounded-full border px-4 py-2 text-xs font-medium ${
                tab === "book" ? "border-violet-500/30 bg-violet-500/15 text-violet-300" : "border-white/10 text-white/50"
              }`}
            >
              Reservar
            </button>
          )}
          <button
            onClick={() => setTab("my")}
            className={`rounded-full border px-4 py-2 text-xs font-medium ${
              tab === "my" ? "border-violet-500/30 bg-violet-500/15 text-violet-300" : "border-white/10 text-white/50"
            }`}
          >
            Mis Videollamadas
          </button>
        </div>

        {tab === "book" && config && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="rounded-2xl border border-violet-500/15 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center gap-3">
                {config.professional.avatarUrl ? (
                  <img src={resolveMediaUrl(config.professional.avatarUrl) ?? undefined} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
                    <User className="h-6 w-6 text-white/30" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold">{config.professional.displayName || config.professional.username}</p>
                  <p className="text-xs text-violet-300">{config.pricePerMinute} tokens/min</p>
                </div>
              </div>

              <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-[11px] text-white/70">
                <p className="mb-1 font-medium text-white/80">Disponibilidad de la profesional</p>
                {Array.isArray(config.availableSlots) && config.availableSlots.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {config.availableSlots.map((slot, idx) => (
                      <span key={`${slot.day}-${slot.from}-${idx}`} className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-200">
                        {DAY_OPTIONS.find((d) => d.value === slot.day)?.label} {slot.from} - {slot.to}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-white/50">Sin horario definido aún.</p>
                )}
              </div>

              <label className="mb-1 block text-xs text-white/50">Fecha y hora</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mb-4 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-violet-500/30"
              />

              <label className="mb-1 block text-xs text-white/50">Duración: {duration} min</label>
              <input
                type="range"
                min={config.minDurationMin}
                max={config.maxDurationMin}
                step={5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="mb-2 w-full accent-violet-500"
              />
              <div className="mb-4 flex justify-between text-[10px] text-white/30">
                <span>{config.minDurationMin} min</span>
                <span>{config.maxDurationMin} min</span>
              </div>

              <div className="mb-4 flex items-center justify-between rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                <span className="text-sm text-white/60">Costo total</span>
                <span className="text-lg font-bold text-violet-300">{totalCost} tokens</span>
              </div>

              {bookingValidationMsg && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
                  <Clock3 className="h-4 w-4 shrink-0" />
                  {bookingValidationMsg}
                </div>
              )}

              {walletBalance < totalCost && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Saldo insuficiente ({walletBalance} tokens). <Link href="/wallet" className="underline">Cargar tokens</Link>
                </div>
              )}

              <button
                onClick={handleBook}
                disabled={bookLoading || !scheduledAt || walletBalance < totalCost || Boolean(bookingValidationMsg)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold disabled:opacity-50"
              >
                <Calendar className="h-4 w-4" /> {bookLoading ? "Reservando..." : "Reservar Videollamada"}
              </button>
              {bookMsg && <p className="mt-2 text-center text-xs text-violet-300">{bookMsg}</p>}
            </div>
          </motion.div>
        )}

        {tab === "my" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            {isProfessional && (
              <div className="rounded-2xl border border-violet-500/15 bg-white/[0.03] p-4">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Video className="h-4 w-4 text-violet-400" /> Mi configuración de videollamadas
                </h3>
                <div className="mb-3 grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-[10px] text-white/40">Precio/min (tokens)</label>
                    <input type="number" value={configPrice} onChange={(e) => setConfigPrice(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] text-white/40">Mín (min)</label>
                    <input type="number" value={configMin} onChange={(e) => setConfigMin(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs outline-none" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] text-white/40">Máx (min)</label>
                    <input type="number" value={configMax} onChange={(e) => setConfigMax(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs outline-none" />
                  </div>
                </div>

                <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-white/80">Calendario de disponibilidad</p>
                    <button type="button" onClick={addSlot} className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[10px] text-violet-200">
                      <Plus className="h-3 w-3" /> Agregar bloque
                    </button>
                  </div>
                  <div className="space-y-2">
                    {availableSlots.length === 0 && <p className="text-[11px] text-white/45">Sin bloques. Si no defines bloques, el cliente podrá reservar cualquier hora válida.</p>}
                    {availableSlots.map((slot, index) => (
                      <div key={`slot-${index}`} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                        <select
                          value={slot.day}
                          onChange={(e) => updateSlot(index, "day", Number(e.target.value))}
                          className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-xs outline-none"
                        >
                          {DAY_OPTIONS.map((day) => (
                            <option key={day.value} value={day.value}>{day.label}</option>
                          ))}
                        </select>
                        <input type="time" value={slot.from} onChange={(e) => updateSlot(index, "from", e.target.value)} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-xs outline-none" />
                        <input type="time" value={slot.to} onChange={(e) => updateSlot(index, "to", e.target.value)} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-xs outline-none" />
                        <button type="button" onClick={() => removeSlot(index)} className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 text-red-300">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <label className="mb-3 flex items-center gap-2 text-xs text-white/60">
                  <input type="checkbox" checked={configActive} onChange={(e) => setConfigActive(e.target.checked)} className="accent-violet-500" />
                  Videollamadas activas
                </label>
                <button onClick={handleSaveConfig} disabled={configSaving} className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium">
                  {configSaving ? "Guardando..." : "Guardar configuración"}
                </button>
              </div>
            )}

            {bookings.length === 0 ? (
              <div className="py-12 text-center text-sm text-white/30">Sin videollamadas agendadas</div>
            ) : (
              bookings.map((b) => {
                const other = myId === b.client.id ? b.professional : b.client;
                const scheduled = new Date(b.scheduledAt);
                const isGraceWindow = Math.abs(Date.now() - scheduled.getTime()) < 10 * 60 * 1000;
                const status = STATUS_UI[b.status] || {
                  label: b.status,
                  color: "text-white/60 border-white/20 bg-white/5",
                  help: "",
                };

                return (
                  <div key={b.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {other.avatarUrl ? (
                          <img src={resolveMediaUrl(other.avatarUrl) ?? undefined} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                            <User className="h-5 w-5 text-white/30" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold">{other.displayName || other.username}</p>
                          <p className="text-[10px] text-white/40">
                            <Calendar className="mr-0.5 inline h-3 w-3" />
                            {scheduled.toLocaleDateString("es-CL")} {scheduled.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                            {" · "}
                            {b.durationMinutes} min · {b.totalTokens} tokens
                          </p>
                        </div>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${status.color}`}>{status.label}</span>
                    </div>

                    {status.help && <p className="mt-2 text-[11px] text-white/45">{status.help}</p>}
                    {(b.status === "PENDING" || b.status === "CONFIRMED") && (
                      <p className="mt-2 text-[11px] text-white/45">Ventana de gracia: ambas partes pueden unirse hasta 10 minutos después del inicio.</p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {isProfessional && (b.status === "PENDING" || b.status === "CONFIRMED") && (
                        <Link
                          href={`/videocall/room/${b.id}`}
                          className={`flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium ${
                            isGraceWindow ? "bg-emerald-600" : "bg-white/10 text-white/70"
                          }`}
                        >
                          <Play className="h-3.5 w-3.5" /> {isGraceWindow ? "Iniciar / Entrar" : "Ver sala"}
                        </Link>
                      )}

                      {b.status === "IN_PROGRESS" && (
                        <Link href={`/videocall/room/${b.id}`} className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium">
                          <Phone className="h-3.5 w-3.5" /> Unirse a la llamada
                        </Link>
                      )}

                      {!isProfessional && (b.status === "PENDING" || b.status === "CONFIRMED") && (
                        <>
                          <button onClick={() => handleAction(b.id, "cancel")} className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300">
                            <XCircle className="h-3.5 w-3.5" /> Cancelar
                          </button>
                          {isGraceWindow && (
                            <button onClick={() => handleAction(b.id, "noshow")} className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300">
                              <AlertTriangle className="h-3.5 w-3.5" /> Reportar no-show
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </motion.div>
        )}

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-xs text-white/60">
          <p className="mb-2 font-semibold text-white/80">Flujo protegido por tokens</p>
          <ul className="space-y-1">
            <li className="flex items-center gap-2"><Coins className="h-3.5 w-3.5 text-violet-300" /> Cliente paga antes con tokens.</li>
            <li className="flex items-center gap-2"><Coins className="h-3.5 w-3.5 text-violet-300" /> Los fondos quedan retenidos hasta completar la llamada.</li>
            <li className="flex items-center gap-2"><Coins className="h-3.5 w-3.5 text-violet-300" /> Si no se cumple, se procesa reembolso y penalización según estado.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function VideocallPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0b14]" />}>
      <VideocallPageContent />
    </Suspense>
  );
}

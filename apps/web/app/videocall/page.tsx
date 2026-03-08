"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import useMe from "../../hooks/useMe";
import {
  Video, Calendar, Coins, XCircle, AlertTriangle, Phone, User,
  Clock3, Search, X, Play, Plus, Trash2, Save, Settings,
  ToggleLeft, ToggleRight, Lock, Wallet, Star, ArrowRight,
  CalendarDays, Timer, PhoneCall, CheckCircle, Ban,
} from "lucide-react";

/* ── Types ── */

type ProfessionalCard = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  pricePerMinute: number;
  minDurationMin: number;
  maxDurationMin: number;
  availableSlots: AvailabilitySlot[] | null;
};

type AvailabilitySlot = { day: number; from: string; to: string };

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

type Config = {
  id: string;
  pricePerMinute: number;
  minDurationMin: number;
  maxDurationMin: number;
  availableSlots: AvailabilitySlot[] | null;
  isActive: boolean;
  professional: { id: string; displayName: string; username: string; avatarUrl: string | null };
};

const STATUS_UI: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Pendiente", color: "text-amber-300", bg: "border-amber-500/30 bg-amber-500/10" },
  CONFIRMED: { label: "Confirmada", color: "text-blue-300", bg: "border-blue-500/30 bg-blue-500/10" },
  IN_PROGRESS: { label: "En curso", color: "text-emerald-300", bg: "border-emerald-500/30 bg-emerald-500/10" },
  COMPLETED: { label: "Completada", color: "text-white/50", bg: "border-white/15 bg-white/5" },
  CANCELLED_CLIENT: { label: "Cancelada", color: "text-red-300", bg: "border-red-500/30 bg-red-500/10" },
  NO_SHOW_PROFESSIONAL: { label: "No-show", color: "text-red-300", bg: "border-red-500/30 bg-red-500/10" },
};

type BookedSlot = { start: string; durationMinutes: number };

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_NAMES_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const CL_TIMEZONE = "America/Santiago";
const WEEKDAY_TO_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

type ChileDateParts = { year: number; month: number; day: number; weekday: number; hour: number; minute: number };

function getChileDateParts(date: Date): ChileDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CL_TIMEZONE, weekday: "short", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const find = (type: string, fallback: string) => parts.find((p) => p.type === type)?.value ?? fallback;
  return {
    year: Number(find("year", "1970")), month: Number(find("month", "01")),
    day: Number(find("day", "01")), weekday: WEEKDAY_TO_INDEX[find("weekday", "Sun")] ?? 0,
    hour: Number(find("hour", "00")), minute: Number(find("minute", "00")),
  };
}

function getChileDateKey(date: Date): string {
  const p = getChileDateParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function formatChileDate(date: Date, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("es-CL", { ...opts, timeZone: CL_TIMEZONE }).format(date);
}

function generateTimeBlocks(
  date: Date, availableSlots: AvailabilitySlot[], bookedSlots: BookedSlot[], duration: number,
): { time: string; hour: number; minute: number; available: boolean; booked: boolean }[] {
  const chileDate = getChileDateParts(date);
  const daySlots = availableSlots.filter((s) => s.day === chileDate.weekday);
  if (daySlots.length === 0) return [];

  const blocks: { time: string; hour: number; minute: number; available: boolean; booked: boolean }[] = [];
  const selectedDateKey = getChileDateKey(date);
  const nowChile = getChileDateParts(new Date());
  const nowDateKey = getChileDateKey(new Date());
  const nowMinutes = nowChile.hour * 60 + nowChile.minute;

  for (const slot of daySlots) {
    const [fromH, fromM] = slot.from.split(":").map(Number);
    const [toH, toM] = slot.to.split(":").map(Number);
    const slotStartMin = fromH * 60 + fromM;
    const slotEndMin = toH * 60 + toM;

    for (let min = slotStartMin; min + duration <= slotEndMin; min += 30) {
      const h = Math.floor(min / 60);
      const m = min % 60;
      const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      if (selectedDateKey === nowDateKey && min <= nowMinutes) continue;

      const blockStart = min;
      const blockEnd = blockStart + duration;
      const isBooked = bookedSlots.some((bs) => {
        const bookingDate = new Date(bs.start);
        if (getChileDateKey(bookingDate) !== selectedDateKey) return false;
        const bookingChile = getChileDateParts(bookingDate);
        const bStart = bookingChile.hour * 60 + bookingChile.minute;
        return blockStart < bStart + bs.durationMinutes && bStart < blockEnd;
      });
      blocks.push({ time: timeStr, hour: h, minute: m, available: true, booked: isBooked });
    }
  }
  return blocks;
}

function getAvailableDates(availableSlots: AvailabilitySlot[], daysAhead = 14): Date[] {
  const dates: Date[] = [];
  const availableDays = new Set(availableSlots.map((s) => s.day));
  for (let i = 0; i < daysAhead; i++) {
    const d = new Date(Date.now() + i * 24 * 60 * 60 * 1000);
    if (availableDays.has(getChileDateParts(d).weekday)) dates.push(d);
  }
  return dates;
}

/* ── Next Booking Banner ── */

function NextBookingBanner({ booking, myId, isProfessional }: { booking: Booking; myId: string; isProfessional: boolean }) {
  const other = myId === booking.client.id ? booking.professional : booking.client;
  const scheduled = new Date(booking.scheduledAt);
  const now = Date.now();
  const roomOpensAt = scheduled.getTime() - 5 * 60 * 1000;
  const canJoin = now >= roomOpensAt && now <= scheduled.getTime() + 15 * 60 * 1000;

  const msUntil = roomOpensAt - now;
  const minsUntil = Math.max(0, Math.ceil(msUntil / 60000));

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`mb-5 overflow-hidden rounded-2xl border p-4 ${
        canJoin
          ? "border-emerald-500/30 bg-gradient-to-r from-emerald-600/15 to-teal-600/10"
          : booking.status === "IN_PROGRESS"
            ? "border-emerald-500/30 bg-gradient-to-r from-emerald-600/15 to-teal-600/10 animate-pulse"
            : "border-violet-500/20 bg-gradient-to-r from-violet-600/10 to-fuchsia-600/5"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <PhoneCall className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300/70">
          {booking.status === "IN_PROGRESS" ? "Llamada en curso" : "Próxima llamada"}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {other.avatarUrl ? (
            <img src={resolveMediaUrl(other.avatarUrl) ?? undefined} alt="" className="h-12 w-12 rounded-xl object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
              <User className="h-6 w-6 text-white/30" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold">{other.displayName || other.username}</p>
            <p className="text-[11px] text-white/40">
              {scheduled.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })}
              {" "}
              {scheduled.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
              {" · "}{booking.durationMinutes} min
            </p>
          </div>
        </div>

        {(canJoin || booking.status === "IN_PROGRESS") ? (
          <Link
            href={`/videocall/room/${booking.id}`}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-3 text-xs font-bold shadow-lg shadow-emerald-500/20 transition hover:opacity-90"
          >
            <Phone className="h-4 w-4" />
            {booking.status === "IN_PROGRESS" ? "Unirse" : "Entrar"}
          </Link>
        ) : minsUntil > 0 ? (
          <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white/50">
            <Clock3 className="h-3.5 w-3.5" />
            {minsUntil > 60 ? `${Math.floor(minsUntil / 60)}h ${minsUntil % 60}m` : `${minsUntil} min`}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

/* ── Booking Card ── */

function BookingCard({ b, myId, isProfessional, onAction }: {
  b: Booking; myId: string; isProfessional: boolean;
  onAction: (bookingId: string, action: string) => void;
}) {
  const other = myId === b.client.id ? b.professional : b.client;
  const scheduled = new Date(b.scheduledAt);
  const now = Date.now();
  const roomOpensAt = scheduled.getTime() - 5 * 60 * 1000;
  const canJoin = now >= roomOpensAt && now <= scheduled.getTime() + 15 * 60 * 1000;
  const status = STATUS_UI[b.status] || { label: b.status, color: "text-white/60", bg: "border-white/20 bg-white/5" };
  const canReportNoShow = !isProfessional && (b.status === "PENDING" || b.status === "CONFIRMED") && now >= scheduled.getTime() + 10 * 60 * 1000;

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden transition hover:bg-white/[0.04]">
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {other.avatarUrl ? (
              <img src={resolveMediaUrl(other.avatarUrl) ?? undefined} alt="" className="h-11 w-11 rounded-xl object-cover" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10">
                <User className="h-5 w-5 text-white/30" />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold">{other.displayName || other.username}</p>
              <p className="text-[11px] text-white/40">
                {scheduled.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", month: "short" })}
                {" "}{scheduled.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                {" · "}{b.durationMinutes} min · {isProfessional ? b.professionalPay : b.totalTokens} tokens
              </p>
            </div>
          </div>
          <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${status.color} ${status.bg}`}>
            {status.label}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {b.status === "IN_PROGRESS" && (
            <Link href={`/videocall/room/${b.id}`} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-semibold shadow-lg shadow-emerald-500/20">
              <Phone className="h-3.5 w-3.5" /> Unirse
            </Link>
          )}
          {(b.status === "PENDING" || b.status === "CONFIRMED") && canJoin && (
            <Link href={`/videocall/room/${b.id}`} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-xs font-semibold shadow-lg shadow-violet-500/20">
              <Play className="h-3.5 w-3.5" /> Entrar a la sala
            </Link>
          )}
          {!isProfessional && (b.status === "PENDING" || b.status === "CONFIRMED") && (
            <button onClick={() => onAction(b.id, "cancel")} className="flex items-center gap-1 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs font-medium text-red-300 transition hover:bg-red-500/10">
              <XCircle className="h-3.5 w-3.5" /> Cancelar
            </button>
          )}
          {canReportNoShow && (
            <button onClick={() => onAction(b.id, "noshow")} className="flex items-center gap-1 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/10">
              <AlertTriangle className="h-3.5 w-3.5" /> No-show
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Professional Dashboard ── */

function ProfessionalDashboard({ me }: { me: any }) {
  const myId = me?.user?.id;
  const [activeTab, setActiveTab] = useState<"bookings" | "config">("bookings");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Config | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [pricePerMinute, setPricePerMinute] = useState(10);
  const [minDuration, setMinDuration] = useState(5);
  const [maxDuration, setMaxDuration] = useState(60);
  const [isActive, setIsActive] = useState(true);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const loadBookings = useCallback(async () => {
    try {
      const res = await apiFetch<{ bookings: Booking[] }>("/videocall/bookings?role=professional");
      setBookings(res.bookings || []);
    } catch {}
    setLoading(false);
  }, []);

  const loadConfig = useCallback(async () => {
    if (!myId) return;
    try {
      const res = await apiFetch<{ config: Config }>(`/videocall/config/${myId}`);
      const c = res.config;
      setConfig(c);
      setPricePerMinute(c.pricePerMinute);
      setMinDuration(c.minDurationMin);
      setMaxDuration(c.maxDurationMin);
      setIsActive(c.isActive);
      setSlots(Array.isArray(c.availableSlots) ? c.availableSlots : []);
    } catch {}
    setConfigLoading(false);
  }, [myId]);

  useEffect(() => { loadBookings(); loadConfig(); }, [loadBookings, loadConfig]);
  useEffect(() => {
    const interval = setInterval(loadBookings, 30000);
    return () => clearInterval(interval);
  }, [loadBookings]);

  const handleAction = async (bookingId: string, action: string) => {
    try {
      await apiFetch(`/videocall/${bookingId}/${action}`, { method: "POST" });
      loadBookings();
    } catch {}
  };

  const handleSaveConfig = async () => {
    setSaving(true); setSaveMsg("");
    try {
      await apiFetch("/videocall/config", {
        method: "PUT",
        body: JSON.stringify({ pricePerMinute, minDurationMin: minDuration, maxDurationMin: maxDuration, isActive, availableSlots: slots }),
      });
      setSaveMsg("Configuración guardada.");
      loadConfig();
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Error al guardar");
    } finally { setSaving(false); }
  };

  const addSlot = () => setSlots([...slots, { day: 1, from: "09:00", to: "18:00" }]);
  const removeSlot = (idx: number) => setSlots(slots.filter((_, i) => i !== idx));
  const updateSlot = (idx: number, field: keyof AvailabilitySlot, value: string | number) => setSlots(slots.map((s, i) => i === idx ? { ...s, [field]: value } : s));

  const activeBookings = bookings.filter((b) => ["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(b.status));
  const pastBookings = bookings.filter((b) => !["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(b.status));
  const nextBooking = activeBookings[0];

  // Stats
  const totalEarned = pastBookings.filter((b) => b.status === "COMPLETED").reduce((sum, b) => sum + b.professionalPay, 0);
  const completedCount = pastBookings.filter((b) => b.status === "COMPLETED").length;

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      <div className="mx-auto max-w-3xl px-4 py-6 pb-28">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/25">
              <Video className="h-6 w-6 text-violet-200" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Videollamadas</h1>
              <p className="text-xs text-white/40">Panel profesional</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-medium ${isActive ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
              <div className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-red-400"}`} />
              {isActive ? "Activo" : "Inactivo"}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/30">Próximas</p>
            <p className="text-xl font-bold text-violet-300">{activeBookings.length}</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/30">Completadas</p>
            <p className="text-xl font-bold text-emerald-300">{completedCount}</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-white/30">Ganado</p>
            <p className="text-xl font-bold text-fuchsia-300">{totalEarned}</p>
          </div>
        </div>

        {/* Next booking banner */}
        {nextBooking && <NextBookingBanner booking={nextBooking} myId={myId} isProfessional />}

        {/* Tabs */}
        <div className="mb-5 flex gap-1.5 rounded-2xl bg-white/[0.04] p-1">
          <button onClick={() => setActiveTab("bookings")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium transition ${activeTab === "bookings" ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/60"}`}>
            <CalendarDays className="h-3.5 w-3.5" />
            Llamadas
            {activeBookings.length > 0 && <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-[9px] font-bold">{activeBookings.length}</span>}
          </button>
          <button onClick={() => setActiveTab("config")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium transition ${activeTab === "config" ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/60"}`}>
            <Settings className="h-3.5 w-3.5" /> Configuración
          </button>
        </div>

        {/* ── BOOKINGS TAB ── */}
        {activeTab === "bookings" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />)}</div>
            ) : (
              <>
                {activeBookings.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Próximas</h3>
                    <div className="space-y-3">
                      {activeBookings.map((b) => <BookingCard key={b.id} b={b} myId={myId} isProfessional onAction={handleAction} />)}
                    </div>
                  </div>
                )}
                {pastBookings.length > 0 && (
                  <div>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Historial</h3>
                    <div className="space-y-2">
                      {pastBookings.slice(0, 20).map((b) => {
                        const status = STATUS_UI[b.status] || { label: b.status, color: "text-white/60", bg: "border-white/20 bg-white/5" };
                        return (
                          <div key={b.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                            <div className="flex items-center gap-3">
                              {b.client.avatarUrl ? (
                                <img src={resolveMediaUrl(b.client.avatarUrl) ?? undefined} alt="" className="h-9 w-9 rounded-lg object-cover" />
                              ) : (
                                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10"><User className="h-4 w-4 text-white/30" /></div>
                              )}
                              <div>
                                <p className="text-xs font-medium">{b.client.displayName || b.client.username}</p>
                                <p className="text-[10px] text-white/30">{new Date(b.scheduledAt).toLocaleDateString("es-CL")} · {b.durationMinutes} min · {b.professionalPay} tokens</p>
                              </div>
                            </div>
                            <span className={`rounded-full border px-2 py-0.5 text-[9px] font-medium ${status.color} ${status.bg}`}>{status.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {bookings.length === 0 && (
                  <div className="py-20 text-center">
                    <Calendar className="mx-auto mb-4 h-12 w-12 text-white/15" />
                    <p className="text-sm text-white/40">Aún no tienes videollamadas</p>
                    <p className="mt-1 text-xs text-white/25">Cuando un cliente reserve, aparecerá aquí</p>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ── CONFIG TAB ── */}
        {activeTab === "config" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {configLoading ? (
              <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/[0.04]" />)}</div>
            ) : (
              <>
                {/* Active toggle */}
                <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <div>
                    <p className="text-sm font-semibold">Estado del servicio</p>
                    <p className="text-[11px] text-white/40">{isActive ? "Visible para clientes" : "No visible"}</p>
                  </div>
                  <button onClick={() => setIsActive(!isActive)} className="shrink-0">
                    {isActive ? <ToggleRight className="h-8 w-8 text-emerald-400" /> : <ToggleLeft className="h-8 w-8 text-white/30" />}
                  </button>
                </div>

                {/* Pricing */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <h4 className="mb-4 text-sm font-semibold">Precio y duración</h4>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1.5 block text-xs text-white/50">Tokens/min</label>
                      <input type="number" value={pricePerMinute} onChange={(e) => setPricePerMinute(Math.max(1, Number(e.target.value)))} min={1} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-violet-500/30" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-white/50">Min (min)</label>
                      <input type="number" value={minDuration} onChange={(e) => setMinDuration(Math.max(1, Number(e.target.value)))} min={1} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-violet-500/30" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-white/50">Máx (min)</label>
                      <input type="number" value={maxDuration} onChange={(e) => setMaxDuration(Math.max(minDuration, Number(e.target.value)))} min={minDuration} className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-violet-500/30" />
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl border border-violet-500/15 bg-violet-500/5 px-3 py-2">
                    <p className="text-xs text-violet-300">
                      Ej: {minDuration} min = <strong>{pricePerMinute * minDuration} tokens</strong> · {maxDuration} min = <strong>{pricePerMinute * maxDuration} tokens</strong>
                    </p>
                  </div>
                </div>

                {/* Availability */}
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold">Horarios</h4>
                      <p className="text-[11px] text-white/40">Define cuándo estás disponible</p>
                    </div>
                    <button onClick={addSlot} className="flex items-center gap-1 rounded-xl bg-violet-500/20 px-3 py-2 text-xs font-medium text-violet-300 transition hover:bg-violet-500/30">
                      <Plus className="h-3 w-3" /> Agregar
                    </button>
                  </div>

                  {slots.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 p-6 text-center">
                      <Calendar className="mx-auto mb-2 h-8 w-8 text-white/15" />
                      <p className="text-xs text-white/30">Sin horarios configurados</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {slots.map((slot, idx) => (
                        <div key={idx} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                          <select value={slot.day} onChange={(e) => updateSlot(idx, "day", Number(e.target.value))} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs outline-none">
                            {DAY_NAMES_FULL.map((name, d) => <option key={d} value={d} className="bg-[#12131f]">{name}</option>)}
                          </select>
                          <input type="time" value={slot.from} onChange={(e) => updateSlot(idx, "from", e.target.value)} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-xs outline-none" />
                          <span className="text-xs text-white/30">—</span>
                          <input type="time" value={slot.to} onChange={(e) => updateSlot(idx, "to", e.target.value)} className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-2 text-xs outline-none" />
                          <button onClick={() => removeSlot(idx)} className="ml-auto rounded-lg p-1.5 text-white/30 transition hover:bg-red-500/10 hover:text-red-300">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Weekly overview */}
                  {slots.length > 0 && (
                    <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">Resumen semanal</p>
                      <div className="grid grid-cols-7 gap-1">
                        {DAY_NAMES.map((name, d) => {
                          const daySlots = slots.filter((s) => s.day === d);
                          return (
                            <div key={d} className="text-center">
                              <p className={`text-[10px] font-medium ${daySlots.length > 0 ? "text-violet-300" : "text-white/20"}`}>{name}</p>
                              {daySlots.length > 0 ? daySlots.map((s, i) => <p key={i} className="mt-0.5 text-[9px] text-emerald-300">{s.from}-{s.to}</p>) : <p className="mt-0.5 text-[9px] text-white/10">—</p>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <button onClick={handleSaveConfig} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40">
                  {saving ? <Clock3 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {saving ? "Guardando..." : "Guardar"}
                </button>
                {saveMsg && <p className={`text-center text-xs ${saveMsg.includes("guardada") ? "text-emerald-300" : "text-red-300"}`}>{saveMsg}</p>}
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ── Client Dashboard ── */

function ClientDashboard({ me }: { me: any }) {
  const router = useRouter();
  const params = useSearchParams();
  const professionalId = params?.get("professional") || null;
  const myId = me?.user?.id;

  const [professionals, setProfessionals] = useState<ProfessionalCard[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Booking modal
  const [selectedPro, setSelectedPro] = useState<ProfessionalCard | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [duration, setDuration] = useState(10);
  const [scheduledAt, setScheduledAt] = useState("");
  const [bookLoading, setBookLoading] = useState(false);
  const [bookMsg, setBookMsg] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);
  const [bookedSlots, setBookedSlots] = useState<BookedSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"explore" | "bookings">(professionalId ? "explore" : "bookings");

  useEffect(() => {
    apiFetch<{ professionals: ProfessionalCard[] }>("/videocall/professionals")
      .then((r) => setProfessionals(r.professionals || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const loadBookings = useCallback(async () => {
    if (!myId) return;
    try {
      const res = await apiFetch<{ bookings: Booking[] }>("/videocall/bookings?role=client");
      setBookings(res.bookings || []);
    } catch {}
  }, [myId]);

  useEffect(() => {
    loadBookings();
    if (myId) apiFetch<{ balance: number }>("/wallet").then((w) => setWalletBalance(w.balance)).catch(() => {});
  }, [loadBookings, myId]);

  useEffect(() => {
    const interval = setInterval(loadBookings, 30000);
    return () => clearInterval(interval);
  }, [loadBookings]);

  useEffect(() => {
    if (professionalId && professionals.length > 0) {
      const pro = professionals.find((p) => p.id === professionalId);
      if (pro) openBookingModal(pro);
    }
  }, [professionalId, professionals]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return professionals;
    const q = searchTerm.toLowerCase();
    return professionals.filter((p) => (p.displayName || "").toLowerCase().includes(q) || (p.username || "").toLowerCase().includes(q));
  }, [professionals, searchTerm]);

  const openBookingModal = (pro: ProfessionalCard) => {
    setSelectedPro(pro);
    setDuration(pro.minDurationMin || 10);
    setScheduledAt(""); setSelectedDate(null); setSelectedTime(null); setBookMsg(""); setBookedSlots([]);
    apiFetch<{ config: Config }>(`/videocall/config/${pro.id}`).then((r) => { setConfig(r.config); setDuration(r.config.minDurationMin || 10); }).catch(() => setConfig(null));
    apiFetch<{ bookedSlots: BookedSlot[] }>(`/videocall/booked-slots/${pro.id}`).then((r) => setBookedSlots(r.bookedSlots || [])).catch(() => {});
  };

  const closeModal = () => {
    setSelectedPro(null); setConfig(null); setBookMsg(""); setSelectedDate(null); setSelectedTime(null); setBookedSlots([]);
    if (professionalId) router.replace("/videocall", { scroll: false });
  };

  const totalCost = config ? config.pricePerMinute * duration : selectedPro ? selectedPro.pricePerMinute * duration : 0;

  useEffect(() => {
    if (selectedDate && selectedTime) {
      const [h, m] = selectedTime.split(":").map(Number);
      const chile = getChileDateParts(selectedDate);
      setScheduledAt(new Date(chile.year, chile.month - 1, chile.day, h, m, 0, 0).toISOString());
    } else setScheduledAt("");
  }, [selectedDate, selectedTime]);

  const timeBlocks = useMemo(() => {
    if (!selectedDate) return [];
    const s = config?.availableSlots || selectedPro?.availableSlots || [];
    return generateTimeBlocks(selectedDate, Array.isArray(s) ? s : [], bookedSlots, duration);
  }, [selectedDate, config, selectedPro, bookedSlots, duration]);

  const availableDates = useMemo(() => {
    const s = config?.availableSlots || selectedPro?.availableSlots || [];
    return getAvailableDates(Array.isArray(s) ? s : [], 14);
  }, [config, selectedPro]);

  const handleBook = async () => {
    const proId = selectedPro?.id || professionalId;
    if (!proId || !scheduledAt) return;
    setBookLoading(true); setBookMsg("");
    try {
      await apiFetch("/videocall/book", { method: "POST", body: JSON.stringify({ professionalId: proId, scheduledAt, durationMinutes: duration }) });
      setBookMsg("Reserva confirmada");
      loadBookings();
      setTimeout(() => { closeModal(); setActiveTab("bookings"); }, 1200);
    } catch (e: unknown) {
      setBookMsg(e instanceof Error ? e.message : "Error al reservar");
    } finally { setBookLoading(false); }
  };

  const handleAction = async (bookingId: string, action: string) => {
    try {
      await apiFetch(`/videocall/${bookingId}/${action}`, { method: "POST" });
      loadBookings();
    } catch {}
  };

  const activeBookings = bookings.filter((b) => ["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(b.status));
  const pastBookings = bookings.filter((b) => !["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(b.status));
  const nextBooking = activeBookings[0];

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      <div className="mx-auto max-w-3xl px-4 py-6 pb-28">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/25">
              <Video className="h-6 w-6 text-violet-200" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Videollamadas</h1>
              <p className="text-xs text-white/40">Reserva llamadas privadas</p>
            </div>
          </div>
          {myId && (
            <Link href="/wallet" className="flex items-center gap-1.5 rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/10 px-3 py-2 text-xs font-medium text-fuchsia-300 transition hover:bg-fuchsia-500/15">
              <Wallet className="h-3.5 w-3.5" />
              {walletBalance} tokens
            </Link>
          )}
        </div>

        {/* Next booking banner */}
        {nextBooking && myId && <NextBookingBanner booking={nextBooking} myId={myId} isProfessional={false} />}

        {/* Tabs */}
        <div className="mb-5 flex gap-1.5 rounded-2xl bg-white/[0.04] p-1">
          {myId && (
            <button onClick={() => setActiveTab("bookings")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium transition ${activeTab === "bookings" ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/60"}`}>
              <CalendarDays className="h-3.5 w-3.5" />
              Mis Llamadas
              {activeBookings.length > 0 && <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-500 text-[9px] font-bold">{activeBookings.length}</span>}
            </button>
          )}
          <button onClick={() => setActiveTab("explore")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium transition ${activeTab === "explore" ? "bg-white/[0.1] text-white" : "text-white/40 hover:text-white/60"}`}>
            <Search className="h-3.5 w-3.5" /> Explorar
          </button>
        </div>

        {/* ── BOOKINGS ── */}
        {activeTab === "bookings" && myId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {activeBookings.length > 0 && (
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Próximas</h3>
                <div className="space-y-3">{activeBookings.map((b) => <BookingCard key={b.id} b={b} myId={myId} isProfessional={false} onAction={handleAction} />)}</div>
              </div>
            )}
            {pastBookings.length > 0 && (
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Historial</h3>
                <div className="space-y-2">
                  {pastBookings.slice(0, 20).map((b) => {
                    const other = b.professional;
                    const status = STATUS_UI[b.status] || { label: b.status, color: "text-white/60", bg: "border-white/20 bg-white/5" };
                    return (
                      <div key={b.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                        <div className="flex items-center gap-3">
                          {other.avatarUrl ? <img src={resolveMediaUrl(other.avatarUrl) ?? undefined} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10"><User className="h-4 w-4 text-white/30" /></div>}
                          <div>
                            <p className="text-xs font-medium">{other.displayName || other.username}</p>
                            <p className="text-[10px] text-white/30">{new Date(b.scheduledAt).toLocaleDateString("es-CL")} · {b.durationMinutes} min · {b.totalTokens} tokens</p>
                          </div>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-medium ${status.color} ${status.bg}`}>{status.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {bookings.length === 0 && (
              <div className="py-20 text-center">
                <Calendar className="mx-auto mb-4 h-12 w-12 text-white/15" />
                <p className="text-sm text-white/40">Sin videollamadas aún</p>
                <button onClick={() => setActiveTab("explore")} className="mt-4 flex items-center gap-1.5 mx-auto text-sm text-violet-400 hover:text-violet-300">
                  Explorar profesionales <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* ── EXPLORE ── */}
        {activeTab === "explore" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="relative mb-5">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input type="text" placeholder="Buscar profesional..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm outline-none placeholder:text-white/30 focus:border-violet-500/30 transition" />
            </div>

            {loading ? (
              <div className="grid gap-3 sm:grid-cols-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-48 animate-pulse rounded-2xl bg-white/[0.04]" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center">
                <Video className="mx-auto mb-4 h-12 w-12 text-white/15" />
                <p className="text-sm text-white/40">{searchTerm ? "Sin resultados." : "No hay profesionales disponibles."}</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {filtered.map((pro) => (
                  <motion.button
                    key={pro.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => {
                      if (!myId) { router.push(`/login?next=${encodeURIComponent(`/videocall?professional=${pro.id}`)}`); return; }
                      openBookingModal(pro);
                    }}
                    className="group text-left overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] transition hover:border-violet-500/20 hover:bg-white/[0.05]"
                  >
                    {/* Cover */}
                    <div className="relative h-24 overflow-hidden bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10">
                      {pro.coverUrl && <img src={resolveMediaUrl(pro.coverUrl) ?? undefined} alt="" className="h-full w-full object-cover opacity-50 transition group-hover:opacity-70 group-hover:scale-105" />}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0b14] via-transparent to-transparent" />
                      <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-violet-400/30 bg-[#0a0b14]/80 px-2.5 py-1 backdrop-blur">
                        <Coins className="h-3 w-3 text-violet-300" />
                        <span className="text-xs font-bold text-violet-200">{pro.pricePerMinute}</span>
                        <span className="text-[9px] text-white/40">/min</span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="relative px-4 pb-4 pt-8">
                      {/* Avatar */}
                      <div className="absolute -top-6 left-4">
                        {pro.avatarUrl ? (
                          <img src={resolveMediaUrl(pro.avatarUrl) ?? undefined} alt="" className="h-12 w-12 rounded-xl border-2 border-[#0a0b14] object-cover shadow-lg" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl border-2 border-[#0a0b14] bg-violet-500/20 shadow-lg"><User className="h-5 w-5 text-violet-300" /></div>
                        )}
                      </div>

                      <h3 className="text-sm font-semibold">{pro.displayName || pro.username}</h3>
                      <p className="text-[10px] text-white/35">@{pro.username} · {pro.minDurationMin}-{pro.maxDurationMin} min</p>

                      {Array.isArray(pro.availableSlots) && pro.availableSlots.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {pro.availableSlots.slice(0, 3).map((slot, idx) => (
                            <span key={`${slot.day}-${idx}`} className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[8px] text-white/35">
                              {DAY_NAMES[slot.day]} {slot.from}-{slot.to}
                            </span>
                          ))}
                          {pro.availableSlots.length > 3 && <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[8px] text-white/35">+{pro.availableSlots.length - 3}</span>}
                        </div>
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* ── BOOKING MODAL ── */}
      <AnimatePresence>
        {selectedPro && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
            <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#12131f] p-6 shadow-2xl sm:rounded-3xl">
              <button onClick={closeModal} className="absolute right-4 top-4 rounded-full p-1.5 text-white/40 hover:bg-white/10"><X className="h-4 w-4" /></button>

              {/* Professional info */}
              <div className="mb-5 flex items-center gap-3">
                {selectedPro.avatarUrl ? <img src={resolveMediaUrl(selectedPro.avatarUrl) ?? undefined} alt="" className="h-14 w-14 rounded-2xl object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/20"><User className="h-7 w-7 text-violet-300" /></div>}
                <div>
                  <p className="text-base font-semibold">{selectedPro.displayName || selectedPro.username}</p>
                  <div className="flex items-center gap-1 text-xs text-violet-300"><Coins className="h-3 w-3" /> {selectedPro.pricePerMinute} tokens/min</div>
                </div>
              </div>

              {/* Step 1: Duration */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-300">1</div>
                  <label className="text-xs font-medium text-white/60">Duración: <span className="text-white font-semibold">{duration} min</span></label>
                </div>
                <input type="range" min={config?.minDurationMin || selectedPro.minDurationMin} max={config?.maxDurationMin || selectedPro.maxDurationMin} step={5} value={duration} onChange={(e) => { setDuration(Number(e.target.value)); setSelectedTime(null); }} className="w-full accent-violet-500" />
                <div className="flex justify-between text-[10px] text-white/25">
                  <span>{config?.minDurationMin || selectedPro.minDurationMin} min</span>
                  <span>{config?.maxDurationMin || selectedPro.maxDurationMin} min</span>
                </div>
              </div>

              {/* Step 2: Date */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-300">2</div>
                  <label className="text-xs font-medium text-white/60">Selecciona día</label>
                </div>
                {availableDates.length === 0 ? (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center text-xs text-white/30">Sin horarios disponibles</div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {availableDates.map((d) => {
                      const isSelected = selectedDate ? getChileDateKey(selectedDate) === getChileDateKey(d) : false;
                      const isToday = getChileDateKey(d) === getChileDateKey(new Date());
                      const chile = getChileDateParts(d);
                      return (
                        <button key={d.toISOString()} onClick={() => { setSelectedDate(d); setSelectedTime(null); }} className={`flex shrink-0 flex-col items-center rounded-xl px-3 py-2 transition ${isSelected ? "border border-violet-500/40 bg-violet-500/20 text-violet-200" : "border border-white/[0.06] bg-white/[0.02] text-white/60 hover:bg-white/[0.06]"}`}>
                          <span className="text-[10px] uppercase">{DAY_NAMES[chile.weekday]}</span>
                          <span className="text-lg font-bold leading-tight">{chile.day}</span>
                          <span className="text-[9px]">{isToday ? "Hoy" : formatChileDate(d, { month: "short" })}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step 3: Time */}
              {selectedDate && (
                <div className="mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-300">3</div>
                    <label className="text-xs font-medium text-white/60">Selecciona hora</label>
                  </div>
                  {timeBlocks.length === 0 ? (
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center text-xs text-white/30">Sin horarios disponibles</div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                      {timeBlocks.map((block) => (
                        <button key={block.time} onClick={() => !block.booked && setSelectedTime(block.time)} disabled={block.booked} className={`relative rounded-xl py-2.5 text-center text-xs font-medium transition ${block.booked ? "border border-red-500/15 bg-red-500/5 text-white/20 line-through cursor-not-allowed" : selectedTime === block.time ? "border border-violet-500/40 bg-violet-500/20 text-violet-200" : "border border-white/[0.08] bg-white/[0.03] text-white/70 hover:bg-white/[0.06]"}`}>
                          {block.time}
                          {block.booked && <Lock className="absolute right-1 top-1 h-2.5 w-2.5 text-red-400/50" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Summary & Book */}
              {selectedTime && (
                <>
                  <div className="mb-4 flex items-center justify-between rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                    <div>
                      <p className="text-xs text-white/60">Total</p>
                      <p className="text-[10px] text-white/30">
                        {selectedDate ? formatChileDate(selectedDate, { weekday: "short", day: "numeric", month: "short" }) : ""} {selectedTime} · {duration} min
                      </p>
                    </div>
                    <span className="text-2xl font-bold text-violet-300">{totalCost} <span className="text-sm font-normal text-white/40">tokens</span></span>
                  </div>

                  {walletBalance < totalCost && (
                    <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Saldo insuficiente ({walletBalance} tokens). <Link href="/wallet" className="underline font-medium">Recargar</Link>
                    </div>
                  )}

                  <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-white/40">
                    La sala se abre 5 min antes. Los tokens se retienen hasta que finalice la llamada.
                  </div>

                  <button onClick={handleBook} disabled={bookLoading || !scheduledAt || walletBalance < totalCost} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40">
                    {bookLoading ? <Clock3 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    {bookLoading ? "Reservando..." : "Confirmar Reserva"}
                  </button>
                </>
              )}

              {bookMsg && (
                <p className={`mt-3 text-center text-xs ${bookMsg.includes("confirmada") ? "text-emerald-300" : "text-red-300"}`}>
                  {bookMsg}
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main ── */

function VideocallPageContent() {
  const { me } = useMe();
  if (me?.user?.profileType === "PROFESSIONAL") return <ProfessionalDashboard me={me} />;
  return <ClientDashboard me={me} />;
}

export default function VideocallPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0b14]" />}>
      <VideocallPageContent />
    </Suspense>
  );
}

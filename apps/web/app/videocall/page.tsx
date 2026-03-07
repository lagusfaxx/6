"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import useMe from "../../hooks/useMe";
import {
  Video,
  Calendar,
  Coins,
  XCircle,
  AlertTriangle,
  Phone,
  User,
  Clock3,
  Search,
  Star,
  ArrowRight,
  X,
  Play,
  PhoneOff,
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

type AvailabilitySlot = {
  day: number;
  from: string;
  to: string;
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

type Config = {
  id: string;
  pricePerMinute: number;
  minDurationMin: number;
  maxDurationMin: number;
  availableSlots: AvailabilitySlot[] | null;
  isActive: boolean;
  professional: { id: string; displayName: string; username: string; avatarUrl: string | null };
};

const STATUS_UI: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pendiente", color: "text-amber-300 border-amber-500/30 bg-amber-500/10" },
  CONFIRMED: { label: "Confirmada", color: "text-blue-300 border-blue-500/30 bg-blue-500/10" },
  IN_PROGRESS: { label: "En curso", color: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10" },
  COMPLETED: { label: "Completada", color: "text-white/70 border-white/20 bg-white/5" },
  CANCELLED_CLIENT: { label: "Cancelada", color: "text-red-300 border-red-500/30 bg-red-500/10" },
  NO_SHOW_PROFESSIONAL: { label: "No-show", color: "text-red-300 border-red-500/30 bg-red-500/10" },
};

const DAY_NAMES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/* ── Main component ── */

function VideocallPageContent() {
  const { me } = useMe();
  const params = useSearchParams();
  const router = useRouter();
  const professionalId = params?.get("professional") || null;

  const [professionals, setProfessionals] = useState<ProfessionalCard[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  // Booking modal state
  const [selectedPro, setSelectedPro] = useState<ProfessionalCard | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [duration, setDuration] = useState(10);
  const [scheduledAt, setScheduledAt] = useState("");
  const [bookLoading, setBookLoading] = useState(false);
  const [bookMsg, setBookMsg] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);

  const [activeTab, setActiveTab] = useState<"explore" | "bookings">(professionalId ? "explore" : "explore");

  const isProfessional = me?.user?.profileType === "PROFESSIONAL";
  const myId = me?.user?.id;
  const isAuthed = Boolean(myId);

  // Load professionals
  useEffect(() => {
    apiFetch<{ professionals: ProfessionalCard[] }>("/videocall/professionals")
      .then((r) => setProfessionals(r.professionals || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Load bookings
  const loadBookings = useCallback(async () => {
    if (!isAuthed) return;
    try {
      const role = isProfessional ? "professional" : "client";
      const res = await apiFetch<{ bookings: Booking[] }>(`/videocall/bookings?role=${role}`);
      setBookings(res.bookings || []);
    } catch {}
  }, [isProfessional, isAuthed]);

  useEffect(() => {
    loadBookings();
    if (isAuthed) {
      apiFetch<{ balance: number }>("/wallet")
        .then((w) => setWalletBalance(w.balance))
        .catch(() => {});
    }
  }, [loadBookings, isAuthed]);

  // Auto-open booking modal if ?professional= in URL
  useEffect(() => {
    if (professionalId && professionals.length > 0) {
      const pro = professionals.find((p) => p.id === professionalId);
      if (pro) openBookingModal(pro);
    }
  }, [professionalId, professionals]);

  // Filtered professionals
  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return professionals;
    const q = searchTerm.toLowerCase();
    return professionals.filter(
      (p) =>
        (p.displayName || "").toLowerCase().includes(q) ||
        (p.username || "").toLowerCase().includes(q),
    );
  }, [professionals, searchTerm]);

  // Open booking modal for a professional
  const openBookingModal = (pro: ProfessionalCard) => {
    setSelectedPro(pro);
    setDuration(pro.minDurationMin || 10);
    setScheduledAt("");
    setBookMsg("");
    // Load full config
    apiFetch<{ config: Config }>(`/videocall/config/${pro.id}`)
      .then((r) => {
        setConfig(r.config);
        setDuration(r.config.minDurationMin || 10);
      })
      .catch(() => setConfig(null));
  };

  const closeModal = () => {
    setSelectedPro(null);
    setConfig(null);
    setBookMsg("");
    // Clean URL param
    if (professionalId) {
      router.replace("/videocall", { scroll: false });
    }
  };

  const totalCost = config ? config.pricePerMinute * duration : selectedPro ? selectedPro.pricePerMinute * duration : 0;

  const bookingValidationMsg = useMemo(() => {
    const slots = config?.availableSlots || selectedPro?.availableSlots;
    if (!scheduledAt || !slots) return "";
    const date = new Date(scheduledAt);
    if (Number.isNaN(date.getTime())) return "Fecha inválida.";
    const arr = Array.isArray(slots) ? slots : [];
    if (!arr.length) return "";
    const day = date.getDay();
    const start = date.getHours() * 60 + date.getMinutes();
    const end = start + duration;
    const inSlot = arr.some((slot) => {
      if (slot.day !== day) return false;
      const [fh, fm] = slot.from.split(":").map(Number);
      const [th, tm] = slot.to.split(":").map(Number);
      return start >= fh * 60 + fm && end <= th * 60 + tm;
    });
    return inSlot ? "" : "Hora fuera de disponibilidad.";
  }, [config, selectedPro, scheduledAt, duration]);

  const handleBook = async () => {
    const proId = selectedPro?.id || professionalId;
    if (!proId || !scheduledAt || bookingValidationMsg) return;
    setBookLoading(true);
    setBookMsg("");
    try {
      await apiFetch("/videocall/book", {
        method: "POST",
        body: JSON.stringify({ professionalId: proId, scheduledAt, durationMinutes: duration }),
      });
      setBookMsg("Videollamada reservada correctamente.");
      loadBookings();
      setTimeout(() => {
        closeModal();
        setActiveTab("bookings");
      }, 1500);
    } catch (e: unknown) {
      setBookMsg(e instanceof Error ? e.message : "Error al reservar");
    } finally {
      setBookLoading(false);
    }
  };

  const handleAction = async (bookingId: string, action: string) => {
    try {
      await apiFetch(`/videocall/${bookingId}/${action}`, { method: "POST" });
      loadBookings();
    } catch {}
  };

  const activeBookings = bookings.filter((b) => ["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(b.status));
  const pastBookings = bookings.filter((b) => !["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(b.status));

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      <div className="mx-auto max-w-5xl px-4 py-6 pb-28">
        {/* Hero */}
        <div className="mb-8 overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 via-fuchsia-600/5 to-transparent p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 backdrop-blur">
              <Video className="h-7 w-7 text-violet-200" />
            </div>
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">Videollamadas Privadas</h1>
              <p className="mt-1 text-sm text-white/50">
                Conecta con profesionales en videollamadas privadas. Pago seguro con tokens.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex items-center gap-3">
          <button
            onClick={() => setActiveTab("explore")}
            className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${
              activeTab === "explore"
                ? "bg-violet-500/20 text-violet-200 border border-violet-500/30"
                : "text-white/50 hover:text-white/70 border border-transparent"
            }`}
          >
            Explorar
          </button>
          {isAuthed && (
            <button
              onClick={() => setActiveTab("bookings")}
              className={`relative rounded-full px-5 py-2.5 text-sm font-medium transition ${
                activeTab === "bookings"
                  ? "bg-violet-500/20 text-violet-200 border border-violet-500/30"
                  : "text-white/50 hover:text-white/70 border border-transparent"
              }`}
            >
              Mis Reservas
              {activeBookings.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-violet-500 text-[10px] font-bold">
                  {activeBookings.length}
                </span>
              )}
            </button>
          )}
        </div>

        {/* ── EXPLORE TAB ── */}
        {activeTab === "explore" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                type="text"
                placeholder="Buscar profesional..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-11 pr-4 text-sm outline-none placeholder:text-white/30 focus:border-violet-500/30"
              />
            </div>

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-64 animate-pulse rounded-2xl bg-white/[0.04]" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-20 text-center">
                <Video className="mx-auto mb-4 h-12 w-12 text-white/15" />
                <p className="text-sm text-white/40">
                  {searchTerm ? "Sin resultados para tu búsqueda." : "No hay profesionales con videollamadas activas."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((pro) => (
                  <motion.div
                    key={pro.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] transition hover:border-violet-500/20 hover:bg-white/[0.05]"
                  >
                    {/* Cover / gradient */}
                    <div className="relative h-32 overflow-hidden bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10">
                      {pro.coverUrl && (
                        <img
                          src={resolveMediaUrl(pro.coverUrl) ?? undefined}
                          alt=""
                          className="h-full w-full object-cover opacity-60 transition group-hover:opacity-80"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0b14] via-transparent to-transparent" />
                      {/* Price badge */}
                      <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-violet-400/30 bg-[#0a0b14]/80 px-2.5 py-1 backdrop-blur">
                        <Coins className="h-3 w-3 text-violet-300" />
                        <span className="text-xs font-semibold text-violet-200">{pro.pricePerMinute}</span>
                        <span className="text-[10px] text-white/40">/min</span>
                      </div>
                    </div>

                    {/* Avatar */}
                    <div className="absolute left-4 top-[88px]">
                      {pro.avatarUrl ? (
                        <img
                          src={resolveMediaUrl(pro.avatarUrl) ?? undefined}
                          alt=""
                          className="h-16 w-16 rounded-2xl border-2 border-[#0a0b14] object-cover shadow-lg"
                        />
                      ) : (
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-[#0a0b14] bg-violet-500/20 shadow-lg">
                          <User className="h-7 w-7 text-violet-300" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="px-4 pb-4 pt-10">
                      <h3 className="text-sm font-semibold">{pro.displayName || pro.username}</h3>
                      <p className="text-[11px] text-white/40">@{pro.username}</p>

                      {/* Availability pills */}
                      {Array.isArray(pro.availableSlots) && pro.availableSlots.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {pro.availableSlots.slice(0, 3).map((slot, idx) => (
                            <span
                              key={`${slot.day}-${idx}`}
                              className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] text-white/40"
                            >
                              {DAY_NAMES[slot.day]} {slot.from}-{slot.to}
                            </span>
                          ))}
                          {pro.availableSlots.length > 3 && (
                            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] text-white/40">
                              +{pro.availableSlots.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Duration range */}
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[10px] text-white/30">
                          {pro.minDurationMin}-{pro.maxDurationMin} min
                        </span>
                        <button
                          onClick={() => {
                            if (!isAuthed) {
                              router.push(`/login?next=${encodeURIComponent(`/videocall?professional=${pro.id}`)}`);
                              return;
                            }
                            openBookingModal(pro);
                          }}
                          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2 text-xs font-semibold transition hover:opacity-90"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          Agendar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── BOOKINGS TAB ── */}
        {activeTab === "bookings" && isAuthed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* Active bookings */}
            {activeBookings.length > 0 && (
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Próximas</h3>
                <div className="space-y-3">
                  {activeBookings.map((b) => {
                    const other = myId === b.client.id ? b.professional : b.client;
                    const scheduled = new Date(b.scheduledAt);
                    const now = Date.now();
                    const roomOpensAt = scheduled.getTime() - 5 * 60 * 1000;
                    const canJoin = now >= roomOpensAt && now <= scheduled.getTime() + 10 * 60 * 1000;
                    const status = STATUS_UI[b.status] || { label: b.status, color: "text-white/60 border-white/20 bg-white/5" };

                    // Time until room opens
                    const msUntilRoom = roomOpensAt - now;
                    const minsUntilRoom = Math.ceil(msUntilRoom / 60000);

                    return (
                      <div key={b.id} className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
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
                                  {" "}
                                  {scheduled.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                                  {" · "}
                                  {b.durationMinutes} min · {b.totalTokens} tokens
                                </p>
                              </div>
                            </div>
                            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${status.color}`}>
                              {status.label}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {b.status === "IN_PROGRESS" && (
                              <Link
                                href={`/videocall/room/${b.id}`}
                                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-semibold shadow-lg shadow-emerald-500/20"
                              >
                                <Phone className="h-3.5 w-3.5" />
                                Unirse a la llamada
                              </Link>
                            )}

                            {(b.status === "PENDING" || b.status === "CONFIRMED") && canJoin && (
                              <Link
                                href={`/videocall/room/${b.id}`}
                                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-2.5 text-xs font-semibold shadow-lg shadow-violet-500/20"
                              >
                                <Play className="h-3.5 w-3.5" />
                                Entrar a la sala
                              </Link>
                            )}

                            {(b.status === "PENDING" || b.status === "CONFIRMED") && !canJoin && msUntilRoom > 0 && (
                              <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs text-white/50">
                                <Clock3 className="h-3.5 w-3.5" />
                                Sala abre en {minsUntilRoom > 60 ? `${Math.floor(minsUntilRoom / 60)}h ${minsUntilRoom % 60}m` : `${minsUntilRoom} min`}
                              </div>
                            )}

                            {!isProfessional && (b.status === "PENDING" || b.status === "CONFIRMED") && (
                              <button
                                onClick={() => handleAction(b.id, "cancel")}
                                className="flex items-center gap-1 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs font-medium text-red-300 transition hover:bg-red-500/10"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Cancelar
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Past bookings */}
            {pastBookings.length > 0 && (
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">Historial</h3>
                <div className="space-y-2">
                  {pastBookings.map((b) => {
                    const other = myId === b.client.id ? b.professional : b.client;
                    const scheduled = new Date(b.scheduledAt);
                    const status = STATUS_UI[b.status] || { label: b.status, color: "text-white/60 border-white/20 bg-white/5" };

                    return (
                      <div key={b.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {other.avatarUrl ? (
                              <img src={resolveMediaUrl(other.avatarUrl) ?? undefined} alt="" className="h-9 w-9 rounded-lg object-cover" />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                                <User className="h-4 w-4 text-white/30" />
                              </div>
                            )}
                            <div>
                              <p className="text-xs font-medium">{other.displayName || other.username}</p>
                              <p className="text-[10px] text-white/30">
                                {scheduled.toLocaleDateString("es-CL")} · {b.durationMinutes} min · {b.totalTokens} tokens
                              </p>
                            </div>
                          </div>
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-medium ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
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
                <button
                  onClick={() => setActiveTab("explore")}
                  className="mt-4 text-sm text-violet-400 hover:text-violet-300"
                >
                  Explorar profesionales
                </button>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* ── BOOKING MODAL ── */}
      <AnimatePresence>
        {selectedPro && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
            onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="relative w-full max-w-md rounded-t-3xl border border-white/10 bg-[#12131f] p-6 shadow-2xl sm:rounded-3xl"
            >
              {/* Close button */}
              <button
                onClick={closeModal}
                className="absolute right-4 top-4 rounded-full p-1.5 text-white/40 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Professional info */}
              <div className="mb-5 flex items-center gap-3">
                {selectedPro.avatarUrl ? (
                  <img src={resolveMediaUrl(selectedPro.avatarUrl) ?? undefined} alt="" className="h-14 w-14 rounded-2xl object-cover" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/20">
                    <User className="h-7 w-7 text-violet-300" />
                  </div>
                )}
                <div>
                  <p className="text-base font-semibold">{selectedPro.displayName || selectedPro.username}</p>
                  <div className="flex items-center gap-1 text-xs text-violet-300">
                    <Coins className="h-3 w-3" />
                    {selectedPro.pricePerMinute} tokens/min
                  </div>
                </div>
              </div>

              {/* Availability */}
              {config && Array.isArray(config.availableSlots) && config.availableSlots.length > 0 && (
                <div className="mb-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                  <p className="mb-2 text-[11px] font-medium text-white/50">Disponibilidad</p>
                  <div className="flex flex-wrap gap-1.5">
                    {config.availableSlots.map((slot, idx) => (
                      <span
                        key={`${slot.day}-${idx}`}
                        className="rounded-full border border-violet-400/20 bg-violet-500/10 px-2 py-0.5 text-[10px] text-violet-200"
                      >
                        {DAY_NAMES[slot.day]} {slot.from}-{slot.to}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Date picker */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs text-white/50">Fecha y hora</label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-violet-500/30"
                />
              </div>

              {/* Duration slider */}
              <div className="mb-4">
                <label className="mb-1.5 block text-xs text-white/50">
                  Duración: <span className="font-semibold text-white/80">{duration} min</span>
                </label>
                <input
                  type="range"
                  min={config?.minDurationMin || selectedPro.minDurationMin}
                  max={config?.maxDurationMin || selectedPro.maxDurationMin}
                  step={5}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-[10px] text-white/25">
                  <span>{config?.minDurationMin || selectedPro.minDurationMin} min</span>
                  <span>{config?.maxDurationMin || selectedPro.maxDurationMin} min</span>
                </div>
              </div>

              {/* Cost */}
              <div className="mb-4 flex items-center justify-between rounded-xl border border-violet-500/20 bg-violet-500/5 p-3">
                <span className="text-sm text-white/60">Costo total</span>
                <span className="text-lg font-bold text-violet-300">{totalCost} tokens</span>
              </div>

              {/* Validation messages */}
              {bookingValidationMsg && (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
                  <Clock3 className="h-4 w-4 shrink-0" />
                  {bookingValidationMsg}
                </div>
              )}

              {walletBalance < totalCost && (
                <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Saldo insuficiente ({walletBalance} tokens).{" "}
                  <Link href="/wallet" className="underline">Cargar</Link>
                </div>
              )}

              {/* Info box */}
              <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] text-white/40">
                <p>La sala se abre 5 minutos antes de la hora agendada. Los tokens se retienen de forma segura hasta que la llamada finalice.</p>
              </div>

              {/* Book button */}
              <button
                onClick={handleBook}
                disabled={bookLoading || !scheduledAt || walletBalance < totalCost || Boolean(bookingValidationMsg)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
              >
                <Calendar className="h-4 w-4" />
                {bookLoading ? "Reservando..." : "Confirmar Reserva"}
              </button>

              {bookMsg && (
                <p className={`mt-3 text-center text-xs ${bookMsg.includes("correctamente") ? "text-emerald-300" : "text-red-300"}`}>
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

export default function VideocallPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0b14]" />}>
      <VideocallPageContent />
    </Suspense>
  );
}

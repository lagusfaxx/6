"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { apiFetch, resolveMediaUrl } from "../../lib/api";
import useMe from "../../hooks/useMe";
import {
  Video, Calendar, Clock, Coins, ArrowRight, Play, XCircle,
  AlertTriangle, CheckCircle2, Phone, PhoneOff, User,
} from "lucide-react";

type Config = {
  id: string;
  pricePerMinute: number;
  minDurationMin: number;
  maxDurationMin: number;
  availableSlots: any;
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

const statusColors: Record<string, string> = {
  PENDING: "text-amber-400 border-amber-500/20 bg-amber-500/10",
  CONFIRMED: "text-blue-400 border-blue-500/20 bg-blue-500/10",
  IN_PROGRESS: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
  COMPLETED: "text-white/50 border-white/10 bg-white/5",
  CANCELLED_CLIENT: "text-red-400 border-red-500/20 bg-red-500/10",
  NO_SHOW_PROFESSIONAL: "text-red-400 border-red-500/20 bg-red-500/10",
};

const statusLabels: Record<string, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
  CANCELLED_CLIENT: "Cancelada",
  NO_SHOW_PROFESSIONAL: "No-show",
};

function VideocallPageContent() {
  const { me } = useMe();
  const params = useSearchParams();
  const professionalId = params?.get("professional") || null;

  const [config, setConfig] = useState<Config | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [tab, setTab] = useState<"book" | "my">(professionalId ? "book" : "my");

  // Booking form
  const [duration, setDuration] = useState(10);
  const [scheduledAt, setScheduledAt] = useState("");
  const [bookLoading, setBookLoading] = useState(false);
  const [bookMsg, setBookMsg] = useState("");
  const [walletBalance, setWalletBalance] = useState(0);

  // Professional config form
  const [myConfig, setMyConfig] = useState<any>(null);
  const [configPrice, setConfigPrice] = useState("10");
  const [configMin, setConfigMin] = useState("5");
  const [configMax, setConfigMax] = useState("60");
  const [configActive, setConfigActive] = useState(true);
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
    apiFetch<{ balance: number }>("/wallet").then((w) => setWalletBalance(w.balance)).catch(() => {});
  }, [loadBookings]);

  useEffect(() => {
    if (professionalId) {
      apiFetch<{ config: Config }>(`/videocall/config/${professionalId}`).then((r) => setConfig(r.config)).catch(() => setConfig(null));
    }
  }, [professionalId]);

  useEffect(() => {
    if (isProfessional) {
      apiFetch<{ config: any }>(`/videocall/config/${myId}`).then((r) => {
        if (r.config) {
          setMyConfig(r.config);
          setConfigPrice(String(r.config.pricePerMinute));
          setConfigMin(String(r.config.minDurationMin));
          setConfigMax(String(r.config.maxDurationMin));
          setConfigActive(r.config.isActive);
        }
      }).catch(() => {});
    }
  }, [isProfessional, myId]);

  const totalCost = config ? config.pricePerMinute * duration : 0;

  const handleBook = async () => {
    if (!professionalId || !scheduledAt) return;
    setBookLoading(true);
    setBookMsg("");
    try {
      await apiFetch("/videocall/book", {
        method: "POST",
        body: JSON.stringify({ professionalId, scheduledAt, durationMinutes: duration }),
      });
      setBookMsg("Videollamada reservada exitosamente.");
      loadBookings();
      setTab("my");
    } catch (e: any) {
      setBookMsg(e?.message || "Error al reservar");
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
          isActive: configActive,
        }),
      });
    } catch {} finally { setConfigSaving(false); }
  };

  const handleAction = async (bookingId: string, action: string) => {
    try {
      await apiFetch(`/videocall/${bookingId}/${action}`, { method: "POST" });
      loadBookings();
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#0a0b14] text-white">
      <div className="mx-auto max-w-2xl px-4 py-8 pb-28">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20">
            <Video className="h-5 w-5 text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold">Videollamadas</h1>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          {professionalId && <button onClick={() => setTab("book")} className={`rounded-full border px-4 py-2 text-xs font-medium ${tab === "book" ? "border-violet-500/30 bg-violet-500/15 text-violet-300" : "border-white/10 text-white/50"}`}>Reservar</button>}
          <button onClick={() => setTab("my")} className={`rounded-full border px-4 py-2 text-xs font-medium ${tab === "my" ? "border-violet-500/30 bg-violet-500/15 text-violet-300" : "border-white/10 text-white/50"}`}>Mis Videollamadas</button>
        </div>

        {/* ── Book Tab ── */}
        {tab === "book" && config && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="rounded-2xl border border-violet-500/15 bg-white/[0.03] p-5">
              <div className="mb-4 flex items-center gap-3">
                {config.professional.avatarUrl ? (
                  <img src={resolveMediaUrl(config.professional.avatarUrl) ?? undefined} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10"><User className="h-6 w-6 text-white/30" /></div>
                )}
                <div>
                  <p className="text-sm font-semibold">{config.professional.displayName || config.professional.username}</p>
                  <p className="text-xs text-violet-300">{config.pricePerMinute} tokens/min</p>
                </div>
              </div>

              <label className="mb-1 block text-xs text-white/50">Fecha y hora</label>
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="mb-4 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none focus:border-violet-500/30" />

              <label className="mb-1 block text-xs text-white/50">Duración: {duration} min</label>
              <input type="range" min={config.minDurationMin} max={config.maxDurationMin} step={5} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="mb-2 w-full accent-violet-500" />
              <div className="mb-4 flex justify-between text-[10px] text-white/30">
                <span>{config.minDurationMin} min</span>
                <span>{config.maxDurationMin} min</span>
              </div>

              <div className="mb-4 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 flex items-center justify-between">
                <span className="text-sm text-white/60">Costo total</span>
                <span className="text-lg font-bold text-violet-300">{totalCost} tokens</span>
              </div>

              {walletBalance < totalCost && (
                <div className="mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 flex items-center gap-2 text-xs text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Saldo insuficiente ({walletBalance} tokens). <Link href="/wallet" className="underline">Cargar tokens</Link>
                </div>
              )}

              <button onClick={handleBook} disabled={bookLoading || !scheduledAt || walletBalance < totalCost} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 text-sm font-semibold disabled:opacity-50">
                <Calendar className="h-4 w-4" /> {bookLoading ? "Reservando..." : "Reservar Videollamada"}
              </button>
              {bookMsg && <p className="mt-2 text-center text-xs text-violet-300">{bookMsg}</p>}
            </div>
          </motion.div>
        )}

        {/* ── My Bookings Tab ── */}
        {tab === "my" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Professional config panel */}
            {isProfessional && (
              <div className="rounded-2xl border border-violet-500/15 bg-white/[0.03] p-4 mb-4">
                <h3 className="mb-3 text-sm font-semibold flex items-center gap-2"><Video className="h-4 w-4 text-violet-400" /> Mi configuración de videollamadas</h3>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-[10px] text-white/40 mb-1">Precio/min (tokens)</label>
                    <input type="number" value={configPrice} onChange={(e) => setConfigPrice(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-white/40 mb-1">Mín (min)</label>
                    <input type="number" value={configMin} onChange={(e) => setConfigMin(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-white/40 mb-1">Máx (min)</label>
                    <input type="number" value={configMax} onChange={(e) => setConfigMax(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs outline-none" />
                  </div>
                </div>
                <label className="flex items-center gap-2 mb-3 text-xs text-white/60">
                  <input type="checkbox" checked={configActive} onChange={(e) => setConfigActive(e.target.checked)} className="accent-violet-500" />
                  Videollamadas activas
                </label>
                <button onClick={handleSaveConfig} disabled={configSaving} className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium">{configSaving ? "Guardando..." : "Guardar"}</button>
              </div>
            )}

            {bookings.length === 0 ? (
              <div className="py-12 text-center text-white/30 text-sm">Sin videollamadas agendadas</div>
            ) : (
              bookings.map((b) => {
                const other = myId === b.client.id ? b.professional : b.client;
                const scheduled = new Date(b.scheduledAt);
                const isNow = Math.abs(Date.now() - scheduled.getTime()) < 15 * 60 * 1000;
                return (
                  <div key={b.id} className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {other.avatarUrl ? (
                          <img src={resolveMediaUrl(other.avatarUrl) ?? undefined} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10"><User className="h-5 w-5 text-white/30" /></div>
                        )}
                        <div>
                          <p className="text-sm font-semibold">{other.displayName || other.username}</p>
                          <p className="text-[10px] text-white/40">
                            <Calendar className="mr-0.5 inline h-3 w-3" />
                            {scheduled.toLocaleDateString("es-CL")} {scheduled.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}
                            {" · "}{b.durationMinutes} min · {b.totalTokens} tokens
                          </p>
                        </div>
                      </div>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColors[b.status] || ""}`}>
                        {statusLabels[b.status] || b.status}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-3 flex gap-2">
                      {isProfessional && (b.status === "PENDING" || b.status === "CONFIRMED") && isNow && (
                        <Link href={`/videocall/room/${b.id}`} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium">
                          <Play className="h-3.5 w-3.5" /> Entrar a la Sala
                        </Link>
                      )}
                      {b.status === "IN_PROGRESS" && (
                        <Link href={`/videocall/room/${b.id}`} className="flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-medium">
                          <Phone className="h-3.5 w-3.5" /> Unirse a la Llamada
                        </Link>
                      )}
                      {!isProfessional && (b.status === "PENDING" || b.status === "CONFIRMED") && (
                        <>
                          <button onClick={() => handleAction(b.id, "cancel")} className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300">
                            <XCircle className="h-3.5 w-3.5" /> Cancelar
                          </button>
                          {isNow && (
                            <button onClick={() => handleAction(b.id, "noshow")} className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300">
                              <AlertTriangle className="h-3.5 w-3.5" /> Reportar No-show
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

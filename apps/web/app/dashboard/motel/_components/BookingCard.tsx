"use client";

import Link from "next/link";
import { useState } from "react";
import { BedDouble, Clock, MessageCircle, Trash2 } from "lucide-react";
import { formatClp } from "../../../../components/business/ui";
import { DURATION, STATUS, dayLabel, timeLabel, type Booking } from "./types";

const REASONS: Array<{ key: "SIN_HABITACIONES" | "CERRADO" | "OTRO"; label: string }> = [
  { key: "SIN_HABITACIONES", label: "Sin habitaciones" },
  { key: "CERRADO", label: "Local cerrado" },
  { key: "OTRO", label: "Otro motivo" },
];

export type BookingAction =
  | { type: "ACCEPT" }
  | { type: "FINISH" }
  | { type: "DELETE" }
  | { type: "REJECT"; reason: "SIN_HABITACIONES" | "CERRADO" | "OTRO"; note?: string };

export default function BookingCard({
  booking: b,
  busy,
  onAction,
}: {
  booking: Booking;
  busy: boolean;
  onAction: (b: Booking, action: BookingAction) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<"SIN_HABITACIONES" | "CERRADO" | "OTRO">("SIN_HABITACIONES");
  const [note, setNote] = useState("");
  const st = STATUS[b.status] || STATUS.PENDIENTE;
  const closed = ["RECHAZADA", "FINALIZADA", "CANCELADA"].includes(b.status);
  const discounted = b.basePriceClp && Number(b.basePriceClp) > Number(b.priceClp);

  return (
    <article className={`editor-card p-4 ${closed ? "opacity-70" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="flex w-14 shrink-0 flex-col items-center rounded-xl border border-white/10 bg-white/[0.03] py-2 text-center">
          <span className="text-[10px] uppercase text-white/40">{dayLabel(b.startAt).slice(0, 3)}</span>
          <span className="text-sm font-bold tabular-nums">{b.startAt ? timeLabel(b.startAt) : "—"}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold">{b.clientName || b.clientUsername || "Cliente"}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${st.className}`}>{st.label}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-white/50">
            <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {b.roomName || "Habitación"}</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {DURATION[b.durationType] || b.durationType}</span>
            <span className="capitalize">{dayLabel(b.startAt)}</span>
          </div>
          {b.note && <p className="mt-1.5 text-[12px] text-white/60">“{b.note}”</p>}
          {b.confirmationCode && b.status === "CONFIRMADA" && (
            <p className="mt-1.5 text-[12px] text-white/50">Código: <span className="font-mono font-semibold text-white">{b.confirmationCode}</span></p>
          )}
        </div>
        <div className="shrink-0 text-right">
          {discounted && <p className="text-[11px] text-white/35 line-through">{formatClp(b.basePriceClp)}</p>}
          <p className="font-bold tabular-nums">{formatClp(b.priceClp)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {b.status === "PENDIENTE" && !rejecting && (
          <>
            <button disabled={busy} onClick={() => onAction(b, { type: "ACCEPT" })} className="rounded-xl bg-emerald-500 px-4 py-2 text-[13px] font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-50">
              {busy ? "..." : "Aceptar"}
            </button>
            <button disabled={busy} onClick={() => setRejecting(true)} className="rounded-xl border border-red-400/25 px-4 py-2 text-[13px] text-red-200 transition hover:bg-red-500/10 disabled:opacity-50">
              Rechazar
            </button>
          </>
        )}
        {b.status === "ACEPTADA" && <span className="text-[12px] text-white/45">El cliente tiene que confirmarla en el chat.</span>}
        {b.status === "CONFIRMADA" && (
          <button disabled={busy} onClick={() => onAction(b, { type: "FINISH" })} className="rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-[13px] font-medium transition hover:bg-white/10 disabled:opacity-50">
            {busy ? "..." : "Marcar finalizada"}
          </button>
        )}
        <Link href={`/chat/${b.clientId}`} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[13px] text-white/70 transition hover:bg-white/[0.06]">
          <MessageCircle className="h-4 w-4" /> Chat
        </Link>
        {closed && (
          <button disabled={busy} onClick={() => onAction(b, { type: "DELETE" })} className="ml-auto rounded-xl p-2 text-white/30 transition hover:bg-red-500/10 hover:text-red-300" aria-label="Quitar del historial">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {rejecting && (
        <div className="mt-3 space-y-3 rounded-xl border border-red-400/20 bg-red-500/[0.05] p-3">
          <p className="text-[12px] text-white/70">¿Por qué no puedes recibirla? Le avisamos al cliente por chat.</p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => (
              <button
                key={r.key}
                onClick={() => setReason(r.key)}
                className={`rounded-full border px-3 py-1.5 text-[12px] transition ${reason === r.key ? "border-red-300/50 bg-red-500/15 text-red-100" : "border-white/10 text-white/60"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          {reason === "OTRO" && (
            <input autoFocus maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: la habitación está en mantención" className="input-studio" />
          )}
          <div className="flex gap-2">
            <button
              disabled={busy || (reason === "OTRO" && !note.trim())}
              onClick={() => onAction(b, { type: "REJECT", reason, note: note.trim() })}
              className="rounded-xl bg-red-500/80 px-4 py-2 text-[13px] font-semibold transition hover:bg-red-500 disabled:opacity-50"
            >
              Rechazar reserva
            </button>
            <button onClick={() => setRejecting(false)} className="rounded-xl px-4 py-2 text-[13px] text-white/60 hover:bg-white/[0.05]">Volver</button>
          </div>
        </div>
      )}
    </article>
  );
}

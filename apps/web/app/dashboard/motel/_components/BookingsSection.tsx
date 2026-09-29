"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { EmptyState, Segmented } from "../../../../components/business/ui";
import BookingCard, { type BookingAction } from "./BookingCard";
import { dayLabel, localDateKey, type Booking } from "./types";

type View = "pending" | "upcoming" | "history";

/**
 * Reservas en tres pestañas: lo que hay que responder, lo que viene (agrupado
 * por día, reemplaza la agenda) y el historial.
 */
export default function BookingsSection({
  bookings,
  busyId,
  onAction,
}: {
  bookings: Booking[];
  busyId: string | null;
  onAction: (b: Booking, a: BookingAction) => void;
}) {
  const pending = bookings.filter((b) => b.status === "PENDIENTE");
  const upcoming = bookings
    .filter((b) => ["ACEPTADA", "CONFIRMADA"].includes(b.status))
    .sort((a, b) => new Date(a.startAt || a.createdAt).getTime() - new Date(b.startAt || b.createdAt).getTime());
  const history = bookings.filter((b) => ["FINALIZADA", "RECHAZADA", "CANCELADA"].includes(b.status));
  const [view, setView] = useState<View>(pending.length ? "pending" : "upcoming");

  const groups = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of upcoming) {
      const key = b.startAt ? localDateKey(b.startAt) : "sin-hora";
      map.set(key, [...(map.get(key) || []), b]);
    }
    return Array.from(map.entries());
  }, [upcoming]);

  const list = view === "pending" ? pending : view === "history" ? history : upcoming;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Reservas</h1>
        <p className="text-[13px] text-white/45">Acepta las solicitudes y el cliente las confirma por chat. Al llegar, pide el código de la reserva.</p>
      </div>
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: "pending", label: <>Por aceptar{pending.length ? ` (${pending.length})` : ""}</> },
          { value: "upcoming", label: <>Próximas{upcoming.length ? ` (${upcoming.length})` : ""}</> },
          { value: "history", label: "Historial" },
        ]}
      />

      {list.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title={view === "pending" ? "Nada por aceptar" : view === "upcoming" ? "Sin reservas próximas" : "Sin historial todavía"}
          text={view === "pending" ? "Cuando un cliente pida una habitación te llega aquí y al chat, al instante." : undefined}
        />
      ) : view === "upcoming" ? (
        <div className="space-y-6">
          {groups.map(([key, items]) => (
            <div key={key}>
              <h2 className="mb-2 text-sm font-semibold capitalize text-white/70">{key === "sin-hora" ? "Sin hora" : dayLabel(items[0].startAt)}</h2>
              <div className="space-y-3">
                {items.map((b) => <BookingCard key={b.id} booking={b} busy={busyId === b.id} onAction={onAction} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((b) => <BookingCard key={b.id} booking={b} busy={busyId === b.id} onAction={onAction} />)}
        </div>
      )}
    </div>
  );
}

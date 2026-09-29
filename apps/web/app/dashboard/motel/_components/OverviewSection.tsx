"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, ExternalLink, Share2 } from "lucide-react";
import { Card, Stat, Switch, formatClp } from "../../../../components/business/ui";
import BookingCard, { type BookingAction } from "./BookingCard";
import { localDateKey, type Booking, type Dashboard } from "./types";

export type SectionKey = "home" | "bookings" | "rooms" | "promos" | "profile";

export default function OverviewSection({
  data,
  busyId,
  onBooking,
  onToggle,
  goTo,
  publicUrl,
  notifyCopy,
}: {
  data: Dashboard;
  busyId: string | null;
  onBooking: (b: Booking, a: BookingAction) => void;
  onToggle: (key: "isOpen" | "isPublished") => void;
  goTo: (k: SectionKey) => void;
  publicUrl: string;
  notifyCopy: () => void;
}) {
  const { profile, rooms, bookings } = data;
  const [copied, setCopied] = useState(false);
  /* navigator sólo existe en el navegador: decidirlo en el render rompe la hidratación. */
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);
  const pending = bookings.filter((b) => b.status === "PENDIENTE");
  const today = localDateKey(new Date());
  const todays = bookings.filter((b) => b.startAt && localDateKey(b.startAt) === today && ["ACEPTADA", "CONFIRMADA"].includes(b.status));
  const month = new Date().toISOString().slice(0, 7);
  const monthRevenue = bookings
    .filter((b) => ["CONFIRMADA", "FINALIZADA"].includes(b.status) && (b.startAt || b.createdAt).slice(0, 7) === month)
    .reduce((sum, b) => sum + Number(b.priceClp || 0), 0);

  const activeRooms = rooms.filter((r) => r.isActive && (Number(r.price3h) > 0 || Number(r.price6h) > 0 || Number(r.priceNight) > 0));
  const steps: Array<{ done: boolean; label: string; go: SectionKey }> = [
    { done: Boolean(profile.coverUrl), label: "Sube la foto de portada", go: "profile" },
    { done: Boolean(profile.city && profile.latitude != null), label: "Ubica tu motel en el mapa", go: "profile" },
    { done: profile.amenities.length > 0, label: "Marca las comodidades del motel", go: "profile" },
    { done: activeRooms.length > 0, label: "Agrega una habitación con tarifas", go: "rooms" },
    { done: rooms.some((r) => r.photoUrls.length > 0), label: "Sube fotos de las habitaciones", go: "rooms" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      notifyCopy();
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Hola, {profile.displayName || "tu motel"}</h1>
        <p className="text-[13px] text-white/45">Así va tu motel hoy.</p>
      </div>

      {!profile.isVerified && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
          <div>
            <p className="font-semibold text-amber-100">Tu motel está en revisión</p>
            <p className="mt-0.5 text-amber-100/70">El equipo de UZEED revisa cada motel antes de sumarlo al directorio. Mientras, deja tu ficha lista: fotos, ubicación y habitaciones.</p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="editor-card flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-semibold">{profile.isOpen ? "Abierto ahora" : "Cerrado ahora"}</p>
            <p className="text-[12px] text-white/45">{profile.isOpen ? "Recibes solicitudes de reserva." : "No recibes reservas nuevas."}</p>
          </div>
          <Switch checked={profile.isOpen} onChange={() => onToggle("isOpen")} label="Abierto ahora" tone="emerald" />
        </div>
        <div className="editor-card flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-semibold">{profile.isPublished ? "Visible en el directorio" : "Oculto del directorio"}</p>
            <p className="text-[12px] text-white/45">{profile.isPublished ? "Te encuentran en Moteles de UZEED." : "Nadie ve tu ficha por ahora."}</p>
          </div>
          <Switch checked={profile.isPublished} onChange={() => onToggle("isPublished")} label="Visible en el directorio" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Por aceptar" value={pending.length} tone={pending.length ? "amber" : "white"} />
        <Stat label="Llegan hoy" value={todays.length} tone="emerald" />
        <Stat label="Este mes" value={formatClp(monthRevenue)} sub="confirmadas" tone="violet" />
      </div>

      {doneCount < steps.length && (
        <Card
          title="Deja tu motel listo para reservas"
          description={`${doneCount} de ${steps.length} pasos. Las fichas completas salen primero en el directorio.`}
        >
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {steps.map((s) => (
              <button
                key={s.label}
                onClick={() => goTo(s.go)}
                disabled={s.done}
                className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition ${s.done ? "border-transparent text-white/35" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}
              >
                {s.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : <span className="h-4 w-4 shrink-0 rounded-full border border-white/30" />}
                <span className={s.done ? "line-through" : ""}>{s.label}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card
        title={pending.length ? "Solicitudes por aceptar" : "Próximas llegadas"}
        action={<button onClick={() => goTo("bookings")} className="text-[13px] text-fuchsia-300 hover:text-fuchsia-200">Ver reservas</button>}
      >
        {(pending.length ? pending : todays).length ? (
          <div className="space-y-3">
            {(pending.length ? pending : todays).slice(0, 4).map((b) => (
              <BookingCard key={b.id} booking={b} busy={busyId === b.id} onAction={onBooking} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/45">No hay solicitudes pendientes. Te avisamos al instante cuando llegue una.</p>
        )}
      </Card>

      <Card title="Comparte tu ficha" description="Pon el enlace en tu Instagram, Google Maps o WhatsApp: los clientes reservan directo.">
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[13px] text-white/70">{publicUrl.replace(/^https?:\/\//, "")}</code>
          <button onClick={copy} className="btn-secondary px-3 py-2.5 text-sm">
            {copied ? <CheckCircle2 className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />} {copied ? "Copiado" : "Copiar"}
          </button>
          {canShare && (
            <button onClick={() => navigator.share({ title: profile.displayName || "Mi motel", url: publicUrl }).catch(() => {})} className="btn-secondary px-3 py-2.5 text-sm" aria-label="Compartir">
              <Share2 className="h-4 w-4" />
            </button>
          )}
          <Link href={publicUrl.replace(/^https?:\/\/[^/]+/, "")} className="btn-secondary px-3 py-2.5 text-sm">
            <ExternalLink className="mr-1.5 h-4 w-4" /> Ver
          </Link>
        </div>
      </Card>
    </div>
  );
}

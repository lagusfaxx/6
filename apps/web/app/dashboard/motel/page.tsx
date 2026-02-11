"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch, friendlyErrorMessage } from "../../../lib/api";

type Dashboard = { profile: any; rooms: any[]; promotions: any[]; bookings: any[] };
type RejectState = Record<string, { reason: "CERRADO" | "SIN_HABITACIONES" | "OTRO"; note: string }>;

const emptyRoom = {
  name: "",
  roomType: "Normal",
  description: "",
  amenities: "",
  price3h: "",
  price6h: "",
  priceNight: "",
};

const emptyPromo = {
  title: "",
  description: "",
  discountPercent: "",
  discountClp: "",
};

export default function MotelDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"profile" | "rooms" | "promos" | "bookings">("profile");
  const [msg, setMsg] = useState<string | null>(null);
  const [rejectByBooking, setRejectByBooking] = useState<RejectState>({});
  const [roomForm, setRoomForm] = useState(emptyRoom);
  const [promoForm, setPromoForm] = useState(emptyPromo);

  const profileForm = useMemo(() => ({
    displayName: data?.profile?.displayName || "",
    address: data?.profile?.address || "",
    city: data?.profile?.city || "",
    phone: data?.profile?.phone || "",
    schedule: data?.profile?.schedule || "",
    rules: data?.profile?.rules || "",
  }), [data?.profile]);
  const [profileDraft, setProfileDraft] = useState(profileForm);
  useEffect(() => setProfileDraft(profileForm), [profileForm]);

  const load = async () => {
    setError(null);
    try {
      const next = await apiFetch<Dashboard>("/motel/dashboard");
      setData(next);
    } catch (e: any) {
      setError(friendlyErrorMessage(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-white/70">Cargando panel motel...</div>;

  if (!data) {
    return (
      <div className="card p-6 space-y-3">
        <h1 className="text-2xl font-semibold">Panel Motel/Hotel</h1>
        <p className="text-white/80">No pudimos cargar el panel. {error || "Reintenta en unos segundos."}</p>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={load}>Reintentar</button>
          <Link href="/cuenta" className="btn-secondary">Ir a cuenta</Link>
        </div>
      </div>
    );
  }

  async function rejectBooking(bookingId: string) {
    const reject = rejectByBooking[bookingId] || { reason: "CERRADO", note: "" };
    if (reject.reason === "OTRO" && !reject.note.trim()) {
      setMsg("Si eliges OTRO, debes escribir un motivo.");
      return;
    }
    await apiFetch(`/motel/bookings/${bookingId}/action`, {
      method: "POST",
      body: JSON.stringify({ action: "REJECT", rejectReason: reject.reason, rejectNote: reject.note || null }),
    });
    setMsg("Reserva rechazada y cliente notificado por chat.");
    await load();
  }

  async function saveProfile() {
    await apiFetch("/motel/dashboard/profile", { method: "PUT", body: JSON.stringify(profileDraft) });
    setMsg("Perfil actualizado");
    await load();
  }

  async function createRoom() {
    await apiFetch("/motel/dashboard/rooms", {
      method: "POST",
      body: JSON.stringify({
        ...roomForm,
        amenities: roomForm.amenities.split(",").map((s) => s.trim()).filter(Boolean),
        price3h: Number(roomForm.price3h || 0),
        price6h: Number(roomForm.price6h || 0),
        priceNight: Number(roomForm.priceNight || 0),
      }),
    });
    setRoomForm(emptyRoom);
    setMsg("Habitación creada");
    await load();
  }

  async function createPromo() {
    await apiFetch("/motel/dashboard/promotions", {
      method: "POST",
      body: JSON.stringify({
        ...promoForm,
        discountPercent: promoForm.discountPercent ? Number(promoForm.discountPercent) : null,
        discountClp: promoForm.discountClp ? Number(promoForm.discountClp) : null,
      }),
    });
    setPromoForm(emptyPromo);
    setMsg("Promoción creada");
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h1 className="text-2xl font-semibold">Panel Motel/Hotel</h1>
        <p className="text-sm text-white/70 mt-1">Administra perfil, habitaciones, promociones y reservas de tu establecimiento.</p>
        <div className="mt-3 flex flex-wrap gap-2">{(["profile", "rooms", "promos", "bookings"] as const).map((t) => <button key={t} className={`px-3 py-1 rounded-full border ${tab === t ? "border-fuchsia-300 bg-fuchsia-500/20" : "border-white/20"}`} onClick={() => setTab(t)}>{t}</button>)}</div>
      </div>
      {msg ? <div className="card p-3 text-sm">{msg}</div> : null}

      {tab === "profile" ? (
        <div className="card p-4 grid gap-3 md:grid-cols-2">
          {Object.keys(profileDraft).map((key) => (
            <label key={key} className="grid gap-1 text-xs text-white/70">{key}
              <input className="input" value={(profileDraft as any)[key]} onChange={(e) => setProfileDraft((prev) => ({ ...prev, [key]: e.target.value }))} />
            </label>
          ))}
          <div className="md:col-span-2">
            <button className="btn-primary" onClick={saveProfile}>Guardar perfil</button>
          </div>
        </div>
      ) : null}

      {tab === "rooms" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="card p-4 space-y-2">
            <h3 className="font-semibold">Nueva habitación</h3>
            <input className="input" placeholder="Nombre" value={roomForm.name} onChange={(e) => setRoomForm((f) => ({ ...f, name: e.target.value }))} />
            <select className="input" value={roomForm.roomType} onChange={(e) => setRoomForm((f) => ({ ...f, roomType: e.target.value }))}><option>Normal</option><option>Jacuzzi</option><option>Premium</option><option>Temática</option></select>
            <textarea className="input min-h-24" placeholder="Descripción" value={roomForm.description} onChange={(e) => setRoomForm((f) => ({ ...f, description: e.target.value }))} />
            <input className="input" placeholder="Amenidades separadas por coma" value={roomForm.amenities} onChange={(e) => setRoomForm((f) => ({ ...f, amenities: e.target.value }))} />
            <div className="grid grid-cols-3 gap-2">
              <input className="input" placeholder="3h" value={roomForm.price3h} onChange={(e) => setRoomForm((f) => ({ ...f, price3h: e.target.value }))} />
              <input className="input" placeholder="6h" value={roomForm.price6h} onChange={(e) => setRoomForm((f) => ({ ...f, price6h: e.target.value }))} />
              <input className="input" placeholder="Noche" value={roomForm.priceNight} onChange={(e) => setRoomForm((f) => ({ ...f, priceNight: e.target.value }))} />
            </div>
            <button className="btn-primary" onClick={createRoom}>Crear habitación</button>
          </div>
          <div className="card p-4 space-y-2">
            <h3 className="font-semibold">Habitaciones actuales</h3>
            {data.rooms.length ? data.rooms.map((r) => <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">{r.name} · {r.roomType || "Normal"} · 3h ${Number(r.price3h || r.price || 0).toLocaleString("es-CL")} · 6h ${Number(r.price6h || r.price || 0).toLocaleString("es-CL")} · Noche ${Number(r.priceNight || r.price || 0).toLocaleString("es-CL")}</div>) : <div className="text-white/60 text-sm">No hay habitaciones cargadas.</div>}
          </div>
        </div>
      ) : null}

      {tab === "promos" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="card p-4 space-y-2">
            <h3 className="font-semibold">Nueva promoción</h3>
            <input className="input" placeholder="Título" value={promoForm.title} onChange={(e) => setPromoForm((f) => ({ ...f, title: e.target.value }))} />
            <textarea className="input min-h-24" placeholder="Descripción" value={promoForm.description} onChange={(e) => setPromoForm((f) => ({ ...f, description: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="% descuento" value={promoForm.discountPercent} onChange={(e) => setPromoForm((f) => ({ ...f, discountPercent: e.target.value }))} />
              <input className="input" placeholder="Monto fijo CLP" value={promoForm.discountClp} onChange={(e) => setPromoForm((f) => ({ ...f, discountClp: e.target.value }))} />
            </div>
            <button className="btn-primary" onClick={createPromo}>Crear promoción</button>
          </div>
          <div className="card p-4 space-y-2">
            <h3 className="font-semibold">Promociones activas</h3>
            {data.promotions.length ? data.promotions.map((r) => <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">{r.title} · {r.discountPercent ? `${r.discountPercent}%` : r.discountClp ? `$${Number(r.discountClp).toLocaleString("es-CL")}` : "sin descuento"}</div>) : <div className="text-white/60 text-sm">No hay promociones activas.</div>}
          </div>
        </div>
      ) : null}

      {tab === "bookings" ? (
        <div className="card p-4 space-y-3">
          {data.bookings.map((b) => {
            const reject = rejectByBooking[b.id] || { reason: "CERRADO", note: "" };
            return (
              <div key={b.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>{b.clientName || b.clientUsername || "Cliente"} · {b.roomName || "Suite"}</div>
                  <Link className="text-xs underline text-fuchsia-200" href={`/chat/${b.clientId}`}>Abrir chat</Link>
                </div>
                <div className="text-white/70">{b.durationType} · ${Number(b.priceClp || 0).toLocaleString("es-CL")} · {b.status}</div>
                {b.status === "PENDIENTE" ? (
                  <div className="mt-2 space-y-2">
                    <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
                      <select className="input" value={reject.reason} onChange={(e) => setRejectByBooking((prev) => ({ ...prev, [b.id]: { ...reject, reason: e.target.value as any } }))}>
                        <option value="CERRADO">Cerrado</option>
                        <option value="SIN_HABITACIONES">Sin habitaciones</option>
                        <option value="OTRO">Otro motivo</option>
                      </select>
                      <input className="input" placeholder="Detalle si eliges otro motivo" value={reject.note} onChange={(e) => setRejectByBooking((prev) => ({ ...prev, [b.id]: { ...reject, note: e.target.value } }))} disabled={reject.reason !== "OTRO"} />
                      <button className="btn-primary text-xs" onClick={async () => { await apiFetch(`/motel/bookings/${b.id}/action`, { method: "POST", body: JSON.stringify({ action: "ACCEPT" }) }); setMsg("Reserva aceptada y cliente notificado por chat."); load(); }}>Aceptar</button>
                      <button className="btn-secondary text-xs" onClick={() => rejectBooking(b.id)}>Rechazar</button>
                    </div>
                  </div>
                ) : null}
                {b.status === "CONFIRMADA" ? <button className="btn-secondary text-xs mt-2" onClick={async () => { await apiFetch(`/motel/bookings/${b.id}/action`, { method: "POST", body: JSON.stringify({ action: "FINISH" }) }); setMsg("Reserva finalizada."); load(); }}>Finalizar estadía</button> : null}
                {b.status === "RECHAZADA" && (b.rejectReason || b.rejectNote) ? <div className="mt-2 text-xs text-white/70">Motivo: {b.rejectReason}{b.rejectNote ? ` · ${b.rejectNote}` : ""}</div> : null}
              </div>
            );
          })}
          {!data.bookings.length ? <div className="text-sm text-white/60">No hay reservas aún.</div> : null}
        </div>
      ) : null}
    </div>
  );
}

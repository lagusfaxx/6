"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";

type Dashboard = { profile: any; rooms: any[]; promotions: any[]; bookings: any[] };

export default function MotelDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"profile" | "rooms" | "promos" | "bookings">("profile");
  const [msg, setMsg] = useState<string | null>(null);

  const load = () => apiFetch<Dashboard>("/motel/dashboard").then(setData).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  if (loading) return <div className="text-white/70">Cargando panel motel...</div>;
  if (!data) return <div className="text-white/70">No disponible.</div>;

  const p = data.profile;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h1 className="text-2xl font-semibold">Panel Motel/Hotel</h1>
        <div className="mt-3 flex flex-wrap gap-2">{(["profile", "rooms", "promos", "bookings"] as const).map((t) => <button key={t} className={`px-3 py-1 rounded-full border ${tab === t ? "border-fuchsia-300 bg-fuchsia-500/20" : "border-white/20"}`} onClick={() => setTab(t)}>{t}</button>)}</div>
      </div>
      {msg ? <div className="card p-3 text-sm">{msg}</div> : null}

      {tab === "profile" ? (
        <div className="card p-4 grid gap-2 md:grid-cols-2">
          {[["Nombre", "displayName"], ["Dirección", "address"], ["Ciudad", "city"], ["Teléfono", "phone"], ["Horario", "schedule"], ["Políticas", "rules"]].map(([label, key]) => (
            <label key={key} className="grid gap-1 text-xs text-white/70">{label}
              <input className="input" defaultValue={p[key]} onBlur={async (e) => { await apiFetch("/motel/dashboard/profile", { method: "PUT", body: JSON.stringify({ [key]: e.target.value }) }); setMsg("Perfil actualizado"); }} />
            </label>
          ))}
        </div>
      ) : null}

      {tab === "rooms" ? (
        <div className="card p-4 space-y-3">
          <button className="btn-secondary" onClick={async () => { await apiFetch("/motel/dashboard/rooms", { method: "POST", body: JSON.stringify({ name: "Nueva Suite", roomType: "Normal", price3h: 20000, price6h: 32000, priceNight: 46000 }) }); setMsg("Habitación creada"); load(); }}>+ Crear habitación</button>
          {data.rooms.map((r) => <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">{r.name} · {r.roomType || "Normal"} · 3h ${Number(r.price3h || r.price || 0).toLocaleString("es-CL")} · 6h ${Number(r.price6h || r.price || 0).toLocaleString("es-CL")} · Noche ${Number(r.priceNight || r.price || 0).toLocaleString("es-CL")}</div>)}
        </div>
      ) : null}

      {tab === "promos" ? (
        <div className="card p-4 space-y-3">
          <button className="btn-secondary" onClick={async () => { await apiFetch("/motel/dashboard/promotions", { method: "POST", body: JSON.stringify({ title: "Promo Flash", discountPercent: 15 }) }); setMsg("Promoción creada"); load(); }}>+ Crear promoción</button>
          {data.promotions.map((r) => <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">{r.title} · {r.discountPercent ? `${r.discountPercent}%` : "$ fijo"}</div>)}
        </div>
      ) : null}

      {tab === "bookings" ? (
        <div className="card p-4 space-y-3">
          {data.bookings.map((b) => <div key={b.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
            <div>{b.clientName || b.clientUsername || "Cliente"} · {b.roomName || "Suite"}</div>
            <div className="text-white/70">{b.durationType} · ${Number(b.priceClp || 0).toLocaleString("es-CL")} · {b.status}</div>
            <div className="flex gap-2 mt-2">
              {b.status === "PENDIENTE" ? <><button className="btn-primary text-xs" onClick={async () => { await apiFetch(`/motel/bookings/${b.id}/action`, { method: "POST", body: JSON.stringify({ action: "ACCEPT" }) }); load(); }}>Aceptar</button><button className="btn-secondary text-xs" onClick={async () => { await apiFetch(`/motel/bookings/${b.id}/action`, { method: "POST", body: JSON.stringify({ action: "REJECT" }) }); load(); }}>Rechazar</button></> : null}
              {b.status === "CONFIRMADA" ? <button className="btn-secondary text-xs" onClick={async () => { await apiFetch(`/motel/bookings/${b.id}/action`, { method: "POST", body: JSON.stringify({ action: "FINISH" }) }); load(); }}>Finalizar estadía</button> : null}
            </div>
          </div>)}
        </div>
      ) : null}
    </div>
  );
}

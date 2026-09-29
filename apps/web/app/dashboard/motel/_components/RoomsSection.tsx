"use client";

import { useState } from "react";
import { BedDouble, Plus } from "lucide-react";
import { EmptyState, Switch, formatClp } from "../../../../components/business/ui";
import { roomAmenityLabel } from "../../../../components/motels/amenities";
import { apiFetch, friendlyErrorMessage, resolveMediaUrl } from "../../../../lib/api";
import RoomModal from "./RoomModal";
import type { Notify, Room } from "./types";

export default function RoomsSection({ rooms, reload, notify }: { rooms: Room[]; reload: () => void; notify: Notify }) {
  const [editing, setEditing] = useState<Room | null>(null);
  const [open, setOpen] = useState(false);

  function openRoom(r: Room | null) {
    setEditing(r);
    setOpen(true);
  }

  async function toggle(r: Room) {
    try {
      await apiFetch(`/motel/dashboard/rooms/${r.id}`, { method: "PUT", body: JSON.stringify({ isActive: !r.isActive }) });
      notify(r.isActive ? "Habitación pausada: no se puede reservar." : "Habitación disponible.");
      reload();
    } catch (e: any) {
      notify(friendlyErrorMessage(e), "error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Habitaciones</h1>
          <p className="text-[13px] text-white/45">Cada habitación aparece en tu ficha con sus fotos y tarifas. Los clientes eligen una al reservar.</p>
        </div>
        <button onClick={() => openRoom(null)} className="btn-primary px-4 py-2.5 text-sm">
          <Plus className="mr-1.5 h-4 w-4" /> Agregar habitación
        </button>
      </div>

      {rooms.length === 0 ? (
        <EmptyState
          icon={<BedDouble className="h-6 w-6" />}
          title="Todavía no tienes habitaciones"
          text="Agrega tu primera habitación con fotos y tarifas para empezar a recibir reservas."
          action={<button onClick={() => openRoom(null)} className="btn-primary px-4 py-2.5 text-sm">Agregar habitación</button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {rooms.map((r) => {
            const photo = resolveMediaUrl(r.photoUrls?.[0]);
            return (
              <article key={r.id} className={`editor-card overflow-hidden ${r.isActive ? "" : "opacity-60"}`}>
                <button onClick={() => openRoom(r)} className="block w-full text-left">
                  <div className="relative aspect-[16/9] bg-[#0a0a10]">
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-1 text-white/30">
                        <BedDouble className="h-7 w-7" />
                        <span className="text-[12px]">Sin fotos: agrégalas, venden más</span>
                      </div>
                    )}
                    {!r.isActive && <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-1 text-[11px]">Pausada</span>}
                    {r.photoUrls.length > 1 && <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2 py-0.5 text-[11px]">{r.photoUrls.length} fotos</span>}
                  </div>
                  <div className="p-4 pb-2">
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-[12px] text-white/45">{r.roomType || "Habitación"}{r.amenities.length ? ` · ${r.amenities.slice(0, 3).map(roomAmenityLabel).join(", ")}` : ""}</p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      {[["3 h", r.price3h], ["6 h", r.price6h], ["Noche", r.priceNight]].map(([label, price]) => (
                        <div key={label as string} className="rounded-lg bg-white/[0.04] py-1.5">
                          <p className="text-[10px] text-white/40">{label}</p>
                          <p className="text-[13px] font-semibold">{Number(price) > 0 ? formatClp(Number(price)) : "—"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </button>
                <div className="flex items-center justify-between border-t border-white/[0.06] px-4 py-3">
                  <span className="text-[12px] text-white/50">{r.isActive ? "Disponible" : "Pausada"}</span>
                  <Switch checked={r.isActive} onChange={() => toggle(r)} label={`Disponibilidad de ${r.name}`} tone="emerald" />
                </div>
              </article>
            );
          })}
        </div>
      )}

      <RoomModal open={open} room={editing} onClose={() => setOpen(false)} onSaved={reload} notify={notify} />
    </div>
  );
}

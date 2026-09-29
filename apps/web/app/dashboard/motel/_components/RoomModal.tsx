"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Star, Trash2, X } from "lucide-react";
import { ROOM_AMENITIES, ROOM_TYPES } from "@uzeed/shared/motel";
import { ChipToggle, Field, Modal, Switch, digitsOnly } from "../../../../components/business/ui";
import { apiFetch, friendlyErrorMessage, getApiBase, resolveMediaUrl } from "../../../../lib/api";
import type { Notify, Room } from "./types";

type Draft = {
  id?: string;
  name: string;
  roomType: string;
  description: string;
  price3h: string;
  price6h: string;
  priceNight: string;
  amenities: string[];
  photoUrls: string[];
  isActive: boolean;
};

const EMPTY: Draft = { name: "", roomType: ROOM_TYPES[0], description: "", price3h: "", price6h: "", priceNight: "", amenities: [], photoUrls: [], isActive: true };

function toDraft(r: Room | null): Draft {
  if (!r) return EMPTY;
  return {
    id: r.id,
    name: r.name,
    roomType: r.roomType || ROOM_TYPES[0],
    description: r.description || "",
    price3h: r.price3h ? String(r.price3h) : "",
    price6h: r.price6h ? String(r.price6h) : "",
    priceNight: r.priceNight ? String(r.priceNight) : "",
    amenities: r.amenities || [],
    photoUrls: r.photoUrls || [],
    isActive: r.isActive,
  };
}

export default function RoomModal({
  open,
  room,
  onClose,
  onSaved,
  notify,
}: {
  open: boolean;
  room: Room | null;
  onClose: () => void;
  onSaved: () => void;
  notify: Notify;
}) {
  const [d, setD] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setD(toDraft(room));
  }, [open, room]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const customAmenities = d.amenities.filter((a) => !ROOM_AMENITIES.some((o) => o.key === a));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).slice(0, 10).forEach((f) => fd.append("files", f));
      const res = await fetch(`${getApiBase()}/motel/dashboard/room-photos`, { method: "POST", credentials: "include", body: fd });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message || "No se pudieron subir las fotos.");
      setD((p) => ({ ...p, photoUrls: [...p.photoUrls, ...(payload?.urls || [])].slice(0, 12) }));
      if (payload?.failures?.length) notify(`${payload.failures.length} foto(s) no se pudieron procesar.`, "error");
    } catch (e: any) {
      notify(e?.message || "No se pudieron subir las fotos.", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function save() {
    if (d.name.trim().length < 2) return notify("Ponle un nombre a la habitación.", "error");
    if (![d.price3h, d.price6h, d.priceNight].some((v) => Number(v || 0) > 0)) {
      return notify("Ingresa al menos una tarifa: 3 horas, 6 horas o noche.", "error");
    }
    setSaving(true);
    try {
      const body = {
        name: d.name.trim(),
        roomType: d.roomType,
        description: d.description,
        price3h: Number(d.price3h || 0),
        price6h: Number(d.price6h || 0),
        priceNight: Number(d.priceNight || 0),
        amenities: d.amenities,
        photoUrls: d.photoUrls,
        isActive: d.isActive,
      };
      if (d.id) await apiFetch(`/motel/dashboard/rooms/${d.id}`, { method: "PUT", body: JSON.stringify(body) });
      else await apiFetch("/motel/dashboard/rooms", { method: "POST", body: JSON.stringify(body) });
      notify(d.id ? "Habitación guardada." : "Habitación creada. Ya aparece en tu ficha.");
      onSaved();
      onClose();
    } catch (e: any) {
      notify(friendlyErrorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!d.id || !window.confirm(`¿Eliminar "${d.name}"? También se quita de las promociones.`)) return;
    try {
      await apiFetch(`/motel/dashboard/rooms/${d.id}`, { method: "DELETE" });
      notify("Habitación eliminada.");
      onSaved();
      onClose();
    } catch (e: any) {
      notify(friendlyErrorMessage(e), "error");
    }
  }

  const priceInput = (key: "price3h" | "price6h" | "priceNight", label: string) => (
    <label className="block rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2.5 focus-within:border-violet-500/40">
      <span className="block text-[11px] font-medium text-white/45">{label}</span>
      <span className="flex items-center gap-1 text-lg font-semibold">
        <span className="text-white/40">$</span>
        <input inputMode="numeric" value={d[key]} onChange={(e) => set(key, digitsOnly(e.target.value))} placeholder="—" className="w-full bg-transparent outline-none placeholder:text-white/25" />
      </span>
    </label>
  );

  return (
    <Modal
      open={open}
      title={d.id ? "Editar habitación" : "Nueva habitación"}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          {d.id && (
            <button onClick={remove} className="rounded-xl p-2.5 text-white/40 transition hover:bg-red-500/10 hover:text-red-300" aria-label="Eliminar habitación">
              <Trash2 className="h-5 w-5" />
            </button>
          )}
          <button onClick={onClose} className="btn-secondary ml-auto px-4 py-2.5 text-sm">Cancelar</button>
          <button onClick={save} disabled={saving || uploading} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">
            {saving ? "Guardando..." : d.id ? "Guardar" : "Crear habitación"}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-[12px] font-medium text-white/55">Fotos · la primera es la portada de la habitación</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {d.photoUrls.map((url, i) => (
              <div key={url + i} className="group relative aspect-square overflow-hidden rounded-xl border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={resolveMediaUrl(url) || ""} alt="" className="h-full w-full object-cover" />
                {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px]">Portada</span>}
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-black/80 to-transparent p-1.5">
                  {i > 0 ? (
                    <button onClick={() => set("photoUrls", [url, ...d.photoUrls.filter((_, j) => j !== i)])} className="rounded-full bg-black/60 p-1" aria-label="Usar como portada">
                      <Star className="h-3.5 w-3.5" />
                    </button>
                  ) : <span />}
                  <button onClick={() => set("photoUrls", d.photoUrls.filter((_, j) => j !== i))} className="rounded-full bg-black/60 p-1" aria-label="Quitar foto">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/15 text-white/45 transition hover:border-fuchsia-400/40 hover:text-white/80"
            >
              <Camera className="h-5 w-5" />
              <span className="text-[11px]">{uploading ? "Subiendo..." : "Agregar"}</span>
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
          <Field label="Nombre">
            <input value={d.name} maxLength={80} onChange={(e) => set("name", e.target.value)} placeholder="Suite Jacuzzi" className="input-studio" />
          </Field>
          <Field label="Tipo">
            <select value={d.roomType} onChange={(e) => set("roomType", e.target.value)} className="input-studio [color-scheme:dark]">
              {Array.from(new Set([...ROOM_TYPES, d.roomType])).map((t) => (
                <option key={t} value={t} className="bg-[#161726]">{t}</option>
              ))}
            </select>
          </Field>
        </div>

        <div>
          <p className="mb-2 text-[12px] font-medium text-white/55">Tarifas en pesos · deja vacía la que no ofreces</p>
          <div className="grid grid-cols-3 gap-2">
            {priceInput("price3h", "3 horas")}
            {priceInput("price6h", "6 horas")}
            {priceInput("priceNight", "Noche")}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[12px] font-medium text-white/55">Qué tiene la habitación</p>
          <div className="flex flex-wrap gap-2">
            {ROOM_AMENITIES.map((a) => (
              <ChipToggle
                key={a.key}
                active={d.amenities.includes(a.key)}
                onClick={() => set("amenities", d.amenities.includes(a.key) ? d.amenities.filter((x) => x !== a.key) : [...d.amenities, a.key])}
              >
                {a.label}
              </ChipToggle>
            ))}
            {customAmenities.map((a) => (
              <ChipToggle key={a} active onClick={() => set("amenities", d.amenities.filter((x) => x !== a))}>{a}</ChipToggle>
            ))}
          </div>
        </div>

        <Field label="Descripción (opcional)">
          <textarea value={d.description} maxLength={1000} onChange={(e) => set("description", e.target.value)} placeholder="Cama king, jacuzzi doble, luces regulables..." className="input-studio min-h-[88px] resize-none" />
        </Field>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div>
            <p className="text-sm font-medium">Disponible para reservar</p>
            <p className="text-[12px] text-white/45">Apágala si está en mantención: deja de verse en tu ficha.</p>
          </div>
          <Switch checked={d.isActive} onChange={(v) => set("isActive", v)} label="Disponible para reservar" tone="emerald" />
        </div>
      </div>
    </Modal>
  );
}

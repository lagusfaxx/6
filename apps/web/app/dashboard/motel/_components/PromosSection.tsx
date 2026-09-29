"use client";

import { useEffect, useState } from "react";
import { BadgePercent, Plus, Trash2 } from "lucide-react";
import { ChipToggle, EmptyState, Field, Modal, Segmented, Switch, digitsOnly, formatClp } from "../../../../components/business/ui";
import { apiFetch, friendlyErrorMessage } from "../../../../lib/api";
import { toLocalInput, type Notify, type Promo, type Room } from "./types";

type Draft = {
  id?: string;
  title: string;
  description: string;
  kind: "pct" | "clp";
  value: string;
  roomIds: string[];
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const EMPTY: Draft = { title: "", description: "", kind: "pct", value: "", roomIds: [], startsAt: "", endsAt: "", isActive: true };

function promoState(p: Promo) {
  const now = Date.now();
  if (!p.isActive) return { label: "Pausada", className: "bg-white/10 text-white/50" };
  if (p.startsAt && new Date(p.startsAt).getTime() > now) return { label: "Programada", className: "bg-sky-500/15 text-sky-200" };
  if (p.endsAt && new Date(p.endsAt).getTime() < now) return { label: "Terminada", className: "bg-white/10 text-white/50" };
  return { label: "Vigente", className: "bg-emerald-500/15 text-emerald-300" };
}

export default function PromosSection({ promos, rooms, reload, notify }: { promos: Promo[]; rooms: Room[]; reload: () => void; notify: Notify }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Promo | null>(null);

  async function toggle(p: Promo) {
    try {
      await apiFetch(`/motel/dashboard/promotions/${p.id}`, { method: "PUT", body: JSON.stringify({ isActive: !p.isActive }) });
      notify(p.isActive ? "Promoción pausada." : "Promoción activada.");
      reload();
    } catch (e: any) {
      notify(friendlyErrorMessage(e), "error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Promociones</h1>
          <p className="text-[13px] text-white/45">Se ven en tu ficha y en el directorio, y el descuento se aplica solo al reservar.</p>
        </div>
        <button onClick={() => { setEditing(null); setOpen(true); }} className="btn-primary px-4 py-2.5 text-sm">
          <Plus className="mr-1.5 h-4 w-4" /> Nueva promoción
        </button>
      </div>

      {promos.length === 0 ? (
        <EmptyState
          icon={<BadgePercent className="h-6 w-6" />}
          title="Sin promociones"
          text="Una promo de horario bajo (ej: -20% de lunes a jueves) te pone arriba en el directorio con la etiqueta de descuento."
          action={<button onClick={() => { setEditing(null); setOpen(true); }} className="btn-primary px-4 py-2.5 text-sm">Crear promoción</button>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {promos.map((p) => {
            const st = promoState(p);
            const targets = p.roomIds?.length ? p.roomIds : p.roomId ? [p.roomId] : [];
            return (
              <article key={p.id} className="editor-card p-4">
                <button onClick={() => { setEditing(p); setOpen(true); }} className="block w-full text-left">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{p.title}</p>
                    <span className="shrink-0 rounded-full bg-fuchsia-600/80 px-2.5 py-0.5 text-[12px] font-bold">
                      {p.discountPercent ? `-${p.discountPercent}%` : `-${formatClp(p.discountClp)}`}
                    </span>
                  </div>
                  {p.description && <p className="mt-1 text-[13px] text-white/55">{p.description}</p>}
                  <p className="mt-2 text-[12px] text-white/40">
                    {targets.length ? `${targets.length} ${targets.length === 1 ? "habitación" : "habitaciones"}` : "Todas las habitaciones"}
                    {p.endsAt ? ` · hasta el ${new Date(p.endsAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}` : ""}
                  </p>
                </button>
                <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.className}`}>{st.label}</span>
                  <Switch checked={p.isActive} onChange={() => toggle(p)} label={`Activar ${p.title}`} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      <PromoModal open={open} promo={editing} rooms={rooms} onClose={() => setOpen(false)} onSaved={reload} notify={notify} />
    </div>
  );
}

function PromoModal({
  open,
  promo,
  rooms,
  onClose,
  onSaved,
  notify,
}: {
  open: boolean;
  promo: Promo | null;
  rooms: Room[];
  onClose: () => void;
  onSaved: () => void;
  notify: Notify;
}) {
  const [d, setD] = useState<Draft>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!promo) return setD(EMPTY);
    setD({
      id: promo.id,
      title: promo.title,
      description: promo.description || "",
      kind: promo.discountPercent ? "pct" : "clp",
      value: String(promo.discountPercent || promo.discountClp || ""),
      roomIds: promo.roomIds?.length ? promo.roomIds : promo.roomId ? [promo.roomId] : [],
      startsAt: toLocalInput(promo.startsAt),
      endsAt: toLocalInput(promo.endsAt),
      isActive: promo.isActive,
    });
  }, [open, promo]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));

  async function save() {
    if (d.title.trim().length < 2) return notify("Ponle un título a la promoción.", "error");
    const value = Number(d.value || 0);
    if (!value) return notify("Indica el descuento.", "error");
    if (d.kind === "pct" && (value < 1 || value > 90)) return notify("El porcentaje debe estar entre 1 y 90.", "error");
    setSaving(true);
    try {
      const body = {
        title: d.title.trim(),
        description: d.description,
        discountPercent: d.kind === "pct" ? value : null,
        discountClp: d.kind === "clp" ? value : null,
        roomIds: d.roomIds,
        startsAt: d.startsAt ? new Date(d.startsAt).toISOString() : null,
        endsAt: d.endsAt ? new Date(d.endsAt).toISOString() : null,
        isActive: d.isActive,
      };
      if (d.id) await apiFetch(`/motel/dashboard/promotions/${d.id}`, { method: "PUT", body: JSON.stringify(body) });
      else await apiFetch("/motel/dashboard/promotions", { method: "POST", body: JSON.stringify(body) });
      notify(d.id ? "Promoción guardada." : "Promoción creada.");
      onSaved();
      onClose();
    } catch (e: any) {
      notify(friendlyErrorMessage(e), "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!d.id || !window.confirm(`¿Eliminar la promoción "${d.title}"?`)) return;
    try {
      await apiFetch(`/motel/dashboard/promotions/${d.id}`, { method: "DELETE" });
      notify("Promoción eliminada.");
      onSaved();
      onClose();
    } catch (e: any) {
      notify(friendlyErrorMessage(e), "error");
    }
  }

  return (
    <Modal
      open={open}
      title={d.id ? "Editar promoción" : "Nueva promoción"}
      onClose={onClose}
      footer={
        <div className="flex items-center gap-2">
          {d.id && (
            <button onClick={remove} className="rounded-xl p-2.5 text-white/40 transition hover:bg-red-500/10 hover:text-red-300" aria-label="Eliminar promoción">
              <Trash2 className="h-5 w-5" />
            </button>
          )}
          <button onClick={onClose} className="btn-secondary ml-auto px-4 py-2.5 text-sm">Cancelar</button>
          <button onClick={save} disabled={saving} className="btn-primary px-5 py-2.5 text-sm disabled:opacity-50">{saving ? "Guardando..." : "Guardar"}</button>
        </div>
      }
    >
      <div className="space-y-5">
        <Field label="Título">
          <input value={d.title} maxLength={80} onChange={(e) => set("title", e.target.value)} placeholder="Happy hour de lunes a jueves" className="input-studio" />
        </Field>
        <div>
          <p className="mb-2 text-[12px] font-medium text-white/55">Descuento</p>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented value={d.kind} onChange={(v) => set("kind", v)} options={[{ value: "pct", label: "Porcentaje" }, { value: "clp", label: "Monto fijo" }]} />
            <label className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-lg font-semibold">
              {d.kind === "clp" && <span className="text-white/40">$</span>}
              <input inputMode="numeric" value={d.value} onChange={(e) => set("value", digitsOnly(e.target.value).slice(0, d.kind === "pct" ? 2 : 7))} placeholder="0" className="w-24 bg-transparent outline-none placeholder:text-white/25" />
              {d.kind === "pct" && <span className="text-white/40">%</span>}
            </label>
          </div>
        </div>
        {rooms.length > 0 && (
          <div>
            <p className="mb-2 text-[12px] font-medium text-white/55">Habitaciones · sin elegir ninguna, vale para todas</p>
            <div className="flex flex-wrap gap-2">
              {rooms.map((r) => (
                <ChipToggle key={r.id} active={d.roomIds.includes(r.id)} onClick={() => set("roomIds", d.roomIds.includes(r.id) ? d.roomIds.filter((x) => x !== r.id) : [...d.roomIds, r.id])}>
                  {r.name}
                </ChipToggle>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Desde (opcional)">
            <input type="datetime-local" value={d.startsAt} onChange={(e) => set("startsAt", e.target.value)} className="input-studio [color-scheme:dark]" />
          </Field>
          <Field label="Hasta (opcional)">
            <input type="datetime-local" value={d.endsAt} onChange={(e) => set("endsAt", e.target.value)} className="input-studio [color-scheme:dark]" />
          </Field>
        </div>
        <Field label="Detalle (opcional)" hint="Aparece en tu ficha bajo el título.">
          <textarea value={d.description} maxLength={500} onChange={(e) => set("description", e.target.value)} placeholder="Válido de lunes a jueves antes de las 18:00." className="input-studio min-h-[72px] resize-none" />
        </Field>
      </div>
    </Modal>
  );
}

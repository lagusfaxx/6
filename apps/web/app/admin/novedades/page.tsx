"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Pin, PinOff, Sparkles } from "lucide-react";
import { apiFetch, resolveMediaUrl } from "../../../lib/api";

/*
 * Orden de "Novedades" del inicio. Mover una tarjeta la deja fija en ese
 * lugar; las demás siguen saliendo solas, las más nuevas primero, en los
 * lugares libres. Una profesional que se publica después entra arriba y
 * corre a todas un lugar (la 1ª pasa a 2ª, la 2ª a 3ª…), sin que nadie
 * haga nada.
 */

type Card = {
  id: string;
  username: string;
  displayName: string;
  age: number | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  pinnedPos?: number | null;
};

type Pin = { id: string; pos: number };

const GENDERS = [
  { value: "FEMALE", label: "Mujeres" },
  { value: "MALE", label: "Hombres" },
  { value: "OTHER", label: "Trans" },
] as const;

export default function AdminNovedadesPage() {
  const [gender, setGender] = useState<string>("FEMALE");
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiFetch<{ profiles: Card[] }>(`/profiles/discover?sort=new&limit=12&gender=${gender}`);
      setCards(list.profiles || []);
    } catch {
      setError("No se pudo cargar Novedades.");
    } finally {
      setLoading(false);
    }
  }, [gender]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(next: Pin[]) {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/admin/home/novedades/pins", {
        method: "PUT",
        body: JSON.stringify({ gender, pins: next }),
      });
      await load();
    } catch {
      setError("No se pudo guardar el orden.");
    } finally {
      setSaving(false);
    }
  }

  /* Las fijadas tal como se ven ahora (ya corridas por las nuevas): al
     guardar, ese orden pasa a ser el punto de partida. */
  const currentPins = (): Pin[] =>
    cards.flatMap((c, i) => (c.pinnedPos != null ? [{ id: c.id, pos: i }] : []));

  /* La que se mueve queda fija en su nuevo lugar. Si ahí había otra fijada,
     esa pasa al lugar que se dejó libre (sigue fijada). */
  function move(from: number, to: number) {
    if (to < 0 || to >= cards.length) return;
    const moved = cards[from];
    const other = cards[to];
    const next = currentPins().filter((p) => p.id !== moved.id && p.id !== other.id);
    next.push({ id: moved.id, pos: to });
    if (other.pinnedPos != null) next.push({ id: other.id, pos: from });
    save(next);
  }

  function pinHere(index: number) {
    const c = cards[index];
    save([...currentPins().filter((p) => p.id !== c.id && p.pos !== index), { id: c.id, pos: index }]);
  }

  function release(id: string) {
    save(currentPins().filter((p) => p.id !== id));
  }

  const pinnedCount = cards.filter((c) => c.pinnedPos != null).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 text-white">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Link href="/admin" className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10">
          ← Admin
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Sparkles className="h-5 w-5 text-fuchsia-300" /> Orden de Novedades
        </h1>
      </div>
      <p className="text-sm text-white/55">
        Mueve una tarjeta y queda fija en ese lugar. Las demás siguen saliendo solas, las más nuevas primero. Cuando
        se publica una profesional nueva entra arriba y las que acomodaste bajan un lugar, sin perder su orden.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
          {GENDERS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setGender(g.value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                gender === g.value ? "bg-gradient-to-r from-fuchsia-600 to-violet-600 text-white" : "text-white/55 hover:text-white"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        {pinnedCount > 0 && (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (window.confirm("¿Soltar todas las fijadas? Novedades vuelve al orden automático.")) save([]);
            }}
            className="ml-auto rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/60 hover:bg-white/10 disabled:opacity-50"
          >
            Volver al orden automático
          </button>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</p>
      )}

      <ol className={`mt-4 space-y-2 ${saving ? "pointer-events-none opacity-60" : ""}`}>
        {loading ? (
          <p className="py-12 text-center text-sm text-white/45">Cargando…</p>
        ) : cards.length === 0 ? (
          <p className="py-12 text-center text-sm text-white/45">Sin perfiles en Novedades.</p>
        ) : (
          cards.map((c, i) => {
            const pinned = c.pinnedPos != null;
            return (
              <li
                key={c.id}
                className={`flex items-center gap-3 rounded-2xl border p-2.5 ${
                  pinned ? "border-fuchsia-500/35 bg-fuchsia-500/[0.06]" : "border-white/10 bg-white/[0.02]"
                }`}
              >
                <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-white/50">{i + 1}</span>
                <img
                  src={resolveMediaUrl(c.coverUrl || c.avatarUrl) || "/brand/isotipo-new.png"}
                  alt=""
                  className="h-14 w-11 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <a
                    href={`/profesional/${c.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm font-semibold hover:text-fuchsia-200"
                  >
                    {c.displayName}
                    {c.age ? <span className="ml-1 font-normal text-white/50">{c.age}</span> : null}
                  </a>
                  <span className={`text-[11px] ${pinned ? "text-fuchsia-300" : "text-white/40"}`}>
                    {pinned ? `Fijada en el lugar ${i + 1}` : "Automática (por fecha)"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Subir"
                    disabled={i === 0}
                    onClick={() => move(i, i - 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Bajar"
                    disabled={i === cards.length - 1}
                    onClick={() => move(i, i + 1)}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  {pinned ? (
                    <button
                      type="button"
                      aria-label="Soltar"
                      title="Soltar: vuelve al orden automático"
                      onClick={() => release(c.id)}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200 hover:bg-fuchsia-500/20"
                    >
                      <PinOff className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label="Fijar aquí"
                      title="Fijar en este lugar"
                      onClick={() => pinHere(i)}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/60 hover:bg-white/10"
                    >
                      <Pin className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ol>
    </div>
  );
}

import { prisma } from "../db";

/**
 * Orden manual de "Novedades" en el inicio. El admin mueve una tarjeta y esa
 * queda fijada en esa posición; el resto sigue saliendo como siempre (las
 * más nuevas primero) en los lugares libres. Las que se publican después de
 * que el admin acomodó entran arriba y empujan a todas: la que puso 1ª pasa
 * a 2ª, la 2ª a 3ª, y así. Se guarda en PlatformConfig, una lista por género
 * (el inicio de mujeres y el de hombres son distintos), con la fecha en que
 * se acomodó.
 */
export type NovedadPin = { id: string; pos: number };
export type NovedadesPinSet = { pins: NovedadPin[]; savedAt: Date };

/** Hasta dónde se puede fijar: Novedades muestra 12 tarjetas. */
export const NOVEDADES_SLOTS = 12;

const key = (gender: string) => `home_novedades_pins:${gender || "ALL"}`;

export async function getNovedadesPins(gender: string): Promise<NovedadesPinSet> {
  const row = await prisma.platformConfig.findUnique({ where: { key: key(gender) } }).catch(() => null);
  if (!row) return { pins: [], savedAt: new Date() };
  try {
    const raw = JSON.parse(row.value);
    const savedAt = new Date(raw?.savedAt ?? row.updatedAt);
    return {
      pins: sanitizePins(Array.isArray(raw) ? raw : raw?.pins),
      savedAt: Number.isNaN(savedAt.getTime()) ? row.updatedAt : savedAt,
    };
  } catch {
    return { pins: [], savedAt: new Date() };
  }
}

export async function setNovedadesPins(gender: string, pins: unknown): Promise<NovedadesPinSet> {
  const set = { pins: sanitizePins(pins), savedAt: new Date() };
  const value = JSON.stringify({ pins: set.pins, savedAt: set.savedAt.toISOString() });
  await prisma.platformConfig.upsert({
    where: { key: key(gender) },
    create: { key: key(gender), value },
    update: { value },
  });
  return set;
}

/* Un perfil por posición y una posición por perfil; la última gana. */
export function sanitizePins(raw: unknown): NovedadPin[] {
  if (!Array.isArray(raw)) return [];
  const byPos = new Map<number, string>();
  const seen = new Set<string>();
  for (const item of [...raw].reverse()) {
    const id = typeof item?.id === "string" ? item.id : "";
    const pos = Number(item?.pos);
    if (!id || !Number.isInteger(pos) || pos < 0 || pos >= NOVEDADES_SLOTS) continue;
    if (seen.has(id) || byPos.has(pos)) continue;
    seen.add(id);
    byPos.set(pos, id);
  }
  return [...byPos.entries()].map(([pos, id]) => ({ id, pos })).sort((a, b) => a.pos - b.pos);
}

/**
 * Arma la lista final: las fijadas en su posición, corridas hacia abajo una
 * por cada perfil publicado después de que se acomodó (`savedAt`), y el
 * orden natural en los huecos. Las fijadas que ya no se pueden mostrar
 * (p. ej. cuenta desactivada) simplemente no están en `pinned`; las que el
 * corrimiento deja fuera del largo de la lista dejan de salir.
 */
export function applyNovedadesPins<T extends { id: string; createdAt: Date | string }>(
  natural: T[],
  pinned: Map<string, T>,
  set: NovedadesPinSet,
  limit: number,
): Array<T & { pinnedPos: number | null }> {
  const pinnedIds = new Set(set.pins.filter((p) => pinned.has(p.id)).map((p) => p.id));
  const rest = natural.filter((p) => !pinnedIds.has(p.id));
  const shift = rest.filter((p) => new Date(p.createdAt).getTime() > set.savedAt.getTime()).length;
  const active = set.pins
    .filter((p) => pinnedIds.has(p.id))
    .map((p) => ({ id: p.id, pos: p.pos + shift }))
    .filter((p) => p.pos < limit);
  const total = Math.min(limit, rest.length + active.length);
  const out: Array<T & { pinnedPos: number | null }> = [];
  const slot = new Map(active.map((p) => [p.pos, p.id]));
  let r = 0;
  for (let i = 0; i < total; i++) {
    const id = slot.get(i);
    if (id) out.push({ ...pinned.get(id)!, pinnedPos: i });
    else if (r < rest.length) out.push({ ...rest[r++], pinnedPos: null });
  }
  /* Fijadas más allá del largo de la lista (había pocas para rellenar los
     huecos de antes): al final, en su orden. */
  for (const p of active) {
    if (p.pos >= total && out.length < limit) out.push({ ...pinned.get(p.id)!, pinnedPos: out.length });
  }
  return out;
}

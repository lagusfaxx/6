import { prisma } from "../db";

/**
 * Orden manual de "Novedades" en el inicio. El admin mueve una tarjeta y esa
 * queda fijada en esa posición; el resto sigue saliendo como siempre (las
 * más nuevas primero) en los lugares libres, así que una profesional nueva
 * aparece sola sin que nadie toque nada. Se guarda en PlatformConfig, una
 * lista por género (el inicio de mujeres y el de hombres son distintos).
 */
export type NovedadPin = { id: string; pos: number };

/** Hasta dónde se puede fijar: Novedades muestra 12 tarjetas. */
export const NOVEDADES_SLOTS = 12;

const key = (gender: string) => `home_novedades_pins:${gender || "ALL"}`;

export async function getNovedadesPins(gender: string): Promise<NovedadPin[]> {
  const row = await prisma.platformConfig.findUnique({ where: { key: key(gender) } }).catch(() => null);
  if (!row) return [];
  try {
    return sanitizePins(JSON.parse(row.value));
  } catch {
    return [];
  }
}

export async function setNovedadesPins(gender: string, pins: NovedadPin[]): Promise<NovedadPin[]> {
  const clean = sanitizePins(pins);
  await prisma.platformConfig.upsert({
    where: { key: key(gender) },
    create: { key: key(gender), value: JSON.stringify(clean) },
    update: { value: JSON.stringify(clean) },
  });
  return clean;
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
 * Arma la lista final: las fijadas en su posición (las que ya no se pueden
 * mostrar, p. ej. cuenta desactivada, simplemente no están en `pinned`) y
 * el orden natural en los huecos.
 */
export function applyNovedadesPins<T extends { id: string }>(
  natural: T[],
  pinned: Map<string, T>,
  pins: NovedadPin[],
  limit: number,
): Array<T & { pinnedPos: number | null }> {
  const active = pins.filter((p) => pinned.has(p.id));
  const pinnedIds = new Set(active.map((p) => p.id));
  const rest = natural.filter((p) => !pinnedIds.has(p.id));
  const total = Math.min(limit, rest.length + active.length);
  const out: Array<T & { pinnedPos: number | null }> = [];
  const slot = new Map(active.map((p) => [p.pos, p.id]));
  let r = 0;
  for (let i = 0; i < total; i++) {
    const id = slot.get(i);
    if (id) out.push({ ...pinned.get(id)!, pinnedPos: i });
    else if (r < rest.length) out.push({ ...rest[r++], pinnedPos: null });
  }
  /* Fijadas más allá del largo de la lista (había pocas nuevas): al final. */
  for (const p of active) {
    if (p.pos >= total && out.length < limit) out.push({ ...pinned.get(p.id)!, pinnedPos: p.pos });
  }
  return out;
}

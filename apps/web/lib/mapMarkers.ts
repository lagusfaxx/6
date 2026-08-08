/**
 * Utilidades compartidas para los mapas con pines de perfiles (/cerca y el
 * mapa del home). Vive aparte para que ambas vistas usen exactamente el mismo
 * criterio de dispersión y no se dupliquen las constantes.
 */

/**
 * Despliega en anillos los pines que caen casi en el mismo punto para que no se
 * tapen. Solo mueve la posición visual (displayLat/Lng); el área real de cada
 * perfil sigue usando realLat/realLng.
 */
export function spreadOverlapping<T extends { lat: number; lng: number }>(
  items: T[],
): (T & { displayLat: number; displayLng: number })[] {
  const CELL = 0.0014; // ~150 m
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = `${Math.round(item.lat / CELL)}:${Math.round(item.lng / CELL)}`;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  const result: (T & { displayLat: number; displayLng: number })[] = [];
  groups.forEach((group) => {
    if (group.length === 1) {
      const m = group[0];
      result.push({ ...m, displayLat: m.lat, displayLng: m.lng });
      return;
    }
    const perRing = 6;
    group.forEach((m, i) => {
      const ring = Math.floor(i / perRing);
      const countInRing = Math.min(perRing, group.length - ring * perRing);
      const idxInRing = i % perRing;
      const radius = 0.0011 * (ring + 1); // ~120 m por anillo
      const angle = (2 * Math.PI * idxInRing) / countInRing + ring * 0.6;
      result.push({
        ...m,
        displayLat: m.lat + radius * Math.cos(angle),
        displayLng: m.lng + (radius * Math.sin(angle)) / Math.max(0.2, Math.cos((m.lat * Math.PI) / 180)),
      });
    });
  });
  return result;
}

/** Diamond/Gold primero, luego el resto: se usa para ordenar tarjetas y pines. */
export function tierOrder(level?: string | null) {
  if (level === "DIAMOND") return 0;
  if (level === "GOLD") return 1;
  return 2;
}

export function formatDistance(distance: number | null | undefined) {
  if (distance == null || !Number.isFinite(distance)) return null;
  if (distance < 1) return `${Math.round(distance * 1000)} m`;
  return `${distance.toFixed(1)} km`;
}

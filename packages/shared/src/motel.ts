/**
 * Comodidades de moteles y hoteles por hora. Son una lista cerrada para que el
 * directorio pueda filtrar ("con jacuzzi", "con estacionamiento") y para que la
 * ficha muestre siempre el mismo ícono y el mismo texto.
 *
 * Las del local se guardan en `User.profileTags` (claves de MOTEL_AMENITIES);
 * las de cada habitación en `MotelRoom.amenities` (claves de ROOM_AMENITIES).
 * Las habitaciones viejas pueden traer texto libre: se muestra tal cual.
 */
export type AmenityOption = { key: string; label: string };

export const MOTEL_AMENITIES: readonly AmenityOption[] = [
  { key: "estacionamiento", label: "Estacionamiento privado" },
  { key: "ingreso-discreto", label: "Ingreso discreto" },
  { key: "24-horas", label: "Abierto 24 horas" },
  { key: "jacuzzi", label: "Habitaciones con jacuzzi" },
  { key: "tematicas", label: "Habitaciones temáticas" },
  { key: "room-service", label: "Room service" },
  { key: "wifi", label: "WiFi" },
  { key: "tv-cable", label: "TV cable" },
  { key: "aire", label: "Aire acondicionado" },
  { key: "tarjeta", label: "Pago con tarjeta" },
  { key: "transferencia", label: "Pago con transferencia" },
  { key: "piscina", label: "Piscina" },
] as const;

export const ROOM_AMENITIES: readonly AmenityOption[] = [
  { key: "jacuzzi", label: "Jacuzzi" },
  { key: "sauna", label: "Sauna" },
  { key: "ducha-doble", label: "Ducha doble" },
  { key: "sillon-tantrico", label: "Sillón tántrico" },
  { key: "pole", label: "Pole" },
  { key: "espejos", label: "Espejos" },
  { key: "tv", label: "TV" },
  { key: "sonido", label: "Sistema de sonido" },
  { key: "aire", label: "Aire acondicionado" },
  { key: "frigobar", label: "Frigobar" },
  { key: "cama-king", label: "Cama king" },
  { key: "estacionamiento", label: "Estacionamiento propio" },
] as const;

export const ROOM_TYPES = ["Estándar", "Suite", "Suite con jacuzzi", "VIP", "Temática"] as const;

const MOTEL_KEYS = new Set(MOTEL_AMENITIES.map((a) => a.key));
const ROOM_KEYS = new Set(ROOM_AMENITIES.map((a) => a.key));

/** Deja sólo claves conocidas, sin repetir. */
export function cleanMotelAmenities(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((v) => String(v)).filter((v) => MOTEL_KEYS.has(v))));
}

/** Claves conocidas de habitación; el texto libre viejo se conserva (máx. 40 letras). */
export function cleanRoomAmenities(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out = values
    .map((v) => String(v ?? "").trim())
    .filter(Boolean)
    .map((v) => (ROOM_KEYS.has(v) ? v : v.slice(0, 40)));
  return Array.from(new Set(out)).slice(0, 20);
}

export function amenityLabel(key: string, list: readonly AmenityOption[] = ROOM_AMENITIES): string {
  return list.find((a) => a.key === key)?.label ?? key;
}

export const MOTEL_DURATIONS = [
  { key: "3H", label: "3 horas", short: "3 h" },
  { key: "6H", label: "6 horas", short: "6 h" },
  { key: "NIGHT", label: "Noche", short: "noche" },
] as const;
export type MotelDuration = (typeof MOTEL_DURATIONS)[number]["key"];

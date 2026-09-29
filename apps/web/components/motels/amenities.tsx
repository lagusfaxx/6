import {
  AirVent,
  Armchair,
  Bath,
  BedDouble,
  Car,
  Clock,
  ConciergeBell,
  CreditCard,
  EyeOff,
  Flame,
  Frame,
  Landmark,
  Refrigerator,
  ShowerHead,
  Sparkles,
  Speaker,
  Tv,
  Waves,
  Wifi,
  Zap,
  Check,
  type LucideIcon,
} from "lucide-react";
import { MOTEL_AMENITIES, ROOM_AMENITIES } from "@uzeed/shared/motel";

const ICONS: Record<string, LucideIcon> = {
  estacionamiento: Car,
  "ingreso-discreto": EyeOff,
  "24-horas": Clock,
  jacuzzi: Bath,
  tematicas: Sparkles,
  "room-service": ConciergeBell,
  wifi: Wifi,
  "tv-cable": Tv,
  tv: Tv,
  aire: AirVent,
  tarjeta: CreditCard,
  transferencia: Landmark,
  piscina: Waves,
  sauna: Flame,
  "ducha-doble": ShowerHead,
  "sillon-tantrico": Armchair,
  pole: Zap,
  espejos: Frame,
  sonido: Speaker,
  frigobar: Refrigerator,
  "cama-king": BedDouble,
};

export function amenityIcon(key: string): LucideIcon {
  return ICONS[key] || Check;
}

export function motelAmenityLabel(key: string) {
  return MOTEL_AMENITIES.find((a) => a.key === key)?.label ?? key;
}

export function roomAmenityLabel(key: string) {
  return ROOM_AMENITIES.find((a) => a.key === key)?.label ?? key;
}

/** Filtros del directorio: lo que la gente busca de verdad. */
export const DIRECTORY_AMENITY_FILTERS: Array<{ key: string; label: string }> = [
  { key: "jacuzzi", label: "Jacuzzi" },
  { key: "estacionamiento", label: "Estacionamiento" },
  { key: "24-horas", label: "24 horas" },
  { key: "tematicas", label: "Temáticas" },
  { key: "sauna", label: "Sauna" },
  { key: "tarjeta", label: "Pago con tarjeta" },
];

/** ¿El motel tiene esta comodidad (en el local o en alguna habitación)? */
export function motelHas(m: { amenities: string[]; roomAmenities: string[] }, key: string) {
  return m.amenities.includes(key) || m.roomAmenities.includes(key);
}

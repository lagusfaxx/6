export type Room = {
  id: string;
  name: string;
  description: string | null;
  roomType: string | null;
  amenities: string[];
  photoUrls: string[];
  price3h: number | null;
  price6h: number | null;
  priceNight: number | null;
  isActive: boolean;
};

export type Promo = {
  id: string;
  title: string;
  description: string | null;
  discountPercent: number | null;
  discountClp: number | null;
  roomIds: string[];
  roomId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
};

export type Booking = {
  id: string;
  status: "PENDIENTE" | "ACEPTADA" | "CONFIRMADA" | "RECHAZADA" | "FINALIZADA" | "CANCELADA";
  durationType: string;
  priceClp: number;
  basePriceClp: number | null;
  discountClp: number | null;
  startAt: string | null;
  note: string | null;
  clientId: string;
  clientName: string | null;
  clientUsername: string | null;
  roomName: string | null;
  confirmationCode: string | null;
  createdAt: string;
};

export type MotelProfile = {
  id: string;
  username: string;
  displayName: string | null;
  address: string | null;
  phone: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  coverUrl: string | null;
  avatarUrl: string | null;
  rules: string | null;
  schedule: string | null;
  isVerified: boolean;
  isActive: boolean;
  isOpen: boolean;
  isPublished: boolean;
  amenities: string[];
  gallery: Array<{ id: string; url: string }>;
  publicSlug: string;
};

export type Dashboard = { profile: MotelProfile; rooms: Room[]; promotions: Promo[]; bookings: Booking[] };

export type Notify = (text: string, tone?: "ok" | "error") => void;

export const STATUS: Record<Booking["status"], { label: string; className: string }> = {
  PENDIENTE: { label: "Por aceptar", className: "border-amber-400/30 bg-amber-500/15 text-amber-200" },
  ACEPTADA: { label: "Esperando al cliente", className: "border-sky-400/30 bg-sky-500/15 text-sky-200" },
  CONFIRMADA: { label: "Confirmada", className: "border-emerald-400/30 bg-emerald-500/15 text-emerald-200" },
  FINALIZADA: { label: "Finalizada", className: "border-white/10 bg-white/5 text-white/55" },
  RECHAZADA: { label: "Rechazada", className: "border-red-400/30 bg-red-500/10 text-red-200" },
  CANCELADA: { label: "Cancelada", className: "border-white/10 bg-white/5 text-white/40" },
};

export const DURATION: Record<string, string> = { "3H": "3 horas", "6H": "6 horas", NIGHT: "Noche" };

/* Fecha local YYYY-MM-DD: toISOString() la da en UTC y en Chile corre el día. */
export function localDateKey(value: Date | string) {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${localDateKey(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function dayLabel(iso: string | null) {
  if (!iso) return "Sin hora";
  const d = new Date(iso);
  const today = localDateKey(new Date());
  const tomorrow = localDateKey(new Date(Date.now() + 86400000));
  const key = localDateKey(d);
  if (key === today) return "Hoy";
  if (key === tomorrow) return "Mañana";
  return d.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });
}

export function timeLabel(iso: string | null) {
  if (!iso) return "Hora por confirmar";
  return new Date(iso).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}

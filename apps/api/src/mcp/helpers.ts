import { z } from "zod";
import { prisma } from "../db";
import { isUUID } from "../lib/validators";

/** Todas las fechas que ve o pide Claude se entienden en hora de Chile. */
export const TZ = "America/Santiago";

const MS_DAY = 24 * 60 * 60 * 1000;

/**
 * Campos que nunca salen por el MCP, vengan de una herramienta o de una
 * consulta SQL libre: credenciales, secretos de 2FA y claves de push.
 */
const REDACTED_KEYS = new Set([
  "passwordhash",
  "passwordsettoken",
  "twofactorsecret",
  "twofactorlastusedstep",
  "tokenhash",
  "p256dh",
  "auth",
  "flowtoken",
  "sess",
]);

function redactValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return Number.isSafeInteger(Number(value)) ? Number(value) : value.toString();
  }
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(redactValue);
  // Prisma.Decimal y similares traen su propio toJSON.
  if (typeof (value as { toJSON?: unknown }).toJSON === "function") {
    return (value as { toJSON: () => unknown }).toJSON();
  }
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key.toLowerCase())) {
      out[key] = "[oculto]";
      continue;
    }
    out[key] = redactValue(val);
  }
  return out;
}

export function sanitize<T>(value: T): unknown {
  return redactValue(value);
}

export type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

export function jsonResult(data: unknown): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(sanitize(data), null, 2) }] };
}

export function errorResult(message: string): ToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

/** Minutos que Chile está corrido de UTC en ese instante (-180 o -240). */
function tzOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wallAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((wallAsUtc - date.getTime()) / 60000);
}

/** Medianoche en Chile de una fecha "YYYY-MM-DD". */
export function chileMidnight(ymd: string): Date {
  const guess = new Date(`${ymd}T00:00:00Z`);
  return new Date(guess.getTime() - tzOffsetMinutes(guess) * 60000);
}

/** Fecha de hoy en Chile como "YYYY-MM-DD". */
export function chileToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(now);
}

function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const PERIOD_PRESETS = [
  "hoy",
  "ayer",
  "7d",
  "30d",
  "90d",
  "365d",
  "semana_actual",
  "mes_actual",
  "mes_anterior",
  "anio_actual",
] as const;

/** Campos comunes para cualquier herramienta que trabaja sobre un rango de fechas. */
export const periodShape = {
  periodo: z
    .enum(PERIOD_PRESETS)
    .optional()
    .describe("Atajo de periodo. Se ignora si se envían desde/hasta. Por defecto: 30d."),
  desde: z.string().regex(DATE_RE).optional().describe("Fecha inicial YYYY-MM-DD (hora de Chile, inclusive)."),
  hasta: z.string().regex(DATE_RE).optional().describe("Fecha final YYYY-MM-DD (hora de Chile, inclusive). Por defecto hoy."),
};

export type PeriodInput = {
  periodo?: (typeof PERIOD_PRESETS)[number];
  desde?: string;
  hasta?: string;
};

export type Period = {
  from: Date;
  to: Date;
  label: string;
  days: number;
  /** Periodo inmediatamente anterior y del mismo largo, para comparar. */
  previous: { from: Date; to: Date };
};

export function resolvePeriod(input: PeriodInput): Period {
  const today = chileToday();
  let fromYmd: string;
  let toYmd: string; // inclusive

  if (input.desde || input.hasta) {
    toYmd = input.hasta || today;
    fromYmd = input.desde || addDaysYmd(toYmd, -29);
  } else {
    const preset = input.periodo || "30d";
    toYmd = today;
    switch (preset) {
      case "hoy":
        fromYmd = today;
        break;
      case "ayer":
        fromYmd = toYmd = addDaysYmd(today, -1);
        break;
      case "7d":
        fromYmd = addDaysYmd(today, -6);
        break;
      case "90d":
        fromYmd = addDaysYmd(today, -89);
        break;
      case "365d":
        fromYmd = addDaysYmd(today, -364);
        break;
      case "semana_actual": {
        const dow = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = domingo
        fromYmd = addDaysYmd(today, -((dow + 6) % 7));
        break;
      }
      case "mes_actual":
        fromYmd = `${today.slice(0, 7)}-01`;
        break;
      case "mes_anterior": {
        const firstThisMonth = `${today.slice(0, 7)}-01`;
        toYmd = addDaysYmd(firstThisMonth, -1);
        fromYmd = `${toYmd.slice(0, 7)}-01`;
        break;
      }
      case "anio_actual":
        fromYmd = `${today.slice(0, 4)}-01-01`;
        break;
      default:
        fromYmd = addDaysYmd(today, -29);
    }
  }

  if (fromYmd > toYmd) [fromYmd, toYmd] = [toYmd, fromYmd];

  const from = chileMidnight(fromYmd);
  const to = chileMidnight(addDaysYmd(toYmd, 1));
  const span = to.getTime() - from.getTime();
  return {
    from,
    to,
    label: fromYmd === toYmd ? fromYmd : `${fromYmd} a ${toYmd}`,
    days: Math.round(span / MS_DAY),
    previous: { from: new Date(from.getTime() - span), to: from },
  };
}

export function describePeriod(period: Period) {
  return {
    rango: period.label,
    dias: period.days,
    zonaHoraria: TZ,
    desdeUtc: period.from.toISOString(),
    hastaUtc: period.to.toISOString(),
  };
}

/** Variación porcentual redondeada a un decimal; null si no hay base. */
export function deltaPct(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Busca un usuario por id, username o email. */
export async function findUserRef(ref: string) {
  const value = ref.trim().replace(/^@/, "");
  if (!value) return null;
  // Boolean aparte: el type guard de isUUID dejaría `value` como never.
  const byId: boolean = isUUID(value);
  const where = byId ? { id: value } : value.includes("@") ? { email: value.toLowerCase() } : { username: value };
  let user = await prisma.user.findUnique({ where: where as any, select: { id: true } });
  if (!user && !byId) {
    user = await prisma.user.findFirst({
      where: { username: { equals: value, mode: "insensitive" } },
      select: { id: true },
    });
  }
  return user?.id ?? null;
}

export const PROFILE_TYPES = ["CLIENT", "VIEWER", "CREATOR", "PROFESSIONAL", "ESTABLISHMENT", "SHOP"] as const;
export const TIERS = ["PREMIUM", "GOLD", "SILVER"] as const;

import { z } from "zod";
import { prisma } from "../db";
import { isUUID } from "../lib/validators";
import { CHILE_TZ, addDaysYmd, chileMidnight, chileToday } from "../lib/chileTime";

export { chileMidnight, chileToday };

/** Todas las fechas que ve o pide Claude se entienden en hora de Chile. */
export const TZ = CHILE_TZ;

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
  /** Fin exclusivo. Si el periodo incluye hoy, es "ahora" y no la medianoche. */
  to: Date;
  label: string;
  days: number;
  /** true si el periodo todavía no termina (incluye hoy). */
  inProgress: boolean;
  /**
   * Periodo con el que se compara, del mismo largo efectivo. Si el periodo
   * está en curso se compara hasta la misma hora ("hoy hasta las 15:00" contra
   * "ayer hasta las 15:00"), para no enfrentar un día a medias con uno entero.
   * Los meses se comparan contra el mes anterior desde su día 1.
   */
  previous: { from: Date; to: Date; label: string };
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

  const now = new Date();
  const from = chileMidnight(fromYmd);
  const fullTo = chileMidnight(addDaysYmd(toYmd, 1));
  const inProgress = fullTo.getTime() > now.getTime() && from.getTime() <= now.getTime();
  const to = inProgress ? now : fullTo;
  const span = to.getTime() - from.getTime();

  const calendarMonth =
    !input.desde && !input.hasta && (input.periodo === "mes_actual" || input.periodo === "mes_anterior");
  let prevFrom: Date;
  if (calendarMonth) {
    const [y, m] = fromYmd.split("-").map(Number);
    const prevMonth = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, "0")}-01`;
    prevFrom = chileMidnight(prevMonth);
  } else {
    prevFrom = new Date(from.getTime() - (fullTo.getTime() - from.getTime()));
  }
  let prevTo = new Date(prevFrom.getTime() + span);
  // Un mes anterior más corto no se come días del mes siguiente.
  if (prevTo.getTime() > from.getTime()) prevTo = from;
  const fmt = (d: Date) => chileToday(d);

  return {
    from,
    to,
    label: (fromYmd === toYmd ? fromYmd : `${fromYmd} a ${toYmd}`) + (inProgress ? " (en curso, hasta ahora)" : ""),
    days: Math.max(1, Math.round((fullTo.getTime() - from.getTime()) / MS_DAY)),
    inProgress,
    previous: {
      from: prevFrom,
      to: prevTo,
      label: `${fmt(prevFrom)} a ${fmt(new Date(prevTo.getTime() - 1))}`,
    },
  };
}

export function describePeriod(period: Period) {
  return {
    rango: period.label,
    dias: period.days,
    enCurso: period.inProgress,
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

/**
 * Comparación completa de un indicador. Con bases chicas el % engaña (de 2 a
 * 4 es +100%), así que se marca como poco significativa bajo 20 casos.
 */
export function compare(current: number, previous: number) {
  return {
    actual: current,
    anterior: previous,
    diferencia: Math.round((current - previous) * 100) / 100,
    variacionPct: deltaPct(current, previous),
    baseChica: Math.max(current, previous) < 20 || undefined,
  };
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

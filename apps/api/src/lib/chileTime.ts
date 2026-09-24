/**
 * Fechas en hora de Chile. El servidor corre en UTC, así que `setHours(0)`
 * da la medianoche de Londres, no la de Santiago: "hoy" quedaba corrido 3 o
 * 4 horas (según horario de verano). Todo lo que diga "hoy", "ayer" o un día
 * calendario en estadísticas debe salir de aquí.
 */
export const CHILE_TZ = "America/Santiago";

const MS_DAY = 24 * 60 * 60 * 1000;

/** Minutos que Chile está corrido de UTC en ese instante (-180 o -240). */
function tzOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHILE_TZ,
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

/**
 * Primer instante del día "YYYY-MM-DD" en Chile. En Chile el cambio de
 * horario ocurre justo a medianoche (en septiembre las 00:00 no existen y el
 * día parte a la 01:00), así que en vez de restar un offset se busca el
 * primer cuarto de hora UTC cuya fecha local ya es ese día.
 */
export function chileMidnight(ymd: string): Date {
  const base = new Date(`${ymd}T00:00:00Z`).getTime();
  const guess = base - tzOffsetMinutes(new Date(base)) * 60000;
  for (let t = guess - 2 * 3600000; t <= guess + 2 * 3600000; t += 15 * 60000) {
    if (chileToday(new Date(t)) === ymd) return new Date(t);
  }
  return new Date(guess);
}

/** Fecha de hoy en Chile como "YYYY-MM-DD". */
export function chileToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: CHILE_TZ }).format(now);
}

export function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inicio del día de hoy en Chile, como instante UTC. */
export function chileStartOfToday(now = new Date()): Date {
  return chileMidnight(chileToday(now));
}

/** Inicio del día de ayer en Chile (no siempre es hoy − 24 h: cambio de horario). */
export function chileStartOfYesterday(now = new Date()): Date {
  return chileMidnight(addDaysYmd(chileToday(now), -1));
}

export { MS_DAY };

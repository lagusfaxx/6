import { prisma } from "../../db";
import { config } from "../../config";
import { emitAdminEvent } from "../../lib/adminEvents";
import { sendAdminStatsEmail, escapeHtml } from "../../lib/notificationEmail";
import { resolvePeriod, type PeriodInput } from "../helpers";
import { METRIC_LABELS, metricSet, type Filtros } from "./core";

/**
 * Alertas configurables. Cada hora el worker evalúa las activas; una alerta
 * que se cumple avisa a los administradores (notificación en el panel y
 * correo si está marcado) y no se repite durante 24 h.
 *
 * Tipos:
 *  - metrica: una métrica del set base contra un umbral ("valor") o contra
 *    su variación % respecto del periodo anterior ("variacion_pct").
 *  - perfiles_sin_actualizar: perfiles del top N por vistas del periodo sin
 *    editar la ficha hace más de `threshold` días.
 *  - vistas_sin_contactos: perfiles con al menos `threshold` vistas y 0
 *    contactos en el periodo.
 */

export const ALERT_KINDS = ["metrica", "perfiles_sin_actualizar", "vistas_sin_contactos"] as const;
export const ALERT_PERIODS = ["hoy", "24h", "7d", "30d"] as const;
export const ALERT_METRICS = Object.keys(METRIC_LABELS);

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

function periodFor(period: string): { from: Date; to: Date; previous: { from: Date; to: Date }; label: string } {
  if (period === "24h") {
    const to = new Date();
    const from = new Date(to.getTime() - 24 * 3600 * 1000);
    return { from, to, previous: { from: new Date(from.getTime() - 24 * 3600 * 1000), to: from }, label: "últimas 24 horas" };
  }
  const p = resolvePeriod({ periodo: period as PeriodInput["periodo"] });
  return { from: p.from, to: p.to, previous: p.previous, label: p.label };
}

export type AlertResult = { fired: boolean; value: number | null; detail: string; items?: unknown[] };

export async function evaluateAlert(alert: {
  kind: string;
  metric: string | null;
  comparison: string | null;
  direction: string | null;
  threshold: number | null;
  period: string;
  filters: unknown;
}): Promise<AlertResult> {
  const f = (alert.filters ?? {}) as Filtros;
  const p = periodFor(alert.period);
  const th = alert.threshold ?? 0;

  if (alert.kind === "metrica") {
    if (!alert.metric || !ALERT_METRICS.includes(alert.metric)) return { fired: false, value: null, detail: "métrica desconocida" };
    const cur = await metricSet(p, f);
    const value = cur[alert.metric] ?? 0;
    if (alert.comparison === "variacion_pct") {
      const prev = await metricSet(p.previous, f);
      const before = prev[alert.metric] ?? 0;
      if (before < 20) return { fired: false, value: null, detail: `base chica (${before} en el periodo anterior): no se evalúa` };
      const pct = Math.round(((value - before) / before) * 1000) / 10;
      const fired = alert.direction === "mayor" ? pct >= th : pct <= th;
      return { fired, value: pct, detail: `${METRIC_LABELS[alert.metric]}: ${value} vs ${before} (${pct > 0 ? "+" : ""}${pct}%) en ${p.label}` };
    }
    const fired = alert.direction === "mayor" ? value >= th : value <= th;
    return { fired, value, detail: `${METRIC_LABELS[alert.metric]}: ${value} en ${p.label} (umbral ${alert.direction === "mayor" ? "≥" : "≤"} ${th})` };
  }

  if (alert.kind === "perfiles_sin_actualizar") {
    const days = th || 30;
    const rows = await prisma.$queryRaw<{ username: string; vistas: number; lastEditedAt: Date | null }[]>`
      WITH top AS (
        SELECT split_part(pv."path", '/', 3) AS ref, COUNT(*)::int AS vistas FROM "PageView" pv
        WHERE pv."path" LIKE '/profesional/%' AND pv."createdAt" >= ${p.from} AND pv."createdAt" < ${p.to} AND pv."path" NOT LIKE '/admin%'
        GROUP BY 1 ORDER BY 2 DESC LIMIT 20
      )
      SELECT u."username", top.vistas, u."lastEditedAt" FROM top JOIN "User" u ON top.ref IN (u."id"::text, u."username")
      WHERE u."isActive" AND u."isVerified" AND (u."lastEditedAt" IS NULL OR u."lastEditedAt" < now() - make_interval(days => ${days}::int))
      ORDER BY top.vistas DESC`;
    return { fired: rows.length > 0, value: rows.length, detail: `${rows.length} perfil(es) del top 20 por vistas sin actualizar hace más de ${days} días`, items: rows };
  }

  if (alert.kind === "vistas_sin_contactos") {
    const minViews = th || 20;
    const rows = await prisma.$queryRaw<{ username: string; vistas: number }[]>`
      WITH v AS (
        SELECT split_part(pv."path", '/', 3) AS ref, COUNT(*)::int AS vistas FROM "PageView" pv
        WHERE pv."path" LIKE '/profesional/%' AND pv."createdAt" >= ${p.from} AND pv."createdAt" < ${p.to} AND pv."path" NOT LIKE '/admin%'
        GROUP BY 1 HAVING COUNT(*) >= ${minViews}
      )
      SELECT u."username", v.vistas FROM v JOIN "User" u ON v.ref IN (u."id"::text, u."username")
      WHERE u."isActive" AND u."isVerified"
        AND NOT EXISTS (SELECT 1 FROM "UserAction" ua WHERE ua."targetId" = u."id" AND ua."action" IN ('whatsapp_click','phone_click') AND ua."createdAt" >= ${p.from} AND ua."createdAt" < ${p.to})
        AND NOT EXISTS (SELECT 1 FROM "Message" m WHERE m."toId" = u."id" AND m."createdAt" >= ${p.from} AND m."createdAt" < ${p.to})
      ORDER BY v.vistas DESC LIMIT 50`;
    return { fired: rows.length > 0, value: rows.length, detail: `${rows.length} perfil(es) con ≥ ${minViews} vistas y 0 contactos en ${p.label}`, items: rows };
  }

  return { fired: false, value: null, detail: "tipo desconocido" };
}

async function adminEmails(): Promise<string[]> {
  const admins = await prisma.user.findMany({ where: { OR: [{ role: "ADMIN" }, { email: config.adminEmail }] }, select: { email: true } });
  return [...new Set(admins.map((a) => a.email))];
}

/** Evalúa todas las alertas activas; devuelve cuántas se dispararon. */
export async function runStatsAlerts(): Promise<number> {
  const alerts = await prisma.statsAlert.findMany({ where: { enabled: true } });
  let fired = 0;
  for (const alert of alerts) {
    try {
      const result = await evaluateAlert(alert);
      const now = new Date();
      const inCooldown = alert.lastFiredAt && now.getTime() - alert.lastFiredAt.getTime() < COOLDOWN_MS;
      await prisma.statsAlert.update({
        where: { id: alert.id },
        data: { lastCheckedAt: now, lastValue: result.value, ...(result.fired && !inCooldown ? { lastFiredAt: now } : {}) },
      });
      if (!result.fired || inCooldown) continue;
      fired++;
      await emitAdminEvent({ type: "stats_alert", user: `${alert.name}: ${result.detail}` }).catch(() => {});
      if (alert.notifyEmail) {
        const rows = [
          `<strong>${escapeHtml(alert.name)}</strong>`,
          escapeHtml(result.detail),
          ...(result.items?.length ? [escapeHtml((result.items as { username: string }[]).slice(0, 10).map((i) => "@" + i.username).join(", "))] : []),
          "Revisa el panel para el detalle.",
        ];
        for (const to of await adminEmails()) await sendAdminStatsEmail(to, `Alerta UZEED: ${alert.name}`, "Alerta de estadísticas", rows).catch(() => {});
      }
    } catch (err: any) {
      console.error(`[stats/alerts] ${alert.name}:`, err?.message || err);
    }
  }
  return fired;
}

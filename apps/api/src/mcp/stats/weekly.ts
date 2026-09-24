import { prisma } from "../../db";
import { config } from "../../config";
import { sendAdminStatsEmail, escapeHtml } from "../../lib/notificationEmail";
import { resolvePeriod } from "../helpers";
import { METRIC_LABELS, compareSets, metricSet } from "./core";

/**
 * Informe semanal automático por correo (lunes 09:00 Chile): KPIs de los
 * últimos 7 días contra los 7 anteriores, top 5 perfiles por contactos y
 * las listas de alerta. Se activa con configurar_informe_semanal (queda en
 * PlatformConfig) y se puede mandar a mano con enviar_ahora.
 */

const KEY_ENABLED = "stats_weekly_email";
const KEY_RECIPIENTS = "stats_weekly_recipients";

export async function weeklyConfig(): Promise<{ enabled: boolean; recipients: string[] }> {
  const rows = await prisma.platformConfig.findMany({ where: { key: { in: [KEY_ENABLED, KEY_RECIPIENTS] } } });
  const enabled = rows.find((r) => r.key === KEY_ENABLED)?.value === "on";
  const raw = rows.find((r) => r.key === KEY_RECIPIENTS)?.value || "";
  let recipients = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (!recipients.length) {
    const admins = await prisma.user.findMany({ where: { OR: [{ role: "ADMIN" }, { email: config.adminEmail }] }, select: { email: true } });
    recipients = [...new Set(admins.map((a) => a.email))];
  }
  return { enabled, recipients };
}

export async function setWeeklyConfig(input: { enabled?: boolean; recipients?: string[] }) {
  if (input.enabled !== undefined) {
    await prisma.platformConfig.upsert({ where: { key: KEY_ENABLED }, update: { value: input.enabled ? "on" : "off" }, create: { key: KEY_ENABLED, value: input.enabled ? "on" : "off" } });
  }
  if (input.recipients !== undefined) {
    const value = input.recipients.join(",");
    await prisma.platformConfig.upsert({ where: { key: KEY_RECIPIENTS }, update: { value }, create: { key: KEY_RECIPIENTS, value } });
  }
  return weeklyConfig();
}

const fmt = (n: number) => n.toLocaleString("es-CL");
const sign = (n: number | null) => (n == null ? "—" : `${n > 0 ? "+" : ""}${n}%`);

export async function buildWeeklyReport() {
  const period = resolvePeriod({ periodo: "7d" });
  const [cur, prev] = await Promise.all([metricSet(period, {}), metricSet(period.previous, {})]);
  const cmp = compareSets(cur, prev);
  const top = await prisma.$queryRaw<{ username: string; contactos: number }[]>`
    SELECT u."username", COUNT(DISTINCT (COALESCE(ua."userId"::text, ua."visitorId", ua."sessionId", ua."id"::text) || to_char(ua."createdAt", 'YYYY-MM-DD')))::int AS contactos
    FROM "UserAction" ua JOIN "User" u ON u."id" = ua."targetId"
    WHERE ua."action" IN ('whatsapp_click','phone_click') AND ua."createdAt" >= ${period.from} AND ua."createdAt" < ${period.to}
    GROUP BY 1 ORDER BY 2 DESC LIMIT 5`;
  const [stale, noContacts] = await Promise.all([
    prisma.user.count({ where: { isActive: true, isVerified: true, profileType: "PROFESSIONAL", OR: [{ lastEditedAt: { lt: new Date(Date.now() - 30 * 86400000) } }, { lastEditedAt: null }] } }),
    prisma.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM (
        SELECT split_part(pv."path", '/', 3) AS ref FROM "PageView" pv
        WHERE pv."path" LIKE '/profesional/%' AND pv."createdAt" >= ${period.from} AND pv."createdAt" < ${period.to} GROUP BY 1 HAVING COUNT(*) >= 10
      ) v JOIN "User" u ON v.ref IN (u."id"::text, u."username")
      WHERE NOT EXISTS (SELECT 1 FROM "UserAction" ua WHERE ua."targetId" = u."id" AND ua."action" IN ('whatsapp_click','phone_click') AND ua."createdAt" >= ${period.from} AND ua."createdAt" < ${period.to})`,
  ]);
  const order = ["visitantes", "visitas", "vistasFichas", "contactosWhatsapp", "contactosTelefono", "mensajesRecibidos", "registrosOrganicos", "ingresosClp", "tasaContactoPct"];
  return {
    periodo: period.label,
    periodoAnterior: period.previous.label,
    kpis: order.map((k) => ({ metrica: METRIC_LABELS[k] ?? k, actual: cur[k] ?? 0, anterior: prev[k] ?? 0, variacionPct: cmp[k]?.variacionPct ?? null })),
    topContactos: top,
    alertas: { perfilesSinActualizar30d: stale, conVistasSinContactos: noContacts[0]?.n ?? 0 },
  };
}

export async function sendWeeklyReport(to?: string[]): Promise<{ enviados: string[]; informe: Awaited<ReturnType<typeof buildWeeklyReport>> }> {
  const cfg = await weeklyConfig();
  const recipients = to?.length ? to : cfg.recipients;
  const report = await buildWeeklyReport();
  const rows = [
    `Semana ${escapeHtml(report.periodo)} vs ${escapeHtml(report.periodoAnterior)}.`,
    ...report.kpis.map((k) => `<strong>${escapeHtml(k.metrica)}</strong>: ${fmt(k.actual)} (${sign(k.variacionPct)}, antes ${fmt(k.anterior)})`),
    `<strong>Top contactos:</strong> ${escapeHtml(report.topContactos.map((t) => `@${t.username} (${t.contactos})`).join(", ") || "sin datos")}`,
    `<strong>Alertas:</strong> ${report.alertas.perfilesSinActualizar30d} perfiles sin actualizar hace 30+ días · ${report.alertas.conVistasSinContactos} con vistas y sin contactos.`,
    `Pídele a Claude el informe completo: "Dame el informe semanal".`,
  ];
  for (const email of recipients) await sendAdminStatsEmail(email, "Informe semanal UZEED", "Informe semanal", rows);
  return { enviados: recipients, informe: report };
}

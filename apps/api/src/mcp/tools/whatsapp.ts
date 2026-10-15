import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createHash, randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db";
import { config } from "../../config";
import { listDesigns, loadDesign, renderDesign, unknownPlaceholders } from "../../lib/customDesign";
import { AVATAR_PX, FLYER_PHOTO_H, W, loadProfilePhoto, renderFlyer, renderMetricsCard, type MetricsCardData, type SeriePoint } from "../../lib/metricsCard";
import { actorKeySql, realActionSql, realPageViewSql, staffIdsSql, visitorKeySql } from "../../lib/statsFilters";
import { localTs } from "../metrics";
import {
  getWhatsAppProvider,
  listCloudTemplates,
  logDelivery,
  normalizePhoneForWhatsApp,
  saveRelay,
  sendCloudTemplateMessage,
  uploadCloudMedia,
  type CloudTemplateInfo,
} from "../../notifications/whatsapp";
import { getBaileysStatus, sendBaileysImage, sendBaileysText } from "../../notifications/whatsappBaileys";
import { guarded, type McpContext } from "../audit";
import {
  TZ,
  chileMidnight,
  chileToday,
  errorResult,
  findUserRef,
  jsonResult,
  periodShape,
  resolvePeriod,
  type Period,
  type PeriodInput,
} from "../helpers";
import { describeFiltros, hasProfileFilters, pickFiltros, profileSql, withSegment, type Filtros } from "../stats/core";
import { avisoFiltros } from "./team";

/**
 * Envíos masivos por WhatsApp desde el MCP, con una imagen opcional por
 * perfil (tarjeta de métricas o flyer, con su foto). Dos vías:
 *
 * - "bot" (Baileys, número propio): texto libre con la imagen. WhatsApp banea
 *   números que mandan mucho y rápido a gente que no les escribió, así que va
 *   de a uno con pausas largas y topes bajos.
 * - "plantilla" (Cloud API de Meta): plantilla aprobada (normalmente de
 *   marketing) con la imagen como encabezado. Es la vía oficial: Meta cobra
 *   cada envío y limita cuántos por día según el nivel de la cuenta.
 *
 * Nunca dos envíos a la vez.
 */

const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } as const;
const READ = { readOnlyHint: true, openWorldHint: false } as const;

type Via = "bot" | "plantilla";

const LIMITS: Record<Via, { maxPerSend: number; dailyCap: number; minDelayMs: number; maxDelayMs: number; deliveryType: string }> = {
  bot: {
    maxPerSend: Number(process.env.WHATSAPP_BROADCAST_MAX || 150),
    dailyCap: Number(process.env.WHATSAPP_BROADCAST_DAILY || 300),
    minDelayMs: 8_000,
    maxDelayMs: 20_000,
    deliveryType: "MCP_BROADCAST",
  },
  plantilla: {
    maxPerSend: Number(process.env.WHATSAPP_TEMPLATE_BROADCAST_MAX || 1000),
    // El nivel inicial de Meta permite 250 conversaciones iniciadas por día.
    dailyCap: Number(process.env.WHATSAPP_TEMPLATE_BROADCAST_DAILY || 1000),
    minDelayMs: 400,
    maxDelayMs: 900,
    deliveryType: "MCP_BROADCAST_TEMPLATE",
  },
};
const MAX_LIST = Math.max(LIMITS.bot.maxPerSend, LIMITS.plantilla.maxPerSend);
const NOTIFIABLE = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"];

type Recipient = { id: string; username: string; nombre: string; phone: string; avatarUrl: string | null };

/** Qué imagen va con el mensaje. */
type Imagen = {
  tipo: "ninguna" | "metricas" | "flyer" | "diseno";
  foto: boolean;
  titulo?: string;
  texto?: string;
  /** imagen=diseno: nombre y contenido del SVG propio (el contenido entra al código de confirmación). */
  diseno?: { nombre: string; svg: string };
};

/** PNG o JPEG, según los primeros bytes. */
const imageMime = (b: Buffer) => (b[0] === 0xff && b[1] === 0xd8 ? "image/jpeg" : "image/png");

type Job = {
  id: string;
  via: Via;
  by: string;
  startedAt: Date;
  finishedAt: Date | null;
  total: number;
  enviados: number;
  fallidos: { usuario: string; error: string }[];
  cancelado: boolean;
};

const jobs = new Map<string, Job>();
let running: Job | null = null;

// ── Métricas por perfil ───────────────────────────────────────────────────

/** Día calendario en Chile (YYYY-MM-DD). */
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
/** Último instante dentro de un fin exclusivo. */
const lastMs = (d: Date) => new Date(d.getTime() - 1);

type Pair = { cur: number; prev: number };
type Metrics = { visitantes: Pair; contactos: Pair; impresiones: Pair; favoritos: Pair; mensajes: Pair; serie: SeriePoint[] };

const MES_CORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Días calendario (YYYY-MM-DD, hora de Chile) del periodo, en orden. */
function periodDays(period: Period): string[] {
  const first = ymd(period.from);
  const last = ymd(lastMs(period.to));
  const days: string[] = [];
  // Aritmética sobre la fecha en UTC: no le afectan los cambios de horario.
  for (let d = new Date(`${first}T00:00:00Z`); days.length < 400; d = new Date(d.getTime() + 86_400_000)) {
    const s = d.toISOString().slice(0, 10);
    days.push(s);
    if (s >= last) break;
  }
  return days;
}

const dayLabel = (s: string) => `${Number(s.slice(8, 10))} ${MES_CORTO[Number(s.slice(5, 7)) - 1]}`;

/** Hasta 31 barras: por día, o sumando de a 7 días en periodos largos. */
function buildSerie(days: string[], byDay: Map<string, number>): SeriePoint[] {
  const step = days.length > 31 ? 7 : 1;
  const out: SeriePoint[] = [];
  for (let i = 0; i < days.length; i += step) {
    const chunk = days.slice(i, i + step);
    out.push({ etiqueta: dayLabel(chunk[0]), valor: chunk.reduce((a, d) => a + (byDay.get(d) ?? 0), 0) });
  }
  return out.slice(-31);
}

async function profileMetrics(ids: string[], period: Period): Promise<Map<string, Metrics>> {
  const { from, to } = period;
  const pFrom = period.previous.from;
  const pTo = period.previous.to;
  const cur = (col: string) => Prisma.sql`${Prisma.raw(col)} >= ${from} AND ${Prisma.raw(col)} < ${to}`;
  const prev = (col: string) => Prisma.sql`${Prisma.raw(col)} >= ${pFrom} AND ${Prisma.raw(col)} < ${pTo}`;
  const lo = pFrom < from ? pFrom : from;

  const [vis, con, imp, fav, msg, daily] = await Promise.all([
    prisma.$queryRaw<{ id: string; cur: number; prev: number }[]>`
      WITH u AS (SELECT "id", "username" FROM "User" WHERE "id" = ANY(${ids}::uuid[]))
      SELECT u."id",
        COUNT(DISTINCT ${visitorKeySql("pv")}) FILTER (WHERE ${cur('pv."createdAt"')})::int AS cur,
        COUNT(DISTINCT ${visitorKeySql("pv")}) FILTER (WHERE ${prev('pv."createdAt"')})::int AS prev
      FROM "PageView" pv JOIN u ON pv."path" LIKE '/profesional/%'
        AND (split_part(pv."path", '/', 3) = u."id"::text OR split_part(pv."path", '/', 3) = u."username")
      WHERE pv."createdAt" >= ${lo} AND pv."createdAt" < ${to} AND ${realPageViewSql("pv")}
      GROUP BY u."id"`,
    // Contactos únicos por persona y día, igual que ranking_perfiles.
    prisma.$queryRaw<{ id: string; cur: number; prev: number }[]>`
      SELECT ua."targetId"::text AS id,
        COUNT(DISTINCT (${actorKeySql("ua")} || ':' || to_char(${localTs('ua."createdAt"')}, 'YYYY-MM-DD'))) FILTER (WHERE ${cur('ua."createdAt"')})::int AS cur,
        COUNT(DISTINCT (${actorKeySql("ua")} || ':' || to_char(${localTs('ua."createdAt"')}, 'YYYY-MM-DD'))) FILTER (WHERE ${prev('ua."createdAt"')})::int AS prev
      FROM "UserAction" ua
      WHERE ua."action" = 'whatsapp_click' AND ua."targetId" = ANY(${ids}::uuid[])
        AND ua."createdAt" >= ${lo} AND ua."createdAt" < ${to} AND ${realActionSql("ua")}
      GROUP BY 1`,
    prisma.$queryRaw<{ id: string; cur: number; prev: number }[]>`
      SELECT "profileId"::text AS id,
        COALESCE(SUM("impressions") FILTER (WHERE "date" BETWEEN ${ymd(from)}::date AND ${ymd(lastMs(to))}::date), 0)::int AS cur,
        COALESCE(SUM("impressions") FILTER (WHERE "date" BETWEEN ${ymd(pFrom)}::date AND ${ymd(lastMs(pTo))}::date), 0)::int AS prev
      FROM "ProfileDailyStats"
      WHERE "profileId" = ANY(${ids}::uuid[]) AND "date" >= ${ymd(lo)}::date
      GROUP BY 1`,
    prisma.$queryRaw<{ id: string; cur: number; prev: number }[]>`
      SELECT "professionalId"::text AS id,
        COUNT(*) FILTER (WHERE ${cur('"createdAt"')})::int AS cur,
        COUNT(*) FILTER (WHERE ${prev('"createdAt"')})::int AS prev
      FROM "Favorite"
      WHERE "professionalId" = ANY(${ids}::uuid[]) AND "createdAt" >= ${lo} AND "createdAt" < ${to}
      GROUP BY 1`,
    prisma.$queryRaw<{ id: string; cur: number; prev: number }[]>`
      SELECT m."toId"::text AS id,
        COUNT(*) FILTER (WHERE ${cur('m."createdAt"')})::int AS cur,
        COUNT(*) FILTER (WHERE ${prev('m."createdAt"')})::int AS prev
      FROM "Message" m
      WHERE m."toId" = ANY(${ids}::uuid[]) AND m."createdAt" >= ${lo} AND m."createdAt" < ${to}
        AND m."fromId" NOT IN ${staffIdsSql()}
      GROUP BY 1`,
    // Visitantes distintos por día del periodo, para el gráfico de la tarjeta.
    prisma.$queryRaw<{ id: string; dia: string; n: number }[]>`
      WITH u AS (SELECT "id", "username" FROM "User" WHERE "id" = ANY(${ids}::uuid[]))
      SELECT u."id", to_char(${localTs('pv."createdAt"')}, 'YYYY-MM-DD') AS dia, COUNT(DISTINCT ${visitorKeySql("pv")})::int AS n
      FROM "PageView" pv JOIN u ON pv."path" LIKE '/profesional/%'
        AND (split_part(pv."path", '/', 3) = u."id"::text OR split_part(pv."path", '/', 3) = u."username")
      WHERE ${cur('pv."createdAt"')} AND ${realPageViewSql("pv")}
      GROUP BY 1, 2`,
  ]);

  const zero = (): Pair => ({ cur: 0, prev: 0 });
  const out = new Map<string, Metrics>();
  for (const id of ids) out.set(id, { visitantes: zero(), contactos: zero(), impresiones: zero(), favoritos: zero(), mensajes: zero(), serie: [] });
  const put = (rows: { id: string; cur: number; prev: number }[], key: Exclude<keyof Metrics, "serie">) => {
    for (const r of rows) {
      const m = out.get(r.id);
      if (m) m[key] = { cur: r.cur, prev: r.prev };
    }
  };
  put(vis, "visitantes");
  put(con, "contactos");
  put(imp, "impresiones");
  put(fav, "favoritos");
  put(msg, "mensajes");
  const days = periodDays(period);
  const byUser = new Map<string, Map<string, number>>();
  for (const r of daily) {
    if (!byUser.has(r.id)) byUser.set(r.id, new Map());
    byUser.get(r.id)!.set(r.dia, r.n);
  }
  for (const [id, m] of out) m.serie = buildSerie(days, byUser.get(id) ?? new Map());
  return out;
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** "Del 8 al 14 de octubre", "Del 28 de septiembre al 4 de octubre" o "14 de octubre". */
function friendlyRange(period: Period): string {
  const [, m1, d1] = ymd(period.from).split("-").map(Number);
  const [, m2, d2] = ymd(lastMs(period.to)).split("-").map(Number);
  const suffix = period.inProgress ? " (hasta hoy)" : "";
  if (m1 === m2 && d1 === d2) return `${d1} de ${MESES[m1 - 1]}${suffix}`;
  if (m1 === m2) return `Del ${d1} al ${d2} de ${MESES[m2 - 1]}${suffix}`;
  return `Del ${d1} de ${MESES[m1 - 1]} al ${d2} de ${MESES[m2 - 1]}${suffix}`;
}

function cardData(r: Recipient, m: Metrics, period: Period, foto: Buffer | null): MetricsCardData {
  const v = (p: Pair) => ({ actual: p.cur, anterior: p.prev });
  return {
    nombre: r.nombre,
    periodo: friendlyRange(period),
    foto,
    visitantes: v(m.visitantes),
    contactos: v(m.contactos),
    impresiones: v(m.impresiones),
    favoritos: v(m.favoritos),
    mensajes: v(m.mensajes),
    serie: m.serie,
  };
}

/** Reemplaza {nombre}, {usuario}, {visitas}, {contactos}, {favoritos}, {mensajes}, {impresiones}. */
function personalize(text: string, r: Recipient, m: Metrics | null): string {
  return text
    .replace(/\{nombre\}/g, r.nombre)
    .replace(/\{usuario\}/g, r.username)
    .replace(/\{visitas\}/g, String(m?.visitantes.cur ?? 0))
    .replace(/\{contactos\}/g, String(m?.contactos.cur ?? 0))
    .replace(/\{favoritos\}/g, String(m?.favoritos.cur ?? 0))
    .replace(/\{mensajes\}/g, String(m?.mensajes.cur ?? 0))
    .replace(/\{impresiones\}/g, String(m?.impresiones.cur ?? 0));
}

const METRIC_TAGS = /\{(visitas|contactos|favoritos|mensajes|impresiones)\}/;

function needsMetrics(texts: string[], img: Imagen): boolean {
  return img.tipo === "metricas" || img.tipo === "diseno" || [...texts, img.titulo ?? "", img.texto ?? ""].some((t) => METRIC_TAGS.test(t));
}

/** Arma la imagen de un destinatario; null si el envío es sólo texto. */
async function buildImage(img: Imagen, r: Recipient, m: Metrics | null, period: Period): Promise<Buffer | null> {
  if (img.tipo === "ninguna") return null;
  const [w, h] = img.tipo === "flyer" ? [W, FLYER_PHOTO_H] : img.tipo === "diseno" ? [W, W] : [AVATAR_PX, AVATAR_PX];
  const foto = img.foto ? await loadProfilePhoto(r.avatarUrl, w, h) : null;
  if (img.tipo === "metricas") return m ? renderMetricsCard(cardData(r, m, period, foto)) : null;
  if (img.tipo === "diseno") return m && img.diseno ? renderDesign(img.diseno.svg, { ...cardData(r, m, period, foto), usuario: r.username }) : null;
  const host = new URL(config.appUrl).host;
  return renderFlyer({
    nombre: r.nombre,
    titulo: personalize(img.titulo ?? "", r, m),
    texto: personalize(img.texto ?? "", r, m),
    foto,
    pie: `${host}/profesional/${r.username}`,
  });
}

// ── Destinatarios ─────────────────────────────────────────────────────────

async function recipients(ids: string[]): Promise<{ ok: Recipient[]; sinTelefono: number }> {
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, isActive: true, profileType: { in: NOTIFIABLE as any } },
    select: { id: true, username: true, displayName: true, phone: true, avatarUrl: true },
  });
  const ok: Recipient[] = [];
  const seen = new Set<string>();
  for (const u of users) {
    const phone = normalizePhoneForWhatsApp(u.phone);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    ok.push({ id: u.id, username: u.username, nombre: (u.displayName || u.username || "").trim(), phone, avatarUrl: u.avatarUrl });
  }
  return { ok, sinTelefono: ids.length - ok.length };
}

async function sentToday(via: Via): Promise<number> {
  return prisma.notificationDelivery.count({
    where: { type: LIMITS[via].deliveryType, channel: "WHATSAPP", ok: true, createdAt: { gte: chileMidnight(chileToday()) } },
  });
}

function confirmationCode(ids: string[], contenido: unknown, img: Imagen, periodLabel: string) {
  const payload = JSON.stringify({ ids: [...ids].sort(), contenido, img, periodLabel });
  return createHash("sha256").update(payload).digest("hex").slice(0, 10);
}

// ── Envío en segundo plano ────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Plantilla = { name: string; language: string; variables: string[]; botonVariable?: string; botonIndice?: number };

/** Cómo sale un mensaje a un destinatario, según la vía. */
type Sender = (r: Recipient, m: Metrics | null, image: Buffer | null) => Promise<{ ok: boolean; error?: string; messageId?: string }>;

function botSender(mensaje: string): Sender {
  return async (r, m, image) => {
    const text = personalize(mensaje, r, m);
    return image ? sendBaileysImage(r.phone, image, text) : sendBaileysText(r.phone, text);
  };
}

function templateSender(t: Plantilla, img: Imagen): Sender {
  return async (r, m, image) => {
    let headerImageId: string | undefined;
    if (image) {
      const mime = imageMime(image);
      const up = await uploadCloudMedia(image, mime, mime === "image/jpeg" ? "imagen.jpg" : "imagen.png");
      if (!up.ok) return { ok: false, error: `MEDIA: ${up.error}` };
      headerImageId = up.mediaId;
    }
    const result = await sendCloudTemplateMessage(r.phone, t, {
      body: t.variables.map((v) => personalize(v, r, m)),
      headerImageId,
      urlButtonSuffix: t.botonVariable ? personalize(t.botonVariable, r, m) : undefined,
      urlButtonIndex: t.botonIndice,
    });
    // Si responde, que no caiga en su último chat con un cliente.
    if (result.ok) await saveRelay(prisma, result.messageId, r.id, null, r.phone);
    return result;
  };
}

async function runJob(job: Job, list: Recipient[], send: Sender, metrics: Map<string, Metrics> | null, period: Period, img: Imagen) {
  const lim = LIMITS[job.via];
  try {
    for (const [i, r] of list.entries()) {
      if (job.cancelado) break;
      const m = metrics?.get(r.id) ?? null;
      let result: { ok: boolean; error?: string; messageId?: string };
      try {
        result = await send(r, m, await buildImage(img, r, m, period));
      } catch (err: any) {
        result = { ok: false, error: err?.message || "ERROR" };
      }
      await logDelivery(prisma, { userId: r.id, channel: "WHATSAPP", type: lim.deliveryType, result });
      if (result.ok) job.enviados++;
      else job.fallidos.push({ usuario: r.username, error: result.error || "ERROR" });
      // Bot desconectado o credenciales de Meta inválidas: no seguir quemando la lista.
      if (!result.ok && /^NOT_CONNECTED|CLOUD_API_NOT_CONFIGURED|access token/i.test(result.error || "")) break;
      if (i < list.length - 1) await sleep(lim.minDelayMs + Math.random() * (lim.maxDelayMs - lim.minDelayMs));
    }
  } finally {
    job.finishedAt = new Date();
    running = null;
  }
}

function jobView(j: Job) {
  return {
    id: j.id,
    via: j.via,
    estado: j.finishedAt ? (j.cancelado ? "cancelado" : "terminado") : "enviando",
    total: j.total,
    enviados: j.enviados,
    fallidos: j.fallidos.length,
    pendientes: j.finishedAt ? 0 : j.total - j.enviados - j.fallidos.length,
    detalleFallidos: j.fallidos.slice(0, 30),
    inicio: j.startedAt,
    fin: j.finishedAt,
  };
}

function cloudConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

/** Cuerpo de la plantilla con las variables reemplazadas, para la vista previa. */
function fillTemplateBody(body: string, values: string[]): string {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (all, n) => values[Number(n) - 1] ?? all);
}

// ── Herramientas ──────────────────────────────────────────────────────────

type Args = Filtros &
  PeriodInput & {
    usuario?: string;
    usuarios?: string[];
    mensaje?: string;
    plantilla?: string;
    idioma?: string;
    variables?: string[];
    botonVariable?: string;
    imagen?: "ninguna" | "metricas" | "flyer" | "diseno";
    diseno?: string;
    tarjetaMetricas?: boolean;
    incluirFoto?: boolean;
    flyerTitulo?: string;
    flyerTexto?: string;
    confirmacion?: string;
  };

export function registerWhatsAppTools(server: McpServer, ctx: McpContext) {
  if (ctx.scope !== "full") return;

  server.registerTool(
    "enviar_whatsapp",
    {
      title: "Enviar WhatsApp masivo (bot o plantilla de Meta, con tarjeta de métricas o flyer)",
      description:
        "Manda un WhatsApp a uno o varios perfiles (usuario, lista de usuarios, o filtros de perfil / segmento), con una imagen opcional por perfil. " +
        "Dos vías: (a) con `plantilla` = nombre de una plantilla aprobada en Meta (vía oficial, Cloud API; normalmente de marketing): la imagen va como encabezado, `variables` llena {{1}}, {{2}}... del cuerpo y `botonVariable` el final de la URL del botón si es dinámica. Revisa antes plantillas_whatsapp para ver cuáles hay, cuántas variables piden y si llevan encabezado de imagen. " +
        "(b) sin plantilla, con `mensaje`: texto libre desde el bot (Baileys, número propio), la imagen con el mensaje de pie de foto. " +
        "Imagen: imagen=diseno usa un diseño SVG propio del equipo (diseno=<nombre>, los disponibles salen en estado_whatsapp) con sus textos {{nombre}}, {{visitas}}... llenados con los datos de cada perfil; imagen=metricas es una tarjeta con SU foto y SUS métricas del periodo (personas que vieron su perfil, contactos por WhatsApp, apariciones en listados, mensajes, favoritos, tasa de contacto, y variación vs periodo anterior); imagen=flyer es un flyer con su foto grande, su nombre, flyerTitulo y flyerTexto. incluirFoto=false quita la foto del perfil. " +
        "mensaje, variables, botonVariable, flyerTitulo y flyerTexto aceptan {nombre}, {usuario}, {visitas}, {contactos}, {favoritos}, {mensajes}, {impresiones}. " +
        "SIEMPRE en dos pasos: 1) sin `confirmacion` devuelve la vista previa (cuántos, a quiénes, el texto y la imagen del primero) y un código: muéstrasela al usuario. " +
        "2) Sólo si la aprueba, repite la llamada igual con confirmacion=<código>. El envío corre en segundo plano; mira el avance con estado_whatsapp. " +
        `Bot: máximo ${LIMITS.bot.maxPerSend} por envío y ${LIMITS.bot.dailyCap} por día, con pausas de 8-20 s. Plantilla: máximo ${LIMITS.plantilla.maxPerSend} por envío y ${LIMITS.plantilla.dailyCap} por día; Meta cobra cada mensaje. ` +
        "Sólo a profesionales, establecimientos y tiendas activos con teléfono.",
      inputSchema: {
        usuario: z.string().optional().describe("id, username o email de un usuario"),
        usuarios: z.array(z.string()).max(MAX_LIST).optional().describe("Lista de id/username/email"),
        ...avisoFiltros,
        mensaje: z.string().trim().min(3).max(1000).optional().describe("Vía bot: texto del mensaje (pie de foto si hay imagen)."),
        plantilla: z.string().trim().regex(/^[a-z0-9_]+$/, "Nombre de plantilla de Meta: minúsculas, números y _").optional().describe("Vía plantilla: nombre de la plantilla aprobada en Meta."),
        idioma: z.string().trim().optional().describe("Idioma de la plantilla (ej. es, es_CL). Por defecto el de la plantilla o WHATSAPP_TEMPLATE_LANG."),
        variables: z.array(z.string().max(1000)).max(20).optional().describe("Vía plantilla: valores de {{1}}, {{2}}... del cuerpo, en orden."),
        botonVariable: z.string().max(200).optional().describe("Vía plantilla: sufijo de la URL dinámica del botón, ej. profesional/{usuario}."),
        imagen: z.enum(["ninguna", "metricas", "flyer", "diseno"]).optional().describe("Imagen por perfil. Por defecto ninguna."),
        diseno: z.string().regex(/^[a-z0-9_-]{1,40}$/).optional().describe("Para imagen=diseno: nombre del diseño SVG propio (ver estado_whatsapp → disenos)."),
        tarjetaMetricas: z.boolean().optional().describe("Equivale a imagen=metricas."),
        incluirFoto: z.boolean().optional().describe("Foto del perfil en la imagen. Por defecto sí."),
        flyerTitulo: z.string().trim().min(2).max(60).optional().describe("Para imagen=flyer: titular grande (hasta 2 líneas)."),
        flyerTexto: z.string().trim().max(240).optional().describe("Para imagen=flyer: texto bajo el titular (hasta 4 líneas)."),
        ...periodShape,
        confirmacion: z.string().optional().describe("Código de la vista previa, una vez que el usuario la aprobó."),
      },
      annotations: WRITE,
    },
    guarded("enviar_whatsapp", ctx, async (args: Args) => {
      const via: Via = args.plantilla ? "plantilla" : "bot";
      const lim = LIMITS[via];

      // ── Vía y plantilla ──
      let template: CloudTemplateInfo | null = null;
      let plantilla: Plantilla | null = null;
      let botConectadoComo: string | null = null;
      if (via === "bot") {
        if (!args.mensaje) return errorResult("Indica `mensaje` (vía bot) o `plantilla` (vía plantilla de Meta).");
        if (getWhatsAppProvider() !== "baileys") {
          return errorResult("El bot (Baileys) no está activo. Con la Cloud API de Meta usa una plantilla aprobada: pasa `plantilla` (ver plantillas_whatsapp).");
        }
        const bot = getBaileysStatus();
        if (bot.status !== "connected") {
          return errorResult(`El bot de WhatsApp no está conectado (estado: ${bot.status}). Vincúlalo con el QR en /admin/whatsapp.`);
        }
        botConectadoComo = bot.connectedAs;
      } else {
        if (!cloudConfigured()) return errorResult("La Cloud API de Meta no está configurada (WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID).");
        const all = await listCloudTemplates().catch((err) => {
          throw new Error(`No pude leer las plantillas de Meta: ${err?.message || err}`);
        });
        if (all) {
          const same = all.filter((t) => t.nombre === args.plantilla);
          template = same.find((t) => !args.idioma || t.idioma === args.idioma) ?? null;
          if (!template) {
            return errorResult(same.length
              ? `La plantilla "${args.plantilla}" no existe en idioma ${args.idioma}. Idiomas: ${same.map((t) => t.idioma).join(", ")}.`
              : `No existe la plantilla "${args.plantilla}". Revisa plantillas_whatsapp.`);
          }
          if (template.estado !== "APPROVED") return errorResult(`La plantilla "${template.nombre}" está ${template.estado}: sólo se pueden enviar las aprobadas.`);
          if (template.formatoNombrado) return errorResult("La plantilla usa variables con nombre; este envío sólo soporta las numeradas ({{1}}, {{2}}...).");
        }
        plantilla = {
          name: args.plantilla!,
          language: template?.idioma ?? args.idioma ?? (process.env.WHATSAPP_TEMPLATE_LANG || "es"),
          variables: args.variables ?? [],
          botonVariable: args.botonVariable,
          botonIndice: template?.indiceBotonUrl ?? undefined,
        };
      }

      const tipo = args.imagen ?? (args.tarjetaMetricas ? "metricas" : "ninguna");
      if (tipo === "flyer" && !args.flyerTitulo) return errorResult("Para imagen=flyer indica flyerTitulo (y opcional flyerTexto).");
      let diseno: Imagen["diseno"];
      if (tipo === "diseno") {
        const svg = args.diseno ? loadDesign(args.diseno) : null;
        if (!svg) return errorResult(`Indica un diseño que exista con diseno=<nombre>. Disponibles: ${listDesigns().join(", ") || "ninguno (se agregan en apps/api/assets/whatsapp)"}.`);
        diseno = { nombre: args.diseno!, svg };
      }
      if (template) {
        const conImagen = template.encabezado === "IMAGE";
        if (conImagen && tipo === "ninguna") return errorResult(`La plantilla "${template.nombre}" lleva imagen de encabezado: indica imagen=metricas o imagen=flyer.`);
        if (!conImagen && tipo !== "ninguna") return errorResult(`La plantilla "${template.nombre}" no tiene encabezado de imagen (${template.encabezado ?? "sin encabezado"}). Usa una con imagen o envía sin imagen.`);
        if ((plantilla!.variables.length) !== template.variablesCuerpo) {
          return errorResult(`La plantilla "${template.nombre}" pide ${template.variablesCuerpo} variables en el cuerpo y mandaste ${plantilla!.variables.length}. Cuerpo: ${template.cuerpo}`);
        }
        if (template.botonUrlDinamico && !args.botonVariable) return errorResult("La plantilla tiene un botón con URL dinámica: indica botonVariable (ej. profesional/{usuario}).");
      }
      const img: Imagen = {
        tipo,
        foto: args.incluirFoto !== false,
        ...(tipo === "flyer" ? { titulo: args.flyerTitulo, texto: args.flyerTexto ?? "" } : {}),
        ...(diseno ? { diseno } : {}),
      };

      // ── Destinatarios ──
      let ids: string[];
      let criterio: Record<string, unknown>;
      if (args.usuario || args.usuarios?.length) {
        const refs = [...(args.usuario ? [args.usuario] : []), ...(args.usuarios ?? [])];
        const found = await Promise.all(refs.map((r) => findUserRef(r)));
        const missing = refs.filter((_, i) => !found[i]);
        if (missing.length) return errorResult(`No encontré: ${missing.slice(0, 10).join(", ")}`);
        ids = [...new Set(found as string[])];
        criterio = { usuarios: refs };
      } else {
        const f = await withSegment(pickFiltros(args as Record<string, unknown>));
        if (!hasProfileFilters(f)) {
          return errorResult("Indica usuario(s) o al menos un filtro de perfil (tipoPerfil, tier, ciudad, categoria, estadoPerfil, segmento...). No se envía a toda la base.");
        }
        const rows = await prisma.$queryRaw<{ id: string }[]>`
          SELECT u."id" FROM "User" u WHERE ${await profileSql(f, "u")} LIMIT 5000`;
        ids = rows.map((r) => r.id);
        criterio = describeFiltros(f);
      }

      const { ok: list, sinTelefono } = await recipients(ids);
      if (!list.length) return errorResult("Ningún perfil activo con teléfono válido calza con eso.");
      if (list.length > lim.maxPerSend) {
        return errorResult(`Son ${list.length} destinatarios con teléfono; el máximo por envío (${via}) es ${lim.maxPerSend}. Acota los filtros o divide el envío.`);
      }

      const texts = via === "bot" ? [args.mensaje!] : [...plantilla!.variables, plantilla!.botonVariable ?? ""];
      const period = resolvePeriod(args);
      const contenido = via === "bot" ? { mensaje: args.mensaje } : plantilla;
      const code = confirmationCode(list.map((r) => r.id), contenido, img, period.label);
      const restantesHoy = lim.dailyCap - (await sentToday(via));
      const perMsg = (lim.minDelayMs + lim.maxDelayMs) / 2 + (via === "bot" ? 2_000 : 1_500);
      const etaMin = Math.ceil((list.length * perMsg) / 60_000);

      if (args.confirmacion !== code) {
        const first = list[0];
        const m = needsMetrics(texts, img) ? (await profileMetrics([first.id], period)).get(first.id)! : null;
        const values = plantilla?.variables.map((v) => personalize(v, first, m)) ?? [];
        const preview = jsonResult({
          vistaPrevia: true,
          aviso: "NO SE HA ENVIADO NADA. Muestra esto al usuario y, si lo aprueba, repite la llamada con confirmacion.",
          codigoInvalido: args.confirmacion ? "El código no corresponde (cambió el texto, la plantilla, la imagen, el periodo o los destinatarios). Usa el nuevo." : undefined,
          via,
          destinatarios: {
            total: list.length,
            descartadosSinTelefonoOInactivos: sinTelefono,
            criterio,
            muestra: list.slice(0, 8).map((r) => ({ usuario: r.username, nombre: r.nombre })),
          },
          imagen: tipo === "ninguna" ? false : {
            tipo,
            fotoDelPerfil: img.foto,
            sinFoto: img.foto ? list.filter((r) => !r.avatarUrl).length : undefined,
            periodo: tipo === "metricas" || tipo === "diseno" ? period.label : undefined,
            diseno: diseno ? { nombre: diseno.nombre, marcadoresSinDato: unknownPlaceholders(diseno.svg) } : undefined,
            ejemplo: first.username,
          },
          mensajeEjemplo: via === "bot" ? personalize(args.mensaje!, first, m) : undefined,
          plantilla: plantilla
            ? {
                nombre: plantilla.name,
                idioma: plantilla.language,
                categoria: template?.categoria,
                cuerpoEjemplo: template ? fillTemplateBody(template.cuerpo, values) : undefined,
                variablesEjemplo: values,
                botonEjemplo: plantilla.botonVariable ? personalize(plantilla.botonVariable, first, m) : undefined,
                validada: template
                  ? true
                  : "No: falta WHATSAPP_BUSINESS_ACCOUNT_ID, no pude revisar que exista, esté aprobada y calcen las variables. Si algo no calza, Meta rechazará cada envío.",
                costo: "Meta cobra cada plantilla entregada (marketing es la categoría más cara) y limita los envíos por día según el nivel de la cuenta.",
              }
            : undefined,
          botConectadoComo: botConectadoComo ?? undefined,
          duracionEstimadaMin: etaMin,
          enviosDisponiblesHoy: restantesHoy,
          confirmacion: code,
        });
        const image = await buildImage(img, first, m, period);
        if (image) {
          const mimeType = imageMime(image);
          preview.content.push({ type: "image", data: image.toString("base64"), mimeType });
        }
        return preview;
      }

      if (running) return errorResult(`Ya hay un envío en curso (${running.id}). Espera a que termine o cancélalo con estado_whatsapp.`);
      if (list.length > restantesHoy) {
        return errorResult(`Hoy quedan ${Math.max(0, restantesHoy)} envíos disponibles por ${via} (tope ${lim.dailyCap} por día).`);
      }

      const metrics = needsMetrics(texts, img) ? await profileMetrics(list.map((r) => r.id), period) : null;
      const job: Job = {
        id: randomUUID().slice(0, 8),
        via,
        by: ctx.userId,
        startedAt: new Date(),
        finishedAt: null,
        total: list.length,
        enviados: 0,
        fallidos: [],
        cancelado: false,
      };
      jobs.set(job.id, job);
      if (jobs.size > 50) jobs.delete(jobs.keys().next().value!);
      running = job;
      const send = via === "bot" ? botSender(args.mensaje!) : templateSender(plantilla!, img);
      runJob(job, list, send, metrics, period, img).catch((err) =>
        console.error("[mcp] enviar_whatsapp:", err?.message || err),
      );
      return jsonResult({ enviando: true, via, envio: job.id, destinatarios: list.length, duracionEstimadaMin: etaMin, verAvance: "estado_whatsapp" });
    }),
  );

  server.registerTool(
    "cruzar_telefonos",
    {
      title: "Cruzar una lista de teléfonos con las cuentas de UZEED",
      description:
        "Recibe una lista de teléfonos (ej. de un Excel de contactos) y dice cuáles ya tienen cuenta en UZEED, comparando el número normalizado (+56 9 1234 5678, 912345678 y 56912345678 son el mismo). " +
        "Devuelve, para cada número de la lista, si está registrado y con qué usuario y tipo de perfil; nunca devuelve teléfonos de la base que no estén en la lista. Los inválidos salen aparte.",
      inputSchema: {
        telefonos: z.array(z.string().max(40)).min(1).max(5000),
      },
      annotations: READ,
    },
    guarded("cruzar_telefonos", ctx, async ({ telefonos }: { telefonos: string[] }) => {
      const wanted = new Map<string, string>(); // normalizado → como venía
      const invalidos: string[] = [];
      for (const raw of telefonos) {
        const n = normalizePhoneForWhatsApp(raw);
        if (n) wanted.set(n, wanted.get(n) ?? raw);
        else invalidos.push(raw);
      }
      const users = await prisma.user.findMany({
        where: { phone: { not: null } },
        select: { id: true, username: true, displayName: true, profileType: true, isActive: true, phone: true, createdAt: true },
      });
      const byPhone = new Map<string, (typeof users)[number]>();
      for (const u of users) {
        const n = normalizePhoneForWhatsApp(u.phone);
        if (n && wanted.has(n) && !byPhone.has(n)) byPhone.set(n, u);
      }
      const resultados = [...wanted].map(([n, original]) => {
        const u = byPhone.get(n);
        return u
          ? { telefono: original, normalizado: n, registrado: true, usuario: u.username, nombre: u.displayName, tipoPerfil: u.profileType, activo: u.isActive, registradoEl: u.createdAt }
          : { telefono: original, normalizado: n, registrado: false };
      });
      return jsonResult({
        total: telefonos.length,
        unicos: wanted.size,
        registrados: resultados.filter((r) => r.registrado).length,
        noRegistrados: resultados.filter((r) => !r.registrado).length,
        invalidos,
        resultados,
      });
    }),
  );

  server.registerTool(
    "plantillas_whatsapp",
    {
      title: "Plantillas de WhatsApp aprobadas en Meta",
      description:
        "Lista las plantillas de la cuenta de WhatsApp Business (nombre, idioma, estado, categoría, si llevan imagen de encabezado, el cuerpo y cuántas variables {{n}} pide). Úsala antes de enviar_whatsapp con plantilla. Necesita WHATSAPP_BUSINESS_ACCOUNT_ID.",
      inputSchema: {
        soloAprobadas: z.boolean().optional().describe("Por defecto sí."),
        categoria: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).optional(),
      },
      annotations: READ,
    },
    guarded("plantillas_whatsapp", ctx, async ({ soloAprobadas, categoria }: { soloAprobadas?: boolean; categoria?: string }) => {
      if (!cloudConfigured()) return errorResult("La Cloud API de Meta no está configurada (WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID).");
      const all = await listCloudTemplates();
      if (!all) return errorResult("Falta WHATSAPP_BUSINESS_ACCOUNT_ID (WhatsApp Manager → Configuración de la cuenta → ID de la cuenta de WhatsApp Business).");
      const list = all.filter((t) => (soloAprobadas === false || t.estado === "APPROVED") && (!categoria || t.categoria === categoria));
      return jsonResult({
        plantillas: list,
        nota: "Para enviar con imagen, la plantilla debe tener encabezado IMAGE. Las plantillas se crean y aprueban en WhatsApp Manager.",
      });
    }),
  );

  server.registerTool(
    "estado_whatsapp",
    {
      title: "Estado del bot y de los envíos de WhatsApp",
      description: "Estado de conexión del bot de WhatsApp, si la Cloud API de Meta está configurada, y avance de los envíos masivos (enviados, fallidos, pendientes). Con cancelar=<id> detiene un envío en curso (lo ya enviado no se puede deshacer).",
      inputSchema: {
        envio: z.string().optional().describe("id del envío; por defecto los últimos"),
        cancelar: z.string().optional().describe("id del envío en curso a detener"),
      },
      annotations: READ,
    },
    guarded("estado_whatsapp", ctx, async ({ envio, cancelar }: { envio?: string; cancelar?: string }) => {
      if (cancelar) {
        const j = jobs.get(cancelar);
        if (!j || j.finishedAt) return errorResult("No hay un envío en curso con ese id.");
        j.cancelado = true;
        return jsonResult({ cancelado: true, envio: jobView(j) });
      }
      const { sessionDir: _dir, ...bot } = getBaileysStatus();
      const list = envio ? [jobs.get(envio)].filter((j): j is Job => !!j) : [...jobs.values()].slice(-5).reverse();
      const [hoyBot, hoyPlantilla] = await Promise.all([sentToday("bot"), sentToday("plantilla")]);
      return jsonResult({
        proveedor: getWhatsAppProvider(),
        bot,
        cloudApi: { configurada: cloudConfigured(), validaPlantillas: Boolean(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID) },
        disenos: listDesigns(),
        enviosHoy: {
          bot: { enviados: hoyBot, tope: LIMITS.bot.dailyCap },
          plantilla: { enviados: hoyPlantilla, tope: LIMITS.plantilla.dailyCap },
        },
        envios: list.map(jobView),
      });
    }),
  );
}

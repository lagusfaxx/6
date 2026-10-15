import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createHash, randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db";
import { config } from "../../config";
import { AVATAR_PX, FLYER_PHOTO_H, W, loadProfilePhoto, renderFlyer, renderMetricsCard, type MetricsCardData } from "../../lib/metricsCard";
import { actorKeySql, realActionSql, realPageViewSql, staffIdsSql, visitorKeySql } from "../../lib/statsFilters";
import { localTs } from "../metrics";
import { getWhatsAppProvider, logDelivery, normalizePhoneForWhatsApp } from "../../notifications/whatsapp";
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
 * Envíos masivos por WhatsApp desde el MCP: texto y, opcional, una imagen
 * por perfil con su foto: la tarjeta de métricas o un flyer con texto libre.
 * Sólo con Baileys (número propio): la Cloud API de Meta no permite texto
 * libre ni imágenes fuera de la ventana de 24 h sin plantillas aprobadas.
 *
 * WhatsApp banea números que mandan mucho y rápido a gente que no les
 * escribió: los envíos van de a uno con pausa aleatoria, con tope por envío
 * y por día, y nunca dos envíos a la vez.
 */

const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } as const;
const READ = { readOnlyHint: true, openWorldHint: false } as const;

const MAX_PER_SEND = Number(process.env.WHATSAPP_BROADCAST_MAX || 150);
const DAILY_CAP = Number(process.env.WHATSAPP_BROADCAST_DAILY || 300);
const MIN_DELAY_MS = 8_000;
const MAX_DELAY_MS = 20_000;
const DELIVERY_TYPE = "MCP_BROADCAST";
const NOTIFIABLE = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"];

type Recipient = { id: string; username: string; nombre: string; phone: string; avatarUrl: string | null };

/** Qué imagen va con el mensaje. */
type Imagen = { tipo: "ninguna" | "metricas" | "flyer"; foto: boolean; titulo?: string; texto?: string };

type Job = {
  id: string;
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
type Metrics = { visitantes: Pair; contactos: Pair; impresiones: Pair; favoritos: Pair; mensajes: Pair };

async function profileMetrics(ids: string[], period: Period): Promise<Map<string, Metrics>> {
  const { from, to } = period;
  const pFrom = period.previous.from;
  const pTo = period.previous.to;
  const cur = (col: string) => Prisma.sql`${Prisma.raw(col)} >= ${from} AND ${Prisma.raw(col)} < ${to}`;
  const prev = (col: string) => Prisma.sql`${Prisma.raw(col)} >= ${pFrom} AND ${Prisma.raw(col)} < ${pTo}`;
  const lo = pFrom < from ? pFrom : from;

  const [vis, con, imp, fav, msg] = await Promise.all([
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
  ]);

  const zero = (): Pair => ({ cur: 0, prev: 0 });
  const out = new Map<string, Metrics>();
  for (const id of ids) out.set(id, { visitantes: zero(), contactos: zero(), impresiones: zero(), favoritos: zero(), mensajes: zero() });
  const put = (rows: { id: string; cur: number; prev: number }[], key: keyof Metrics) => {
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
  };
}

/** Reemplaza {nombre}, {visitas}, {contactos}, {favoritos}, {mensajes}, {impresiones}. */
function personalize(text: string, r: Recipient, m: Metrics | null): string {
  return text
    .replace(/\{nombre\}/g, r.nombre)
    .replace(/\{visitas\}/g, String(m?.visitantes.cur ?? 0))
    .replace(/\{contactos\}/g, String(m?.contactos.cur ?? 0))
    .replace(/\{favoritos\}/g, String(m?.favoritos.cur ?? 0))
    .replace(/\{mensajes\}/g, String(m?.mensajes.cur ?? 0))
    .replace(/\{impresiones\}/g, String(m?.impresiones.cur ?? 0));
}

const METRIC_TAGS = /\{(visitas|contactos|favoritos|mensajes|impresiones)\}/;

function needsMetrics(mensaje: string, img: Imagen): boolean {
  return img.tipo === "metricas" || [mensaje, img.titulo ?? "", img.texto ?? ""].some((t) => METRIC_TAGS.test(t));
}

/** Arma la imagen de un destinatario; null si el envío es sólo texto. */
async function buildImage(img: Imagen, r: Recipient, m: Metrics | null, period: Period): Promise<Buffer | null> {
  if (img.tipo === "ninguna") return null;
  const [w, h] = img.tipo === "flyer" ? [W, FLYER_PHOTO_H] : [AVATAR_PX, AVATAR_PX];
  const foto = img.foto ? await loadProfilePhoto(r.avatarUrl, w, h) : null;
  if (img.tipo === "metricas") return m ? renderMetricsCard(cardData(r, m, period, foto)) : null;
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

async function sentToday(): Promise<number> {
  return prisma.notificationDelivery.count({
    where: { type: DELIVERY_TYPE, channel: "WHATSAPP", ok: true, createdAt: { gte: chileMidnight(chileToday()) } },
  });
}

function confirmationCode(ids: string[], mensaje: string, img: Imagen, periodLabel: string) {
  const payload = JSON.stringify({ ids: [...ids].sort(), mensaje, img, periodLabel });
  return createHash("sha256").update(payload).digest("hex").slice(0, 10);
}

// ── Envío en segundo plano ────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runJob(job: Job, list: Recipient[], mensaje: string, metrics: Map<string, Metrics> | null, period: Period, img: Imagen) {
  try {
    for (const [i, r] of list.entries()) {
      if (job.cancelado) break;
      const m = metrics?.get(r.id) ?? null;
      const text = personalize(mensaje, r, m);
      let result: { ok: boolean; error?: string };
      try {
        const image = await buildImage(img, r, m, period);
        result = image ? await sendBaileysImage(r.phone, image, text) : await sendBaileysText(r.phone, text);
      } catch (err: any) {
        result = { ok: false, error: err?.message || "ERROR" };
      }
      await logDelivery(prisma, { userId: r.id, channel: "WHATSAPP", type: DELIVERY_TYPE, result });
      if (result.ok) job.enviados++;
      else job.fallidos.push({ usuario: r.username, error: result.error || "ERROR" });
      // Si el bot se desconectó no tiene sentido seguir quemando la lista.
      if (!result.ok && result.error?.startsWith("NOT_CONNECTED")) break;
      if (i < list.length - 1) await sleep(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
    }
  } finally {
    job.finishedAt = new Date();
    running = null;
  }
}

function jobView(j: Job) {
  return {
    id: j.id,
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

// ── Herramientas ──────────────────────────────────────────────────────────

type Args = Filtros &
  PeriodInput & {
    usuario?: string;
    usuarios?: string[];
    mensaje: string;
    imagen?: "ninguna" | "metricas" | "flyer";
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
      title: "Enviar WhatsApp masivo (con tarjeta de métricas o flyer)",
      description:
        "Manda un WhatsApp desde el número del bot a uno o varios perfiles (usuario, lista de usuarios, o filtros de perfil / segmento). " +
        "Con imagen=metricas cada perfil recibe una tarjeta con SU foto y SUS métricas del periodo (personas que vieron su perfil, contactos por WhatsApp, apariciones en listados, mensajes, favoritos, tasa de contacto, y variación vs periodo anterior). " +
        "Con imagen=flyer recibe un flyer con su foto grande, su nombre, flyerTitulo y flyerTexto (lo que pida el usuario: promo, aviso, felicitación...). En ambos casos el mensaje va como pie de foto; incluirFoto=false quita la foto del perfil. " +
        "El mensaje, flyerTitulo y flyerTexto aceptan {nombre}, {visitas}, {contactos}, {favoritos}, {mensajes}, {impresiones}. " +
        "SIEMPRE en dos pasos: 1) sin `confirmacion` devuelve la vista previa (cuántos, a quiénes, el texto y la imagen del primero) y un código: muéstrasela al usuario. " +
        "2) Sólo si la aprueba, repite la llamada igual con confirmacion=<código>. El envío corre en segundo plano, de a uno con pausas de 8-20 s para no arriesgar el número; mira el avance con estado_whatsapp. " +
        `Máximo ${MAX_PER_SEND} por envío y ${DAILY_CAP} por día. Sólo a profesionales, establecimientos y tiendas activos con teléfono. Requiere el bot en modo Baileys conectado.`,
      inputSchema: {
        usuario: z.string().optional().describe("id, username o email de un usuario"),
        usuarios: z.array(z.string()).max(MAX_PER_SEND).optional().describe("Lista de id/username/email"),
        ...avisoFiltros,
        mensaje: z.string().trim().min(3).max(1000),
        imagen: z.enum(["ninguna", "metricas", "flyer"]).optional().describe("Imagen por perfil. Por defecto ninguna (sólo texto)."),
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
      if (getWhatsAppProvider() !== "baileys") {
        return errorResult("Los envíos masivos necesitan WHATSAPP_PROVIDER=baileys. Con la Cloud API de Meta sólo se pueden mandar plantillas aprobadas fuera de la ventana de 24 h.");
      }
      const bot = getBaileysStatus();
      if (bot.status !== "connected") {
        return errorResult(`El bot de WhatsApp no está conectado (estado: ${bot.status}). Vincúlalo con el QR en /admin/whatsapp.`);
      }

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
      if (list.length > MAX_PER_SEND) {
        return errorResult(`Son ${list.length} destinatarios con teléfono; el máximo por envío es ${MAX_PER_SEND}. Acota los filtros o divide el envío.`);
      }

      const tipo = args.imagen ?? (args.tarjetaMetricas ? "metricas" : "ninguna");
      if (tipo === "flyer" && !args.flyerTitulo) return errorResult("Para imagen=flyer indica flyerTitulo (y opcional flyerTexto).");
      const img: Imagen = {
        tipo,
        foto: args.incluirFoto !== false,
        ...(tipo === "flyer" ? { titulo: args.flyerTitulo, texto: args.flyerTexto ?? "" } : {}),
      };
      const period = resolvePeriod(args);
      const code = confirmationCode(list.map((r) => r.id), args.mensaje, img, period.label);
      const restantesHoy = DAILY_CAP - (await sentToday());
      const etaMin = Math.ceil((list.length * ((MIN_DELAY_MS + MAX_DELAY_MS) / 2 + 2_000)) / 60_000);

      if (args.confirmacion !== code) {
        const first = list[0];
        const m = needsMetrics(args.mensaje, img) ? (await profileMetrics([first.id], period)).get(first.id)! : null;
        const preview = jsonResult({
          vistaPrevia: true,
          aviso: "NO SE HA ENVIADO NADA. Muestra esto al usuario y, si lo aprueba, repite la llamada con confirmacion.",
          codigoInvalido: args.confirmacion ? "El código no corresponde (cambió el texto, la imagen, el periodo o los destinatarios). Usa el nuevo." : undefined,
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
            periodo: tipo === "metricas" ? period.label : undefined,
            ejemplo: first.username,
          },
          mensajeEjemplo: personalize(args.mensaje, first, m),
          botConectadoComo: bot.connectedAs,
          duracionEstimadaMin: etaMin,
          enviosDisponiblesHoy: restantesHoy,
          confirmacion: code,
        });
        const image = await buildImage(img, first, m, period);
        if (image) {
          const mimeType = tipo === "flyer" ? "image/jpeg" : "image/png";
          preview.content.push({ type: "image", data: image.toString("base64"), mimeType });
        }
        return preview;
      }

      if (running) return errorResult(`Ya hay un envío en curso (${running.id}). Espera a que termine o cancélalo con estado_whatsapp.`);
      if (list.length > restantesHoy) {
        return errorResult(`Hoy quedan ${Math.max(0, restantesHoy)} envíos disponibles (tope ${DAILY_CAP} por día para cuidar el número).`);
      }

      const metrics = needsMetrics(args.mensaje, img) ? await profileMetrics(list.map((r) => r.id), period) : null;
      const job: Job = {
        id: randomUUID().slice(0, 8),
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
      runJob(job, list, args.mensaje, metrics, period, img).catch((err) =>
        console.error("[mcp] enviar_whatsapp:", err?.message || err),
      );
      return jsonResult({ enviando: true, envio: job.id, destinatarios: list.length, duracionEstimadaMin: etaMin, verAvance: "estado_whatsapp" });
    }),
  );

  server.registerTool(
    "estado_whatsapp",
    {
      title: "Estado del bot y de los envíos de WhatsApp",
      description: "Estado de conexión del bot de WhatsApp y avance de los envíos masivos (enviados, fallidos, pendientes). Con cancelar=<id> detiene un envío en curso (lo ya enviado no se puede deshacer).",
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
      return jsonResult({
        proveedor: getWhatsAppProvider(),
        bot,
        enviosHoy: await sentToday(),
        topeDiario: DAILY_CAP,
        envios: list.map(jobView),
      });
    }),
  );
}

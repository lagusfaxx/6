import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../db";
import { buildUnsubscribeUrl } from "../../lib/emailPrefsToken";
import { sendAdminMessageEmail } from "../../lib/notificationEmail";
import { guarded, type McpContext } from "../audit";
import { chileMidnight, chileToday, errorResult, findUserRef, jsonResult } from "../helpers";
import { describeFiltros, hasProfileFilters, pickFiltros, profileSql, withSegment, type Filtros } from "../stats/core";
import { filtrosShape } from "../stats/core";

/**
 * Trabajo del día a día del equipo que no toca dinero ni borra: la bandeja
 * de avisos del panel, notas internas sobre usuarios y avisos a usuarios.
 * Sólo con el token completo (administrador) y todo queda en la bitácora.
 */
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;
const READ = { readOnlyHint: true, openWorldHint: false } as const;

const usuarioField = z.string().describe("id (uuid), username o email del usuario");

// ── Bandeja de avisos del panel ───────────────────────────────────────────

const BANDEJA_TIPOS = [
  "deletion_requested",
  "contact_form",
  "content_reported",
  "deposit_submitted",
  "withdrawal_requested",
  "profile_verification_requested",
  "phone_change_requested",
  "face_verification_submitted",
  "stats_alert",
  "mcp_authorized",
] as const;

/** Los avisos traen correos de quien escribió: salen enmascarados. */
function maskEmails(text: unknown): string | null {
  if (typeof text !== "string" || !text) return null;
  return text.replace(/([A-Za-z0-9._%+-]{1,2})[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g, "$1***@$2");
}

// ── Avisos a usuarios ─────────────────────────────────────────────────────

const MAX_RECIPIENTS = 1000;
const MAX_EMAILS = 300;
const DAILY_CAP = 2000;

const avisoFiltros = (({ region, ciudad, comuna, categoria, tipoPerfil, tier, verificado, estadoPerfil, segmento }) => ({
  region,
  ciudad,
  comuna,
  categoria,
  tipoPerfil,
  tier,
  verificado,
  estadoPerfil,
  segmento,
}))(filtrosShape);

type Canal = "app" | "correo";

function confirmationCode(ids: string[], titulo: string, mensaje: string, url: string | null, canales: Canal[]) {
  const payload = JSON.stringify({ ids: [...ids].sort(), titulo, mensaje, url, canales: [...canales].sort() });
  return createHash("sha256").update(payload).digest("hex").slice(0, 10);
}

async function sendEmails(ids: string[], titulo: string, mensaje: string, url: string | null) {
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, emailOnNewMessage: true, email: { not: "" } },
    select: { id: true, email: true, displayName: true },
    take: MAX_EMAILS,
  });
  for (const u of users) {
    await sendAdminMessageEmail(u.email, u.displayName, titulo, mensaje, url, buildUnsubscribeUrl(u.id));
    await new Promise((r) => setTimeout(r, 150));
  }
}

export function registerTeamTools(server: McpServer, ctx: McpContext) {
  if (ctx.scope !== "full") return;

  server.registerTool(
    "bandeja_admin",
    {
      title: "Bandeja de avisos del panel",
      description:
        "Avisos que recibe el equipo en el panel: solicitudes de eliminación de datos, formularios de contacto, contenido reportado, depósitos, retiros, verificaciones, alertas... " +
        "accion=listar (por defecto sólo los pendientes) o accion=marcar_atendido con los ids (lo marca para todo el equipo). Los correos de quien escribió salen enmascarados: el dato completo está en el panel. " +
        "Marcar atendido no aprueba ni rechaza nada: sólo saca el aviso de la bandeja. Confirma con el usuario antes de marcar.",
      inputSchema: {
        accion: z.enum(["listar", "marcar_atendido"]).optional(),
        tipo: z.enum(BANDEJA_TIPOS).optional(),
        incluirAtendidos: z.boolean().optional(),
        ids: z.array(z.string().uuid()).max(100).optional().describe("Para marcar_atendido: ids devueltos por listar."),
        limite: z.number().int().min(1).max(200).optional().describe("Por defecto 50."),
      },
      annotations: WRITE,
    },
    guarded(
      "bandeja_admin",
      ctx,
      async ({ accion, tipo, incluirAtendidos, ids, limite }: { accion?: "listar" | "marcar_atendido"; tipo?: (typeof BANDEJA_TIPOS)[number]; incluirAtendidos?: boolean; ids?: string[]; limite?: number }) => {
        if (accion === "marcar_atendido") {
          if (!ids?.length) return errorResult("Indica los ids a marcar (salen en accion=listar).");
          const mine = await prisma.notification.findMany({
            where: { id: { in: ids }, userId: ctx.userId, type: "ADMIN_EVENT" },
            select: { id: true, data: true },
          });
          if (!mine.length) return errorResult("Ninguno de esos ids es un aviso de tu bandeja.");
          // Cada administrador tiene su copia del mismo aviso: se marcan todas.
          let marcados = 0;
          for (const n of mine) {
            const d = (n.data ?? {}) as Record<string, unknown>;
            const res = await prisma.$executeRaw`
              UPDATE "Notification" SET "readAt" = now()
              WHERE "type" = 'ADMIN_EVENT' AND "readAt" IS NULL
                AND "data"->>'type' = ${String(d.type ?? "")}
                AND "data"->>'timestamp' = ${String(d.timestamp ?? "")}`;
            marcados += res;
          }
          return jsonResult({ avisos: mine.length, copiasMarcadas: marcados, noEncontrados: ids.filter((i) => !mine.some((m) => m.id === i)) });
        }

        const where: Prisma.NotificationWhereInput = {
          userId: ctx.userId,
          type: "ADMIN_EVENT",
          ...(incluirAtendidos ? {} : { readAt: null }),
          ...(tipo ? { data: { path: ["type"], equals: tipo } } : {}),
        };
        const [rows, pendientesPorTipo] = await Promise.all([
          prisma.notification.findMany({ where, orderBy: { createdAt: "desc" }, take: limite ?? 50 }),
          prisma.$queryRaw<{ tipo: string; pendientes: number; masAntiguo: Date }[]>`
            SELECT "data"->>'type' AS tipo, COUNT(*)::int AS pendientes, MIN("createdAt") AS "masAntiguo"
            FROM "Notification" WHERE "userId" = ${ctx.userId}::uuid AND "type" = 'ADMIN_EVENT' AND "readAt" IS NULL
            GROUP BY 1 ORDER BY 2 DESC`,
        ]);
        return jsonResult({
          pendientesPorTipo,
          avisos: rows.map((n) => {
            const d = (n.data ?? {}) as Record<string, unknown>;
            return {
              id: n.id,
              tipo: d.type,
              titulo: d.title,
              quien: maskEmails(d.user),
              contenido: d.contentType,
              referencia: maskEmails(d.targetId),
              monto: d.amount,
              panel: d.url,
              recibido: n.createdAt,
              atendido: n.readAt,
            };
          }),
        });
      },
    ),
  );

  server.registerTool(
    "notas_internas",
    {
      title: "Notas internas sobre un usuario",
      description:
        "Notas del equipo sobre un usuario (no las ve el usuario): accion=listar o accion=agregar con texto. Salen también en ver_usuario. " +
        "Útil para dejar contexto (\"pidió baja de tier\", \"perfil duplicado de @x\"). No se pueden borrar desde aquí.",
      inputSchema: {
        usuario: usuarioField,
        accion: z.enum(["listar", "agregar"]).optional(),
        texto: z.string().trim().min(3).max(2000).optional(),
      },
      annotations: WRITE,
    },
    guarded(
      "notas_internas",
      ctx,
      async ({ usuario, accion, texto }: { usuario: string; accion?: "listar" | "agregar"; texto?: string }) => {
        const id = await findUserRef(usuario);
        if (!id) return errorResult(`No encontré al usuario "${usuario}".`);
        if (accion === "agregar") {
          if (!texto) return errorResult("Falta el texto de la nota.");
          const nota = await prisma.adminUserNote.create({
            data: { userId: id, authorId: ctx.userId, text: texto, source: "mcp" },
            select: { id: true, text: true, createdAt: true },
          });
          return jsonResult({ agregada: nota });
        }
        const notas = await prisma.adminUserNote.findMany({
          where: { userId: id },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, text: true, source: true, authorId: true, createdAt: true },
        });
        const authors = await prisma.user.findMany({
          where: { id: { in: [...new Set(notas.map((n) => n.authorId).filter((x): x is string => !!x))] } },
          select: { id: true, username: true },
        });
        const byId = new Map(authors.map((a) => [a.id, a.username]));
        return jsonResult({
          notas: notas.map((n) => ({ id: n.id, texto: n.text, autor: n.authorId ? byId.get(n.authorId) ?? null : null, via: n.source, fecha: n.createdAt })),
        });
      },
    ),
  );

  server.registerTool(
    "enviar_aviso",
    {
      title: "Enviar aviso a usuarios",
      description:
        "Manda un aviso del equipo a un usuario o a un grupo (filtros de perfil o un segmento guardado): notificación en la app con push (canal app) y/o correo (canal correo, sólo a quien acepta avisos por correo, con enlace de baja). " +
        "SIEMPRE en dos pasos: 1) llámala sin `confirmacion`: devuelve la vista previa (cuántos, a quiénes, el texto) y un código; muéstrasela al usuario. " +
        `2) Sólo si el usuario la aprueba, llámala igual con confirmacion=<código>. Si cambian los destinatarios o el texto, el código ya no sirve. Máximo ${MAX_RECIPIENTS} destinatarios por envío, ${MAX_EMAILS} correos por envío y ${DAILY_CAP} avisos por día. ` +
        "El enlace sólo puede ser una ruta de uzeed.cl (ej. /dashboard/services).",
      inputSchema: {
        usuario: usuarioField.optional(),
        ...avisoFiltros,
        titulo: z.string().trim().min(3).max(80).regex(/^[^\r\n]+$/, "Una sola línea."),
        mensaje: z.string().trim().min(3).max(600),
        url: z
          .string()
          .regex(/^\/(?!\/)[A-Za-z0-9\-._~/?=&%#]*$/, "Sólo rutas dentro de uzeed.cl, ej. /dashboard/services")
          .max(200)
          .optional(),
        canales: z.array(z.enum(["app", "correo"])).min(1).optional().describe("Por defecto sólo app."),
        confirmacion: z.string().optional().describe("Código de la vista previa, una vez que el usuario la aprobó."),
      },
      annotations: { ...WRITE, openWorldHint: true },
    },
    guarded(
      "enviar_aviso",
      ctx,
      async (args: Filtros & { usuario?: string; titulo: string; mensaje: string; url?: string; canales?: Canal[]; confirmacion?: string }) => {
        const canales: Canal[] = args.canales?.length ? [...new Set(args.canales)] : ["app"];
        const url = args.url ?? null;

        let ids: string[];
        let destinatarios: Record<string, unknown>;
        if (args.usuario) {
          const id = await findUserRef(args.usuario);
          if (!id) return errorResult(`No encontré al usuario "${args.usuario}".`);
          ids = [id];
          destinatarios = { usuario: args.usuario };
        } else {
          const f = await withSegment(pickFiltros(args as Record<string, unknown>));
          if (!hasProfileFilters(f)) {
            return errorResult("Indica un usuario o al menos un filtro de perfil (tipoPerfil, tier, ciudad, categoria, estadoPerfil...). No se envía a toda la base.");
          }
          const rows = await prisma.$queryRaw<{ id: string }[]>`
            SELECT u."id" FROM "User" u WHERE ${await profileSql(f, "u")} LIMIT ${MAX_RECIPIENTS + 1}`;
          if (rows.length > MAX_RECIPIENTS) {
            return errorResult(`El grupo supera ${MAX_RECIPIENTS} usuarios. Acota los filtros o divide el envío.`);
          }
          ids = rows.map((r) => r.id);
          destinatarios = describeFiltros(f);
        }
        if (!ids.length) return errorResult("Ningún usuario calza con esos filtros.");

        const [enviadosHoy] = await prisma.$queryRaw<{ n: number }[]>`
          SELECT COUNT(*)::int AS n FROM "Notification"
          WHERE "type" = 'ADMIN_MESSAGE' AND "data"->>'via' = 'mcp' AND "createdAt" >= ${chileMidnight(chileToday())}`;
        const restantesHoy = DAILY_CAP - (enviadosHoy?.n ?? 0);

        const code = confirmationCode(ids, args.titulo, args.mensaje, url, canales);
        if (args.confirmacion !== code) {
          const [muestra, conCorreo] = await Promise.all([
            prisma.user.findMany({ where: { id: { in: ids.slice(0, 200) } }, select: { username: true, profileType: true, city: true }, take: 8 }),
            canales.includes("correo")
              ? prisma.user.count({ where: { id: { in: ids }, emailOnNewMessage: true, email: { not: "" } } })
              : Promise.resolve(null),
          ]);
          return jsonResult({
            vistaPrevia: true,
            aviso: "NO SE HA ENVIADO NADA. Muestra esto al usuario y, si lo aprueba, repite la llamada con confirmacion.",
            codigoInvalido: args.confirmacion ? "El código no corresponde (cambió el texto o los destinatarios). Usa el nuevo." : undefined,
            destinatarios: { total: ids.length, criterio: destinatarios, muestra },
            canales,
            correos: conCorreo === null ? undefined : { aceptanCorreo: conCorreo, seEnvian: Math.min(conCorreo, MAX_EMAILS) },
            titulo: args.titulo,
            mensaje: args.mensaje,
            url,
            avisosDisponiblesHoy: restantesHoy,
            confirmacion: code,
          });
        }

        if (ids.length > restantesHoy) {
          return errorResult(`Hoy quedan ${Math.max(0, restantesHoy)} avisos disponibles (tope ${DAILY_CAP} por día).`);
        }

        let notificados = 0;
        if (canales.includes("app")) {
          // createMany: el middleware de db.ts manda el push de cada uno.
          const res = await prisma.notification.createMany({
            data: ids.map((userId) => ({
              userId,
              type: "ADMIN_MESSAGE" as const,
              data: { title: args.titulo, body: args.mensaje, url: url ?? "/", tag: `admin-msg-${code}`, via: "mcp", by: ctx.userId },
            })),
          });
          notificados = res.count;
        }
        let correos: number | undefined;
        if (canales.includes("correo")) {
          correos = Math.min(
            await prisma.user.count({ where: { id: { in: ids }, emailOnNewMessage: true, email: { not: "" } } }),
            MAX_EMAILS,
          );
          // En segundo plano: Resend va de a uno y no conviene bloquear la llamada.
          sendEmails(ids, args.titulo, args.mensaje, url).catch((err) =>
            console.error("[mcp] enviar_aviso correo:", err?.message || err),
          );
        }
        return jsonResult({ enviado: true, destinatarios: ids.length, notificacionesApp: notificados, correosEnCola: correos });
      },
    ),
  );
}

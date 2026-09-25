import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { randomInt } from "crypto";
import { z } from "zod";
import { prisma } from "../../db";
import { TEST_EMAIL_SUFFIX } from "../../lib/statsFilters";
import { isUUID } from "../../lib/validators";
import { ForumError, createReply, createThread, excerpt, officialWhere } from "../../forum/service";
import { guarded, type McpContext } from "../audit";
import { errorResult, jsonResult } from "../helpers";

/**
 * Foro: leer y publicar con personajes del equipo para darle movimiento.
 *
 * Los personajes son cuentas propias del MCP (correo `foro-…@testseed.uzeed.cl`):
 * no pueden iniciar sesión (sin contraseña), quedan como `adminManaged` y,
 * por el sufijo de prueba, fuera de todas las estadísticas. Nunca se publica
 * a nombre de un usuario real: si el personaje no es de estos, se rechaza.
 */
const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;

const PERSONA_PREFIX = "foro-";
const ANON_NAME = "Anónimo";
const personaEmailWhere = { startsWith: PERSONA_PREFIX, endsWith: TEST_EMAIL_SUFFIX };

function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
}

async function createPersona(nombre: string | null) {
  const displayName = nombre?.trim() || ANON_NAME;
  const base = nombre?.trim() ? slugify(nombre) || "usuario" : "anonimo";
  for (let i = 0; i < 10; i++) {
    const username = i === 0 && nombre?.trim() ? base : `${base}${randomInt(100, 9999)}`;
    const taken = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (taken) continue;
    return prisma.user.create({
      data: {
        email: `${PERSONA_PREFIX}${username}${TEST_EMAIL_SUFFIX}`,
        username,
        displayName,
        profileType: "VIEWER",
        adminManaged: true,
        signupSource: "foro_mcp",
      },
      select: { id: true, username: true, displayName: true },
    });
  }
  throw new ForumError(409, "USERNAME_TAKEN", "No encontré un nombre de usuario libre; prueba con otro nombre.");
}

async function findPersona(ref: string) {
  const value = ref.trim().replace(/^@/, "");
  const byId: boolean = isUUID(value);
  return prisma.user.findFirst({
    where: {
      email: personaEmailWhere,
      OR: [{ username: { equals: value, mode: "insensitive" } }, ...(byId ? [{ id: value }] : [])],
    },
    select: { id: true, username: true, displayName: true },
  });
}

/** Personaje con el que se publica: uno existente, uno nuevo con nombre o un anónimo nuevo. */
async function resolveAuthor(args: { personaje?: string; anonimo?: boolean }) {
  if (args.personaje) {
    const found = await findPersona(args.personaje);
    if (found) return { autor: found, nuevo: false };
    if (args.anonimo) throw new ForumError(400, "BAD_ARGS", "Usa personaje o anonimo, no los dos.");
    // Si coincide con un usuario real, no se usa ni se imita.
    const name = args.personaje.trim().replace(/^@/, "");
    const slug = slugify(name);
    const real = await prisma.user.findFirst({
      where: {
        NOT: { email: personaEmailWhere },
        OR: [
          ...[name, slug, slug.replace(/_/g, "-")].map((u) => ({ username: { equals: u, mode: "insensitive" as const } })),
          // Tampoco el nombre visible de un perfil público (profesional, local, tienda, creadora).
          {
            displayName: { equals: name, mode: "insensitive" as const },
            profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP", "CREATOR"] as const },
          },
        ],
      },
      select: { id: true },
    });
    if (real) {
      throw new ForumError(
        400,
        "REAL_USER",
        `"${args.personaje}" es un usuario real del sitio: no se publica a su nombre. Elige otro nombre de personaje.`,
      );
    }
    return { autor: await createPersona(args.personaje), nuevo: true };
  }
  if (args.anonimo) return { autor: await createPersona(null), nuevo: true };
  throw new ForumError(400, "BAD_ARGS", "Indica personaje (nombre o username) o anonimo=true.");
}

async function resolveCategoryRef(ref?: string) {
  if (!ref) return null;
  const value = ref.trim();
  // Boolean aparte: el type guard de isUUID dejaría `value` como never.
  const byId: boolean = isUUID(value);
  const cat = await prisma.forumCategory.findFirst({
    where: byId ? { id: value } : { OR: [{ slug: value.toLowerCase() }, { name: { equals: value, mode: "insensitive" } }] },
    select: { id: true },
  });
  if (!cat) throw new ForumError(404, "CATEGORY_NOT_FOUND", `No existe la categoría "${ref}". Revisa foro_ver.`);
  return cat.id;
}

function forumErrors<A>(handler: (args: A) => Promise<ReturnType<typeof jsonResult>>) {
  return async (args: A) => {
    try {
      return await handler(args);
    } catch (err) {
      if (err instanceof ForumError) return errorResult(err.message);
      throw err;
    }
  };
}

const autorShape = {
  personaje: z
    .string()
    .max(40)
    .optional()
    .describe("Nombre o username del personaje. Si no existe se crea con ese nombre visible."),
  anonimo: z.boolean().optional().describe("true = publica como un 'Anónimo' nuevo (cada anónimo es distinto)."),
};

export function registerForumTools(server: McpServer, ctx: McpContext) {
  server.registerTool(
    "foro_ver",
    {
      title: "Ver el foro",
      description:
        "Sin hilo: categorías, personajes disponibles y los temas de la comunidad con más actividad reciente (sin los hilos oficiales de perfiles). Con hilo (id): el tema completo con sus mensajes, para responder con contexto.",
      inputSchema: {
        hilo: z.string().optional().describe("id del tema para ver sus mensajes."),
        limite: z.number().int().min(1).max(50).optional().describe("Cuántos temas (por defecto 20)."),
        orden: z.enum(["actividad", "nuevos", "sin_respuesta"]).optional(),
      },
      annotations: READ,
    },
    guarded(
      "foro_ver",
      ctx,
      async ({ hilo, limite = 20, orden = "actividad" }: { hilo?: string; limite?: number; orden?: string }) => {
        if (hilo) {
          if (!isUUID(hilo)) return errorResult("El id del tema no es válido.");
          const thread = await prisma.forumThread.findUnique({
            where: { id: hilo },
            select: {
              id: true,
              title: true,
              isLocked: true,
              createdAt: true,
              category: { select: { name: true, slug: true } },
              author: { select: { username: true, displayName: true, email: true } },
              posts: {
                orderBy: { createdAt: "asc" },
                take: 100,
                select: {
                  id: true,
                  content: true,
                  createdAt: true,
                  author: { select: { username: true, displayName: true, email: true } },
                  _count: { select: { likes: true } },
                },
              },
            },
          });
          if (!thread) return errorResult("Tema no encontrado.");
          const who = (a: { username: string; displayName: string | null; email: string }) => ({
            username: a.username,
            nombre: a.displayName || a.username,
            esPersonaje: a.email.startsWith(PERSONA_PREFIX) && a.email.endsWith(TEST_EMAIL_SUFFIX),
          });
          return jsonResult({
            id: thread.id,
            titulo: thread.title,
            categoria: thread.category,
            cerrado: thread.isLocked,
            creado: thread.createdAt,
            autor: who(thread.author),
            mensajes: thread.posts.map((p) => ({
              id: p.id,
              autor: who(p.author),
              fecha: p.createdAt,
              meGusta: p._count.likes,
              texto: p.content,
            })),
          });
        }

        const [categorias, personajes, threads] = await Promise.all([
          prisma.forumCategory.findMany({
            orderBy: { sortOrder: "asc" },
            select: { id: true, name: true, slug: true, _count: { select: { threads: true } } },
          }),
          prisma.user.findMany({
            where: { email: personaEmailWhere },
            orderBy: { createdAt: "asc" },
            select: { username: true, displayName: true, _count: { select: { forumPosts: true } } },
          }),
          prisma.forumThread.findMany({
            where: { NOT: officialWhere },
            orderBy: orden === "nuevos" ? { createdAt: "desc" } : { lastPostAt: "desc" },
            take: orden === "sin_respuesta" ? 200 : limite,
            select: {
              id: true,
              title: true,
              lastPostAt: true,
              createdAt: true,
              category: { select: { slug: true } },
              author: { select: { username: true, email: true } },
              _count: { select: { posts: true } },
              posts: { orderBy: { createdAt: "asc" }, take: 1, select: { content: true } },
            },
          }),
        ]);

        let temas = threads.map((t) => ({
          id: t.id,
          titulo: t.title,
          categoria: t.category.slug,
          autor: t.author.username,
          deUnPersonaje: t.author.email.startsWith(PERSONA_PREFIX) && t.author.email.endsWith(TEST_EMAIL_SUFFIX),
          respuestas: Math.max(0, t._count.posts - 1),
          ultimaActividad: t.lastPostAt,
          inicio: excerpt(t.posts[0]?.content || "", 160),
        }));
        if (orden === "sin_respuesta") temas = temas.filter((t) => t.respuestas === 0).slice(0, limite);

        return jsonResult({
          categorias: categorias.map((c) => ({ id: c.id, nombre: c.name, slug: c.slug, temas: c._count.threads })),
          personajes: personajes.map((p) => ({
            username: p.username,
            nombre: p.displayName,
            mensajes: p._count.forumPosts,
          })),
          temas,
        });
      },
    ),
  );

  // Publicar sólo con el token completo, igual que el resto de acciones.
  if (ctx.scope !== "full") return;

  server.registerTool(
    "foro_crear_tema",
    {
      title: "Abrir un tema en el foro",
      description:
        "Abre un tema nuevo a nombre de un personaje del equipo (o de un 'Anónimo' nuevo). Sale al instante en el foro y queda en la bitácora. Nunca publica como un usuario real. Escribe como una persona común: tono chileno, natural, sin sonar a anuncio.",
      inputSchema: {
        ...autorShape,
        titulo: z.string().min(5).max(200),
        contenido: z.string().max(10000).optional().describe("Mensaje de apertura. Vacío = sólo el título."),
        categoria: z.string().optional().describe("slug, nombre o id de la categoría. Vacío = General."),
      },
      annotations: WRITE,
    },
    guarded(
      "foro_crear_tema",
      ctx,
      forumErrors(
        async (args: { personaje?: string; anonimo?: boolean; titulo: string; contenido?: string; categoria?: string }) => {
          const categoryId = await resolveCategoryRef(args.categoria);
          const { autor, nuevo } = await resolveAuthor(args);
          const thread = await createThread({
            authorId: autor.id,
            title: args.titulo,
            content: args.contenido,
            categoryId,
          });
          return jsonResult({
            tema: { id: thread.id, titulo: thread.title, categoria: thread.category.slug, url: `/foro/thread/${thread.id}` },
            autor: { username: autor.username, nombre: autor.displayName, personajeNuevo: nuevo },
          });
        },
      ),
    ),
  );

  server.registerTool(
    "foro_responder",
    {
      title: "Responder en un tema del foro",
      description:
        "Responde en un tema a nombre de un personaje del equipo (o de un 'Anónimo' nuevo). Sirve para seguir la conversación en temas propios o de usuarios reales; el autor del tema y quienes participaron reciben la notificación. Con citar (id de mensaje) la respuesta lo cita. Lee el tema con foro_ver antes de responder.",
      inputSchema: {
        ...autorShape,
        hilo: z.string().describe("id del tema."),
        contenido: z.string().min(1).max(10000),
        citar: z.string().optional().describe("id del mensaje a citar."),
      },
      annotations: WRITE,
    },
    guarded(
      "foro_responder",
      ctx,
      forumErrors(
        async (args: { personaje?: string; anonimo?: boolean; hilo: string; contenido: string; citar?: string }) => {
          if (!isUUID(args.hilo)) return errorResult("El id del tema no es válido.");
          let content = args.contenido.trim();
          if (args.citar) {
            if (!isUUID(args.citar)) return errorResult("El id del mensaje a citar no es válido.");
            const quoted = await prisma.forumPost.findFirst({
              where: { id: args.citar, threadId: args.hilo },
              select: { content: true, author: { select: { username: true, displayName: true } } },
            });
            if (!quoted) return errorResult("Ese mensaje no está en el tema.");
            const name = quoted.author.displayName || quoted.author.username;
            content = `> ${name}: ${excerpt(quoted.content, 200)}\n\n${content}`;
          }
          const { autor, nuevo } = await resolveAuthor(args);
          const post = await createReply({ threadId: args.hilo, authorId: autor.id, content });
          return jsonResult({
            mensaje: { id: post.id, url: `/foro/thread/${args.hilo}#post-${post.id}` },
            autor: { username: autor.username, nombre: autor.displayName, personajeNuevo: nuevo },
          });
        },
      ),
    ),
  );
}

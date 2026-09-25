import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { broadcast } from "../realtime/sse";

/**
 * Publicar en el foro: lo usan las rutas públicas y el MCP (personajes del
 * equipo), para que un tema o respuesta salga igual venga de donde venga:
 * mismo aviso en vivo y mismas notificaciones a quienes participan.
 */

/**
 * Los hilos que se crean solos al registrarse una profesional
 * (ver `createProfessionalForumThread`) empiezan con este texto. Se separan
 * de las conversaciones de la comunidad: antes eran el 100% del foro y lo
 * hacían ver como un listado de perfiles vacío.
 */
export const OFFICIAL_PREFIX = "Hilo oficial de";
export const officialWhere: Prisma.ForumThreadWhereInput = {
  posts: { some: { content: { startsWith: OFFICIAL_PREFIX } } },
};

export const DEFAULT_CATEGORY_SLUG = "general";
export const authorSelect = { id: true, username: true, displayName: true, avatarUrl: true } as const;

export function excerpt(content: string, max = 220) {
  const clean = content
    .split("\n")
    .filter((l) => !l.trim().startsWith(">"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export class ForumError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Categoría pedida o, si no viene, "General" (o la última). */
export async function resolveCategory(categoryId?: string | null) {
  const category = categoryId
    ? await prisma.forumCategory.findUnique({ where: { id: categoryId } })
    : (await prisma.forumCategory.findUnique({ where: { slug: DEFAULT_CATEGORY_SLUG } })) ??
      (await prisma.forumCategory.findFirst({ orderBy: { sortOrder: "desc" } }));
  if (!category) throw new ForumError(404, "CATEGORY_NOT_FOUND", "Categoría no encontrada.");
  return category;
}

export async function createThread(params: {
  authorId: string;
  title: string;
  content?: string;
  categoryId?: string | null;
}) {
  const title = params.title.trim();
  const content = (params.content ?? "").trim() || title;

  if (title.length < 5) throw new ForumError(400, "TITLE_TOO_SHORT", "Escribe al menos 5 caracteres.");
  if (title.length > 200) throw new ForumError(400, "TITLE_TOO_LONG", "El título puede tener hasta 200 caracteres.");
  if (content.length > 10000) throw new ForumError(400, "CONTENT_TOO_LONG", "Máximo 10.000 caracteres");
  if (content.startsWith(OFFICIAL_PREFIX)) {
    throw new ForumError(400, "RESERVED_PREFIX", "Ese inicio de mensaje está reservado.");
  }

  const category = await resolveCategory(params.categoryId);
  const thread = await prisma.forumThread.create({
    data: {
      categoryId: category.id,
      authorId: params.authorId,
      title,
      posts: { create: { authorId: params.authorId, content } },
    },
    include: {
      author: { select: authorSelect },
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  broadcast("forum:newThread", {
    id: thread.id,
    title: thread.title,
    excerpt: content === title ? "" : excerpt(content),
    author: thread.author,
    category: thread.category,
    createdAt: thread.createdAt,
  });

  return thread;
}

export async function createReply(params: { threadId: string; authorId: string; content: string }) {
  const { threadId, authorId } = params;
  const content = params.content.trim();
  if (!content) throw new ForumError(400, "MISSING_CONTENT", "Escribe algo antes de enviar.");
  // Un post que empieza así marca el hilo como "de perfil" y lo sacaría de
  // las conversaciones.
  if (content.startsWith(OFFICIAL_PREFIX)) {
    throw new ForumError(400, "RESERVED_PREFIX", "Ese inicio de mensaje está reservado.");
  }
  if (content.length > 10000) throw new ForumError(400, "CONTENT_TOO_LONG", "Máximo 10.000 caracteres");

  const thread = await prisma.forumThread.findUnique({
    where: { id: threadId },
    select: { id: true, isLocked: true, authorId: true, title: true },
  });
  if (!thread) throw new ForumError(404, "THREAD_NOT_FOUND", "Tema no encontrado.");
  if (thread.isLocked) throw new ForumError(403, "THREAD_LOCKED", "Este tema está cerrado.");

  const [post] = await Promise.all([
    prisma.forumPost.create({
      data: { threadId, authorId, content },
      include: { author: { select: authorSelect } },
    }),
    prisma.forumThread.update({
      where: { id: threadId },
      data: { lastPostAt: new Date() },
    }),
  ]);

  broadcast("forum:newPost", {
    threadId,
    threadAuthorId: thread.authorId,
    threadTitle: thread.title,
    post: {
      id: post.id,
      content: post.content,
      author: post.author,
      createdAt: post.createdAt,
      likeCount: 0,
      likedByMe: false,
    },
  });

  // Avisar al autor del tema y a quienes ya participaron: si sólo se avisa
  // al autor, la conversación muere en la primera respuesta.
  const participants = await prisma.forumPost.findMany({
    where: { threadId, authorId: { not: authorId } },
    distinct: ["authorId"],
    select: { authorId: true },
    take: 50,
  });
  const recipients = new Set(participants.map((p) => p.authorId));
  if (thread.authorId !== authorId) recipients.add(thread.authorId);

  if (recipients.size > 0) {
    const name = post.author.displayName || post.author.username;
    await prisma.notification
      .createMany({
        data: [...recipients].map((userId) => ({
          userId,
          type: "FORUM_REPLY" as const,
          data: {
            title: "Respuesta en el foro",
            body:
              userId === thread.authorId
                ? `${name} respondió en tu tema "${thread.title}"`
                : `${name} también respondió en "${thread.title}"`,
            threadId,
            postId: post.id,
            url: `/foro/thread/${threadId}#post-${post.id}`,
          },
        })),
      })
      .catch((err) => {
        console.error("[forum] Failed to notify participants:", err?.message || err);
      });
  }

  return post;
}

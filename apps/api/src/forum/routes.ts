import { Router } from "express";
import rateLimit from "express-rate-limit";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAdmin } from "../auth/middleware";
import { broadcast } from "../realtime/sse";

export const forumRouter = Router();

const forumPostLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  message: { error: "TOO_MANY_POSTS", message: "Demasiadas publicaciones. Espera un momento." },
  standardHeaders: true,
  legacyHeaders: false,
});

const forumLikeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  message: { error: "TOO_MANY_LIKES", message: "Vas muy rápido. Espera un momento." },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Los hilos que se crean solos al registrarse una profesional
 * (ver `createProfessionalForumThread`) empiezan con este texto. Se separan
 * de las conversaciones de la comunidad: antes eran el 100% del foro y lo
 * hacían ver como un listado de perfiles vacío.
 */
const OFFICIAL_PREFIX = "Hilo oficial de";
const officialWhere: Prisma.ForumThreadWhereInput = {
  posts: { some: { content: { startsWith: OFFICIAL_PREFIX } } },
};

const DEFAULT_CATEGORY_SLUG = "general";
const authorSelect = { id: true, username: true, displayName: true, avatarUrl: true } as const;

function excerpt(content: string, max = 220) {
  const clean = content
    .split("\n")
    .filter((l) => !l.trim().startsWith(">"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

// ── GET /forum/categories ── list all categories with stats
forumRouter.get(
  "/forum/categories",
  asyncHandler(async (_req, res) => {
    const categories = await prisma.forumCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { threads: true } },
        threads: {
          orderBy: { lastPostAt: "desc" },
          take: 1,
          select: {
            lastPostAt: true,
            title: true,
            author: { select: { username: true } },
          },
        },
      },
    });

    const result = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      threadCount: cat._count.threads,
      lastActivity: cat.threads[0]?.lastPostAt || null,
      lastThread: cat.threads[0]
        ? { title: cat.threads[0].title, author: cat.threads[0].author.username }
        : null,
    }));

    return res.json({ categories: result });
  })
);

// ── GET /forum/threads ── feed único del foro (todas las categorías)
// ?kind=community|profiles  ?category=slug  ?q=texto  ?sort=latest|newest|replies  ?page
forumRouter.get(
  "/forum/threads",
  asyncHandler(async (req, res) => {
    const kind = req.query.kind === "profiles" ? "profiles" : "community";
    const sort = String(req.query.sort || "latest");
    const categorySlug = typeof req.query.category === "string" ? req.query.category.trim() : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

    const and: Prisma.ForumThreadWhereInput[] = [
      kind === "profiles" ? officialWhere : { NOT: officialWhere },
    ];
    if (categorySlug) and.push({ category: { slug: categorySlug } });
    if (q) {
      and.push({
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { author: { username: { contains: q, mode: "insensitive" } } },
          { posts: { some: { content: { contains: q, mode: "insensitive" } } } },
        ],
      });
    }
    const where: Prisma.ForumThreadWhereInput = { AND: and };

    const orderBy: Prisma.ForumThreadOrderByWithRelationInput =
      sort === "replies"
        ? { posts: { _count: "desc" } }
        : sort === "newest"
          ? { createdAt: "desc" }
          : { lastPostAt: "desc" };

    const [threads, total] = await Promise.all([
      prisma.forumThread.findMany({
        where,
        orderBy: [{ isPinned: "desc" }, orderBy],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: { select: authorSelect },
          category: { select: { id: true, name: true, slug: true } },
          _count: { select: { posts: true } },
          posts: { orderBy: { createdAt: "asc" }, take: 1, select: { content: true } },
        },
      }),
      prisma.forumThread.count({ where }),
    ]);

    return res.json({
      threads: threads.map((t) => ({
        id: t.id,
        title: t.title,
        excerpt: kind === "profiles" ? "" : excerpt(t.posts[0]?.content || ""),
        author: t.author,
        category: t.category,
        replyCount: Math.max(0, t._count.posts - 1),
        views: t.views,
        isPinned: t.isPinned,
        isLocked: t.isLocked,
        isOfficial: kind === "profiles",
        lastPostAt: t.lastPostAt,
        createdAt: t.createdAt,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  })
);

// ── GET /forum/categories/:slug/threads ── list threads in a category
forumRouter.get(
  "/forum/categories/:slug/threads",
  asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const sort = (req.query.sort as string) || "latest";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const category = await prisma.forumCategory.findUnique({ where: { slug } });
    if (!category) return res.status(404).json({ error: "CATEGORY_NOT_FOUND" });

    const orderBy: any =
      sort === "replies"
        ? { posts: { _count: "desc" as const } }
        : sort === "newest"
          ? { createdAt: "desc" as const }
          : { lastPostAt: "desc" as const };

    const [threads, total] = await Promise.all([
      prisma.forumThread.findMany({
        where: { categoryId: category.id },
        orderBy: [{ isPinned: "desc" }, orderBy],
        skip,
        take: limit,
        include: {
          author: { select: { id: true, username: true, avatarUrl: true } },
          _count: { select: { posts: true } },
        },
      }),
      prisma.forumThread.count({ where: { categoryId: category.id } }),
    ]);

    return res.json({
      category: { id: category.id, name: category.name, slug: category.slug, description: category.description },
      threads: threads.map((t) => ({
        id: t.id,
        title: t.title,
        author: t.author,
        replyCount: Math.max(0, t._count.posts - 1), // first post is OP
        views: t.views,
        isPinned: t.isPinned,
        isLocked: t.isLocked,
        lastPostAt: t.lastPostAt,
        createdAt: t.createdAt,
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  })
);

// ── GET /forum/threads/:id ── thread detail with posts
forumRouter.get(
  "/forum/threads/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const viewerId: string | undefined = (req as any).user?.id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 30));
    const skip = (page - 1) * limit;

    const thread = await prisma.forumThread.findUnique({
      where: { id },
      include: {
        author: { select: authorSelect },
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { posts: true } },
      },
    });

    if (!thread) return res.status(404).json({ error: "THREAD_NOT_FOUND" });

    // Increment views (fire & forget, don't block response)
    // Rate-limited by global limiter; this is best-effort dedup
    prisma.forumThread.update({ where: { id }, data: { views: { increment: 1 } } }).catch(() => {});

    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({
        where: { threadId: id },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
        include: {
          author: { select: authorSelect },
          _count: { select: { likes: true } },
          ...(viewerId ? { likes: { where: { userId: viewerId }, select: { userId: true } } } : {}),
        },
      }),
      prisma.forumPost.count({ where: { threadId: id } }),
    ]);

    return res.json({
      thread: {
        id: thread.id,
        title: thread.title,
        author: thread.author,
        category: thread.category,
        views: thread.views + 1,
        isPinned: thread.isPinned,
        isLocked: thread.isLocked,
        createdAt: thread.createdAt,
        postCount: thread._count.posts,
      },
      posts: posts.map((p) => ({
        id: p.id,
        content: p.content,
        author: p.author,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        likeCount: p._count.likes,
        likedByMe: Boolean((p as any).likes?.length),
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  })
);

// ── POST /forum/threads ── create a new thread (auth required)
// La categoría es opcional (cae en "General") y el detalle también: una
// pregunta de una línea basta para abrir un tema.
forumRouter.post(
  "/forum/threads",
  forumPostLimiter,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "UNAUTHENTICATED" });

    const { categoryId } = req.body ?? {};
    const title = String(req.body?.title ?? "").trim();
    const content = String(req.body?.content ?? "").trim() || title;

    if (title.length < 5) {
      return res.status(400).json({ error: "TITLE_TOO_SHORT", message: "Escribe al menos 5 caracteres." });
    }
    if (title.length > 200) {
      return res.status(400).json({ error: "TITLE_TOO_LONG", message: "El título puede tener hasta 200 caracteres." });
    }
    if (content.length > 10000) {
      return res.status(400).json({ error: "CONTENT_TOO_LONG", message: "Máximo 10.000 caracteres" });
    }
    if (content.startsWith(OFFICIAL_PREFIX)) {
      return res.status(400).json({ error: "RESERVED_PREFIX", message: "Ese inicio de mensaje está reservado." });
    }

    const category = categoryId
      ? await prisma.forumCategory.findUnique({ where: { id: String(categoryId) } })
      : (await prisma.forumCategory.findUnique({ where: { slug: DEFAULT_CATEGORY_SLUG } })) ??
        (await prisma.forumCategory.findFirst({ orderBy: { sortOrder: "desc" } }));
    if (!category) return res.status(404).json({ error: "CATEGORY_NOT_FOUND", message: "Categoría no encontrada." });

    const thread = await prisma.forumThread.create({
      data: {
        categoryId: category.id,
        authorId: user.id,
        title,
        posts: { create: { authorId: user.id, content } },
      },
      include: {
        author: { select: authorSelect },
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    // Broadcast to all connected users
    broadcast("forum:newThread", {
      id: thread.id,
      title: thread.title,
      excerpt: content === title ? "" : excerpt(content),
      author: thread.author,
      category: thread.category,
      createdAt: thread.createdAt,
    });

    return res.status(201).json({ thread });
  })
);

// ── POST /forum/threads/:id/posts ── reply to a thread (auth required)
forumRouter.post(
  "/forum/threads/:id/posts",
  forumPostLimiter,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "UNAUTHENTICATED" });

    const { id } = req.params;
    const content = String(req.body?.content ?? "").trim();
    if (!content) return res.status(400).json({ error: "MISSING_CONTENT", message: "Escribe algo antes de enviar." });
    // Un post que empieza así marca el hilo como "de perfil" y lo sacaría de
    // las conversaciones.
    if (content.startsWith(OFFICIAL_PREFIX)) {
      return res.status(400).json({ error: "RESERVED_PREFIX", message: "Ese inicio de mensaje está reservado." });
    }
    if (content.length > 10000) {
      return res.status(400).json({ error: "CONTENT_TOO_LONG", message: "Máximo 10.000 caracteres" });
    }

    const thread = await prisma.forumThread.findUnique({
      where: { id },
      select: { id: true, isLocked: true, authorId: true, title: true },
    });
    if (!thread) return res.status(404).json({ error: "THREAD_NOT_FOUND" });
    if (thread.isLocked) return res.status(403).json({ error: "THREAD_LOCKED", message: "Este tema está cerrado." });

    const [post] = await Promise.all([
      prisma.forumPost.create({
        data: { threadId: id, authorId: user.id, content },
        include: { author: { select: authorSelect } },
      }),
      prisma.forumThread.update({
        where: { id },
        data: { lastPostAt: new Date() },
      }),
    ]);

    // Broadcast new post
    broadcast("forum:newPost", {
      threadId: id,
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
      where: { threadId: id, authorId: { not: user.id } },
      distinct: ["authorId"],
      select: { authorId: true },
      take: 50,
    });
    const recipients = new Set(participants.map((p) => p.authorId));
    if (thread.authorId !== user.id) recipients.add(thread.authorId);

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
              threadId: id,
              postId: post.id,
              url: `/foro/thread/${id}#post-${post.id}`,
            },
          })),
        })
        .catch((err) => {
          console.error("[forum] Failed to notify participants:", err?.message || err);
        });
    }

    return res.status(201).json({ post: { ...post, likeCount: 0, likedByMe: false } });
  })
);

// ── POST /forum/posts/:id/like ── dar / quitar "me gusta" (auth required)
forumRouter.post(
  "/forum/posts/:id/like",
  forumLikeLimiter,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "UNAUTHENTICATED" });

    const { id } = req.params;
    const post = await prisma.forumPost.findUnique({ where: { id }, select: { id: true } });
    if (!post) return res.status(404).json({ error: "POST_NOT_FOUND" });

    const key = { postId_userId: { postId: id, userId: user.id } };
    const existing = await prisma.forumPostLike.findUnique({ where: key });
    if (existing) {
      await prisma.forumPostLike.delete({ where: key }).catch(() => {});
    } else {
      await prisma.forumPostLike.create({ data: { postId: id, userId: user.id } }).catch(() => {});
    }

    const likeCount = await prisma.forumPostLike.count({ where: { postId: id } });
    return res.json({ liked: !existing, likeCount });
  })
);

// ── GET /forum/recent ── recent forum activity (for homepage widget)
forumRouter.get(
  "/forum/recent",
  asyncHandler(async (_req, res) => {
    const threads = await prisma.forumThread.findMany({
      orderBy: { lastPostAt: "desc" },
      take: 5,
      include: {
        author: { select: { username: true } },
        category: { select: { name: true, slug: true } },
      },
    });

    return res.json({
      threads: threads.map((t) => ({
        id: t.id,
        title: t.title,
        author: t.author.username,
        category: t.category.name,
        categorySlug: t.category.slug,
        lastPostAt: t.lastPostAt,
      })),
    });
  })
);

// ── DELETE /forum/posts/:id ── cada usuario puede borrar sus propias
// respuestas (no el mensaje que abre el tema); el resto pasa por requireAdmin.
forumRouter.delete(
  "/forum/posts/:id",
  asyncHandler(async (req, res, next) => {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "UNAUTHENTICATED" });

    const post = await prisma.forumPost.findUnique({
      where: { id: req.params.id },
      select: { id: true, authorId: true, threadId: true },
    });
    if (!post) return res.status(404).json({ error: "POST_NOT_FOUND" });
    if (post.authorId !== user.id) return requireAdmin(req, res, next);

    const first = await prisma.forumPost.findFirst({
      where: { threadId: post.threadId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (first?.id === post.id) return requireAdmin(req, res, next);

    await prisma.forumPost.delete({ where: { id: post.id } });
    return res.json({ ok: true });
  }),
  asyncHandler(async (req, res) => {
    await prisma.forumPost.delete({ where: { id: req.params.id } }).catch(() => {});
    return res.json({ ok: true });
  })
);

// ── ADMIN: DELETE /forum/threads/:id ── delete a thread
forumRouter.delete(
  "/forum/threads/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const thread = await prisma.forumThread.findUnique({ where: { id } });
    if (!thread) return res.status(404).json({ error: "THREAD_NOT_FOUND" });

    await prisma.forumThread.delete({ where: { id } });
    return res.json({ ok: true });
  })
);

// ── ADMIN: PATCH /forum/threads/:id/lock ── lock/unlock a thread
forumRouter.patch(
  "/forum/threads/:id/lock",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { locked } = req.body;

    const thread = await prisma.forumThread.findUnique({ where: { id } });
    if (!thread) return res.status(404).json({ error: "THREAD_NOT_FOUND" });

    await prisma.forumThread.update({
      where: { id },
      data: { isLocked: locked === true },
    });

    return res.json({ ok: true });
  })
);

// ── ADMIN: PATCH /forum/threads/:id/pin ── fijar / desfijar un tema
forumRouter.patch(
  "/forum/threads/:id/pin",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { pinned } = req.body;

    const thread = await prisma.forumThread.findUnique({ where: { id } });
    if (!thread) return res.status(404).json({ error: "THREAD_NOT_FOUND" });

    await prisma.forumThread.update({
      where: { id },
      data: { isPinned: pinned === true },
    });

    return res.json({ ok: true });
  })
);

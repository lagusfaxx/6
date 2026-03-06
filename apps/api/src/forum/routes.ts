import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { requireAdmin } from "../auth/middleware";
import { broadcast } from "../realtime/sse";

export const forumRouter = Router();

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
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const thread = await prisma.forumThread.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { posts: true } },
      },
    });

    if (!thread) return res.status(404).json({ error: "THREAD_NOT_FOUND" });

    // Increment views
    await prisma.forumThread.update({ where: { id }, data: { views: { increment: 1 } } });

    const [posts, total] = await Promise.all([
      prisma.forumPost.findMany({
        where: { threadId: id },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
        include: {
          author: { select: { id: true, username: true, avatarUrl: true } },
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
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  })
);

// ── POST /forum/threads ── create a new thread (auth required)
forumRouter.post(
  "/forum/threads",
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "UNAUTHENTICATED" });

    const { categoryId, title, content } = req.body;
    if (!categoryId || !title?.trim() || !content?.trim()) {
      return res.status(400).json({ error: "MISSING_FIELDS" });
    }

    if (title.trim().length > 200) {
      return res.status(400).json({ error: "TITLE_TOO_LONG" });
    }

    const category = await prisma.forumCategory.findUnique({ where: { id: categoryId } });
    if (!category) return res.status(404).json({ error: "CATEGORY_NOT_FOUND" });

    const thread = await prisma.forumThread.create({
      data: {
        categoryId,
        authorId: user.id,
        title: title.trim(),
        posts: {
          create: {
            authorId: user.id,
            content: content.trim(),
          },
        },
      },
      include: {
        author: { select: { id: true, username: true, avatarUrl: true } },
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    // Broadcast to all connected users
    broadcast("forum:newThread", {
      id: thread.id,
      title: thread.title,
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
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "UNAUTHENTICATED" });

    const { id } = req.params;
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "MISSING_CONTENT" });

    const thread = await prisma.forumThread.findUnique({
      where: { id },
      select: { id: true, isLocked: true, authorId: true, title: true },
    });
    if (!thread) return res.status(404).json({ error: "THREAD_NOT_FOUND" });
    if (thread.isLocked) return res.status(403).json({ error: "THREAD_LOCKED" });

    const [post] = await Promise.all([
      prisma.forumPost.create({
        data: { threadId: id, authorId: user.id, content: content.trim() },
        include: {
          author: { select: { id: true, username: true, avatarUrl: true } },
        },
      }),
      prisma.forumThread.update({
        where: { id },
        data: { lastPostAt: new Date() },
      }),
    ]);

    // Broadcast new post
    broadcast("forum:newPost", {
      threadId: id,
      post: {
        id: post.id,
        content: post.content,
        author: post.author,
        createdAt: post.createdAt,
      },
    });

    // Notify thread author if different from poster
    if (thread.authorId !== user.id) {
      await prisma.notification.create({
        data: {
          userId: thread.authorId,
          type: "FORUM_REPLY",
          data: {
            title: "Respuesta en el foro",
            body: `${post.author.username} respondió en "${thread.title}"`,
            threadId: id,
            url: `/foro/thread/${id}`,
          },
        },
      });
    }

    return res.status(201).json({ post });
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

// ── ADMIN: DELETE /forum/posts/:id ── delete a post
forumRouter.delete(
  "/forum/posts/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const post = await prisma.forumPost.findUnique({ where: { id } });
    if (!post) return res.status(404).json({ error: "POST_NOT_FOUND" });

    await prisma.forumPost.delete({ where: { id } });
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

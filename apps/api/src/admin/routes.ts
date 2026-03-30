import { Router } from "express";
import { prisma } from "../db";
import { requireAdmin } from "../auth/middleware";
import { CreatePostSchema } from "@uzeed/shared";
import multer from "multer";
import path from "path";
import { config } from "../config";
import { LocalStorageProvider } from "../storage/localStorageProvider";
import { asyncHandler } from "../lib/asyncHandler";

export const adminRouter = Router();

const storageProvider = new LocalStorageProvider({
  baseDir: config.storageDir,
  publicPathPrefix: `${config.apiUrl.replace(/\/$/, "")}/uploads`,
});

const mediaFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  const mime = (file.mimetype || "").toLowerCase();
  if (!mime.startsWith("image/") && !mime.startsWith("video/")) {
    return cb(new Error("INVALID_FILE_TYPE"));
  }
  return cb(null, true);
};

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      await storageProvider.ensureBaseDir();
      cb(null, config.storageDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || "";
      const safeBase = path
        .basename(file.originalname, ext)
        .replace(/[^a-zA-Z0-9_-]/g, "");
      const name = `${Date.now()}-${safeBase}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: mediaFilter,
});

adminRouter.use(requireAdmin);

adminRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const [users, posts, payments] = await Promise.all([
      prisma.user.count(),
      prisma.post.count(),
      prisma.payment.count(),
    ]);
    return res.json({ users, posts, payments });
  }),
);

adminRouter.get(
  "/control-center",
  asyncHandler(async (req, res) => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const adminId = req.session.userId!;

    const [
      activeUsersToday,
      pendingVerifications,
      pendingDeposits,
      pendingWithdrawals,
      pendingReportsCount,
      deposits,
      withdrawals,
      recentProfiles,
      forumPosts,
      adminNotificationsRaw,
    ] = await Promise.all([
      prisma.user.count({
        where: {
          OR: [{ isOnline: true }, { lastSeen: { gte: startOfDay } }],
        },
      }),
      prisma.user.count({
        where: {
          isVerified: false,
          profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] },
        },
      }),
      prisma.tokenDeposit.count({ where: { status: "PENDING" } }),
      prisma.withdrawalRequest.count({ where: { status: "PENDING" } }),
      Promise.resolve(0),
      prisma.tokenDeposit.findMany({
        take: 3,
        orderBy: { createdAt: "desc" },
        include: {
          wallet: { include: { user: { select: { username: true } } } },
        },
      }),
      prisma.withdrawalRequest.findMany({
        take: 3,
        orderBy: { createdAt: "desc" },
        include: {
          wallet: { include: { user: { select: { username: true } } } },
        },
      }),
      prisma.user.findMany({
        where: {
          profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] },
        },
        take: 2,
        orderBy: { createdAt: "desc" },
        select: { username: true, createdAt: true },
      }),
      prisma.forumPost.findMany({
        take: 2,
        orderBy: { createdAt: "desc" },
        include: { author: { select: { username: true } } },
      }),
      prisma.notification.findMany({
        where: { userId: adminId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, createdAt: true, readAt: true, data: true },
      }),
    ]);

    const activity = [
      ...deposits.map((item) => ({
        type: "deposit_submitted",
        label: "Nuevo depósito enviado",
        user: item.wallet.user.username,
        timestamp: item.createdAt.toISOString(),
      })),
      ...withdrawals.map((item) => ({
        type: "withdrawal_requested",
        label: "Nueva solicitud de retiro",
        user: item.wallet.user.username,
        timestamp: item.createdAt.toISOString(),
      })),
      ...recentProfiles.map((item) => ({
        type: "profile_registered",
        label: "Nuevo perfil registrado",
        user: item.username,
        timestamp: item.createdAt.toISOString(),
      })),
      ...forumPosts.map((item) => ({
        type: "forum_comment",
        label: "Nuevo comentario en foro",
        user: item.author.username,
        timestamp: item.createdAt.toISOString(),
      })),
    ]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, 10);

    const notifications = adminNotificationsRaw
      .map((n) => ({ ...n, data: (n.data || {}) as any }))
      .filter((n) =>
        [
          "deposit_submitted",
          "withdrawal_requested",
          "profile_verification_requested",
          "content_reported",
          "deletion_requested",
        ].includes(String(n.data.type || "")),
      )
      .map((n) => {
        const data = n.data;
        return {
          id: n.id,
          type: data.type || "admin_event",
          title: data.title || "Notificación",
          body: data.body || "Evento administrativo",
          url: data.url || "/admin",
          timestamp: n.createdAt.toISOString(),
          readAt: n.readAt ? n.readAt.toISOString() : null,
          user: data.user || null,
          amount: data.amount || null,
        };
      });

    const pendingReports =
      notifications.filter((n) => n.type === "content_reported" && !n.readAt)
        .length || pendingReportsCount;

    return res.json({
      metrics: {
        activeUsersToday,
        pendingVerifications,
        pendingDeposits,
        pendingWithdrawals,
        pendingReports,
      },
      actions: {
        pendingVerifications,
        pendingDeposits,
        pendingWithdrawals,
        pendingReports,
      },
      recentActivity: activity,
      notifications,
    });
  }),
);

adminRouter.get(
  "/posts",
  asyncHandler(async (_req, res) => {
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      include: { media: true },
    });
    return res.json({
      posts: posts.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        media: p.media.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        })),
      })),
    });
  }),
);

adminRouter.post(
  "/posts",
  upload.array("files", 10),
  asyncHandler(async (req, res) => {
    const { title, body, isPublic, price } = req.body as Record<string, string>;
    const payload = {
      title,
      body,
      isPublic: isPublic === "true",
      price: price ? Number(price) : 0,
    };
    const parsed = CreatePostSchema.safeParse(payload);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "VALIDATION", details: parsed.error.flatten() });

    const post = await prisma.post.create({
      data: {
        authorId: req.session.userId!,
        title: parsed.data.title,
        body: parsed.data.body,
        isPublic: parsed.data.isPublic,
        price: parsed.data.price,
      },
    });

    const files = (req.files as Express.Multer.File[]) ?? [];
    const media = [];
    for (const file of files) {
      const mime = (file.mimetype || "").toLowerCase();
      const type = mime.startsWith("video/") ? "VIDEO" : "IMAGE";
      const url = storageProvider.publicUrl(file.filename);
      media.push(
        await prisma.media.create({ data: { postId: post.id, type, url } }),
      );
    }
    const hasVideo = media.some((m) => m.type === "VIDEO");
    if (hasVideo) {
      await prisma.post.update({
        where: { id: post.id },
        data: { type: "VIDEO" },
      });
    }

    return res.json({ post: { ...post, media } });
  }),
);

adminRouter.put(
  "/posts/:id",
  asyncHandler(async (req, res) => {
    const parsed = CreatePostSchema.partial().safeParse(req.body);
    if (!parsed.success)
      return res
        .status(400)
        .json({ error: "VALIDATION", details: parsed.error.flatten() });

    const post = await prisma.post.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    return res.json({ post });
  }),
);

adminRouter.delete(
  "/posts/:id",
  asyncHandler(async (req, res) => {
    await prisma.post.delete({ where: { id: req.params.id } });
    return res.json({ ok: true });
  }),
);

adminRouter.post(
  "/posts/:id/media",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "NO_FILE" });
    const mime = (req.file.mimetype || "").toLowerCase();
    const type = mime.startsWith("video/") ? "VIDEO" : "IMAGE";
    const url = storageProvider.publicUrl(req.file.filename);

    const media = await prisma.media.create({
      data: { postId: req.params.id, type, url },
    });
    if (type === "VIDEO") {
      await prisma.post.update({
        where: { id: req.params.id },
        data: { type: "VIDEO" },
      });
    }

    return res.json({ media });
  }),
);

/* ══════════════════════════════════════════════════════════════
   PROFILES (Admin Management)
   ══════════════════════════════════════════════════════════════ */

adminRouter.get(
  "/profiles",
  asyncHandler(async (req, res) => {
    const { profileType, isActive, q, limit, offset } = req.query as Record<
      string,
      string | undefined
    >;
    const take = Math.min(parseInt(limit || "50", 10) || 50, 200);
    const skip = parseInt(offset || "0", 10) || 0;

    const where: any = {};
    if (profileType) where.profileType = profileType;
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (q) {
      where.OR = [
        { displayName: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }

    const [profiles, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          coverUrl: true,
          profileType: true,
          isActive: true,
          isOnline: true,
          lastSeen: true,
          city: true,
          isVerified: true,
          profileTags: true,
          tier: true,
          role: true,
          membershipExpiresAt: true,
          completedServices: true,
          profileViews: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.user.count({ where }),
    ]);

    return res.json({ profiles, total });
  }),
);

const ADMIN_CONTROLLED_LABELS = new Set([
  "premium",
  "verificada",
  "profesional con examenes",
]);

adminRouter.put(
  "/profiles/:id/labels",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { premium, verified, exams } = req.body ?? {};

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, profileTags: true },
    });
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });

    const current = Array.isArray(user.profileTags) ? user.profileTags : [];
    const baseTags = current.filter((tag) => !ADMIN_CONTROLLED_LABELS.has(tag));

    const nextTags = [...baseTags];
    if (premium === true) nextTags.push("premium");
    if (verified === true) nextTags.push("verificada");
    if (exams === true) nextTags.push("profesional con examenes");

    const updated = await prisma.user.update({
      where: { id },
      data: { profileTags: nextTags },
      select: { id: true, username: true, profileTags: true },
    });

    return res.json({ profile: updated });
  }),
);

adminRouter.put(
  "/profiles/:id/toggle",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: { isActive: true },
    });
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: { id: true, username: true, isActive: true },
    });
    return res.json({ profile: updated });
  }),
);

adminRouter.put(
  "/profiles/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { isActive, tier, role, membershipExpiresAt } = req.body ?? {};

    const data: any = {};
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (tier !== undefined) data.tier = tier;
    if (role !== undefined) data.role = role;
    if (membershipExpiresAt !== undefined) {
      data.membershipExpiresAt = membershipExpiresAt
        ? new Date(membershipExpiresAt)
        : null;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        username: true,
        displayName: true,
        isActive: true,
        tier: true,
        role: true,
        membershipExpiresAt: true,
      },
    });
    return res.json({ profile: updated });
  }),
);

adminRouter.delete(
  "/profiles/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });

    await prisma.$transaction(async (tx) => {
      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.story.deleteMany({ where: { userId: id } });
      await tx.pushSubscription.deleteMany({ where: { userId: id } });
      await tx.favorite.deleteMany({
        where: { OR: [{ userId: id }, { professionalId: id }] },
      });
      await tx.profileMedia.deleteMany({ where: { ownerId: id } });
      await tx.serviceItem.deleteMany({ where: { ownerId: id } });
      await tx.message.deleteMany({
        where: { OR: [{ fromId: id }, { toId: id }] },
      });
      await tx.user.delete({ where: { id } });
    });

    return res.json({ ok: true });
  }),
);

/* ══════════════════════════════════════════════════════════════
   VERIFICATION (Pending Profiles)
   ══════════════════════════════════════════════════════════════ */

adminRouter.get(
  "/verification/pending",
  asyncHandler(async (req, res) => {
    const { q, limit, offset } = req.query as Record<
      string,
      string | undefined
    >;
    const take = Math.min(parseInt(limit || "50", 10) || 50, 200);
    const skip = parseInt(offset || "0", 10) || 0;

    const where: any = {
      isVerified: false,
      profileType: { in: ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] },
    };
    if (q) {
      where.OR = [
        { displayName: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
      ];
    }

    const [profiles, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          coverUrl: true,
          profileType: true,
          isActive: true,
          phone: true,
          city: true,
          address: true,
          bio: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.user.count({ where }),
    ]);

    return res.json({ profiles, total });
  }),
);

adminRouter.put(
  "/verification/:id/approve",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { verifiedByPhone } = req.body ?? {};
    const user = await prisma.user.findUnique({
      where: { id },
      select: { isVerified: true, profileType: true },
    });
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });

    const updated = await prisma.user.update({
      where: { id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedByPhone: verifiedByPhone ? String(verifiedByPhone) : null,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        isVerified: true,
        profileType: true,
      },
    });
    return res.json({ profile: updated });
  }),
);

adminRouter.put(
  "/verification/:id/reject",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      select: { isVerified: true },
    });
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: {
        id: true,
        username: true,
        displayName: true,
        isVerified: true,
        isActive: true,
      },
    });
    return res.json({ profile: updated });
  }),
);

adminRouter.get("/profiles/:id/media-videos", requireAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const media = await prisma.profileMedia.findMany({
    where: { ownerId: id, type: "VIDEO" },
    orderBy: { createdAt: "desc" },
    select: { id: true, url: true, type: true, createdAt: true },
  });
  return res.json({ media });
}));

/* ══════════════════════════════════════════════════════════════
   BANNERS (Home Ads)
   ══════════════════════════════════════════════════════════════ */

adminRouter.get(
  "/banners",
  asyncHandler(async (_req, res) => {
    const banners = await prisma.banner.findMany({
      orderBy: [
        { sortOrder: "asc" },
        { createdAt: "desc" },
      ],
    });
    return res.json({ banners });
  }),
);

adminRouter.post(
  "/banners",
  asyncHandler(async (req, res) => {
    const {
      title,
      imageUrl,
      linkUrl,
      position,
      isActive,
      sortOrder,
      professionalId,
      promoImageUrl,
      startsAt,
      endsAt,
      adTier,
      imageFocusX,
      imageFocusY,
      imageZoom,
    } =
      req.body ?? {};
    if (!title)
      return res
        .status(400)
        .json({ error: "VALIDATION", message: "title required" });

    const kind = position ? String(position).toUpperCase() : "RIGHT";
    const isPopupPromo = kind === "POPUP_PROMO";

    if (isPopupPromo) {
      if (!professionalId) {
        return res.status(400).json({ error: "VALIDATION", message: "professionalId required for popup promo" });
      }
      if (!promoImageUrl && !imageUrl) {
        return res.status(400).json({ error: "VALIDATION", message: "promoImageUrl required for popup promo" });
      }
    } else if (!imageUrl) {
      return res.status(400).json({ error: "VALIDATION", message: "imageUrl required" });
    }

    const banner = await prisma.banner.create({
      data: {
        title: String(title),
        imageUrl: String(imageUrl || promoImageUrl || ""),
        linkUrl: linkUrl ? String(linkUrl) : null,
        position: kind,
        isActive: typeof isActive === "boolean" ? isActive : true,
        sortOrder:
          typeof sortOrder === "number"
            ? sortOrder
            : parseInt(String(sortOrder ?? "0"), 10) || 0,
        professionalId: professionalId ? String(professionalId) : null,
        promoImageUrl: promoImageUrl ? String(promoImageUrl) : null,
        startsAt: startsAt ? new Date(String(startsAt)) : null,
        endsAt: endsAt ? new Date(String(endsAt)) : null,
        adTier: String(adTier || "STANDARD").toUpperCase() === "GOLD" ? "GOLD" : "STANDARD",
        imageFocusX: typeof imageFocusX === "number" ? Math.max(0, Math.min(100, imageFocusX)) : 50,
        imageFocusY: typeof imageFocusY === "number" ? Math.max(0, Math.min(100, imageFocusY)) : 20,
        imageZoom: typeof imageZoom === "number" ? Math.max(1, Math.min(3, imageZoom)) : 1,
      },
    });
    return res.json({ banner });
  }),
);

adminRouter.post(
  "/banners/upload",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file)
      return res
        .status(400)
        .json({ error: "VALIDATION", message: "file required" });
    const url = storageProvider.publicUrl(req.file.filename);
    return res.json({ url });
  }),
);

adminRouter.put(
  "/banners/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      title,
      imageUrl,
      linkUrl,
      position,
      isActive,
      sortOrder,
      professionalId,
      promoImageUrl,
      startsAt,
      endsAt,
      adTier,
      imageFocusX,
      imageFocusY,
      imageZoom,
    } = req.body ?? {};
    const banner = await prisma.banner.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: String(title) } : {}),
        ...(imageUrl !== undefined ? { imageUrl: String(imageUrl) } : {}),
        ...(linkUrl !== undefined
          ? { linkUrl: linkUrl ? String(linkUrl) : null }
          : {}),
        ...(position !== undefined ? { position: String(position) } : {}),
        ...(isActive !== undefined ? { isActive: Boolean(isActive) } : {}),
        ...(sortOrder !== undefined
          ? {
              sortOrder:
                typeof sortOrder === "number"
                  ? sortOrder
                  : parseInt(String(sortOrder), 10) || 0,
            }
          : {}),
        ...(professionalId !== undefined ? { professionalId: professionalId ? String(professionalId) : null } : {}),
        ...(promoImageUrl !== undefined ? { promoImageUrl: promoImageUrl ? String(promoImageUrl) : null } : {}),
        ...(startsAt !== undefined ? { startsAt: startsAt ? new Date(String(startsAt)) : null } : {}),
        ...(endsAt !== undefined ? { endsAt: endsAt ? new Date(String(endsAt)) : null } : {}),
        ...(adTier !== undefined ? { adTier: String(adTier).toUpperCase() === "GOLD" ? "GOLD" : "STANDARD" } : {}),
        ...(imageFocusX !== undefined ? { imageFocusX: Math.max(0, Math.min(100, Number(imageFocusX) || 50)) } : {}),
        ...(imageFocusY !== undefined ? { imageFocusY: Math.max(0, Math.min(100, Number(imageFocusY) || 20)) } : {}),
        ...(imageZoom !== undefined ? { imageZoom: Math.max(1, Math.min(3, Number(imageZoom) || 1)) } : {}),
      },
    });
    return res.json({ banner });
  }),
);

adminRouter.delete(
  "/banners/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await prisma.banner.delete({ where: { id } });
    return res.json({ ok: true });
  }),
);

/* ══════════════════════════════════════════════════════════════
   PRICING RULES
   ══════════════════════════════════════════════════════════════ */

adminRouter.get(
  "/pricing-rules",
  asyncHandler(async (_req, res) => {
    try {
      const rules: any[] =
        await prisma.$queryRaw`SELECT id, kind, tier, "priceClp", days, "isActive", "createdAt", "updatedAt" FROM "PricingRule" ORDER BY kind, tier`;
      return res.json({ rules });
    } catch {
      return res.json({ rules: [] });
    }
  }),
);

adminRouter.put(
  "/pricing-rules",
  asyncHandler(async (req, res) => {
    const { rules } = req.body ?? {};
    if (!Array.isArray(rules))
      return res
        .status(400)
        .json({ error: "VALIDATION", message: "rules array required" });

    const results: any[] = [];
    for (const r of rules) {
      if (r.id) {
        const updated: any[] = await prisma.$queryRaw`
        UPDATE "PricingRule"
        SET kind = ${r.kind}::"PricingKind", tier = ${r.tier || null}::"ProfessionalTier",
            "priceClp" = ${Number(r.priceClp)}, days = ${Number(r.days)},
            "isActive" = ${Boolean(r.isActive)}, "updatedAt" = now()
        WHERE id = ${r.id}::uuid
        RETURNING *`;
        if (updated.length) results.push(updated[0]);
      } else {
        const created: any[] = await prisma.$queryRaw`
        INSERT INTO "PricingRule" (kind, tier, "priceClp", days, "isActive")
        VALUES (${r.kind}::"PricingKind", ${r.tier || null}::"ProfessionalTier",
                ${Number(r.priceClp)}, ${Number(r.days)}, ${Boolean(r.isActive)})
        RETURNING *`;
        if (created.length) results.push(created[0]);
      }
    }

    const all: any[] =
      await prisma.$queryRaw`SELECT * FROM "PricingRule" ORDER BY kind, tier`;
    return res.json({ rules: all });
  }),
);

/* ══════════════════════════════════════════════════════════════
   QUICK LISTINGS (External Establishments)
   Admin can add motels, sexshops, etc. without creating a user
   account. These show on the map and link to the external site.
   ══════════════════════════════════════════════════════════════ */

adminRouter.get(
  "/quick-listings",
  asyncHandler(async (req, res) => {
    const { categoryId, q, limit, offset } = req.query as Record<string, string | undefined>;
    const take = Math.min(parseInt(limit || "50", 10) || 50, 200);
    const skip = parseInt(offset || "0", 10) || 0;

    const where: any = { externalOnly: true };
    if (categoryId) where.categoryId = categoryId;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { city: { contains: q, mode: "insensitive" } },
        { address: { contains: q, mode: "insensitive" } },
      ];
    }

    const [listings, total] = await Promise.all([
      prisma.establishment.findMany({
        where,
        include: { category: { select: { id: true, name: true, displayName: true, slug: true } } },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.establishment.count({ where }),
    ]);

    return res.json({ listings, total });
  }),
);

adminRouter.post(
  "/quick-listings",
  asyncHandler(async (req, res) => {
    const { name, address, city, phone, description, categoryId, websiteUrl, latitude, longitude } = req.body ?? {};

    if (!name || !address || !city || !categoryId) {
      return res.status(400).json({ error: "VALIDATION", message: "name, address, city and categoryId are required" });
    }

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) return res.status(400).json({ error: "VALIDATION", message: "Invalid categoryId" });

    const listing = await prisma.establishment.create({
      data: {
        name: String(name),
        address: String(address),
        city: String(city),
        phone: phone ? String(phone) : "",
        description: description ? String(description) : null,
        categoryId: String(categoryId),
        websiteUrl: websiteUrl ? String(websiteUrl) : null,
        latitude: latitude != null ? Number(latitude) : null,
        longitude: longitude != null ? Number(longitude) : null,
        externalOnly: true,
      },
      include: { category: { select: { id: true, name: true, displayName: true, slug: true } } },
    });

    return res.json({ listing });
  }),
);

adminRouter.put(
  "/quick-listings/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, address, city, phone, description, categoryId, websiteUrl, latitude, longitude } = req.body ?? {};

    const data: any = {};
    if (name !== undefined) data.name = String(name);
    if (address !== undefined) data.address = String(address);
    if (city !== undefined) data.city = String(city);
    if (phone !== undefined) data.phone = String(phone);
    if (description !== undefined) data.description = description ? String(description) : null;
    if (categoryId !== undefined) data.categoryId = String(categoryId);
    if (websiteUrl !== undefined) data.websiteUrl = websiteUrl ? String(websiteUrl) : null;
    if (latitude !== undefined) data.latitude = latitude != null ? Number(latitude) : null;
    if (longitude !== undefined) data.longitude = longitude != null ? Number(longitude) : null;

    const listing = await prisma.establishment.update({
      where: { id },
      data,
      include: { category: { select: { id: true, name: true, displayName: true, slug: true } } },
    });
    return res.json({ listing });
  }),
);

adminRouter.delete(
  "/quick-listings/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await prisma.establishment.delete({ where: { id } });
    return res.json({ ok: true });
  }),
);

adminRouter.post(
  "/quick-listings/:id/upload",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: "NO_FILE" });

    const listing = await prisma.establishment.findUnique({ where: { id }, select: { galleryUrls: true } });
    if (!listing) return res.status(404).json({ error: "NOT_FOUND" });

    const url = storageProvider.publicUrl(req.file.filename);
    const galleryUrls = [...(listing.galleryUrls || []), url];

    await prisma.establishment.update({ where: { id }, data: { galleryUrls } });
    return res.json({ url, galleryUrls });
  }),
);

adminRouter.delete(
  "/quick-listings/:id/gallery",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { url } = req.body ?? {};
    if (!url) return res.status(400).json({ error: "VALIDATION", message: "url required" });

    const listing = await prisma.establishment.findUnique({ where: { id }, select: { galleryUrls: true } });
    if (!listing) return res.status(404).json({ error: "NOT_FOUND" });

    const galleryUrls = (listing.galleryUrls || []).filter((u) => u !== url);
    await prisma.establishment.update({ where: { id }, data: { galleryUrls } });
    return res.json({ ok: true, galleryUrls });
  }),
);

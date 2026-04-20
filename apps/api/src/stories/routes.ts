import { Router } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { prisma } from "../db";
import { Prisma } from "@prisma/client";
import { requireAuth } from "../auth/middleware";
import { config } from "../config";
import { LocalStorageProvider } from "../storage/localStorageProvider";
import { asyncHandler } from "../lib/asyncHandler";
import { optimizeUploadedImage } from "../lib/imageOptimizer";
import { obfuscateLocation } from "../lib/locationPrivacy";

export const storiesRouter = Router();

const storageProvider = new LocalStorageProvider({
  baseDir: config.storageDir,
  publicPathPrefix: `${config.apiUrl.replace(/\/$/, "")}/uploads`,
});

const uploadMedia = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      await storageProvider.ensureBaseDir();
      cb(null, config.storageDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || "";
      const name = `story-${Date.now()}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB for video
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || "").toLowerCase();
    if (mime.startsWith("image/") || mime.startsWith("video/")) {
      return cb(null, true);
    }
    return cb(new Error("INVALID_FILE_TYPE"));
  },
});

const STORY_TTL_HOURS = 24 * 20; // 20 days

/* ─── GET /stories/active ─────────────────────────────────────
   Returns active stories (not expired) for a city/area.
   Query: lat, lng, radiusKm (optional — defaults to 100 km)
   Returns stories with owner info for the Story viewer.
   ─────────────────────────────────────────────────────────── */
const ANON_COOKIE = "uzeed_anon_id";

function getOrSetAnonId(req: any, res: any): string {
  let id = req.cookies?.[ANON_COOKIE];
  if (!id || typeof id !== "string" || id.length < 8) {
    id = crypto.randomUUID();
    res.cookie(ANON_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: config.env !== "development",
      domain: config.cookieDomain,
      maxAge: 1000 * 60 * 60 * 24 * 365,
    });
  }
  return id;
}

storiesRouter.get(
  "/stories/active",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const lat = req.query.lat ? Number(req.query.lat) : null;
    const lng = req.query.lng ? Number(req.query.lng) : null;
    const radiusKm = Math.max(1, Math.min(200, Number(req.query.radiusKm) || 100));
    const viewerUserId = (req as any).user?.id as string | undefined;
    const anonId = req.cookies?.[ANON_COOKIE] as string | undefined;

    function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
      const R = 6371;
      const toRad = (n: number) => (n * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // Fetch active stories — gracefully handle missing Story table
    let stories: any[] = [];
    try {
    stories = await prisma.story.findMany({
      where: { expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        mediaUrl: true,
        mediaType: true,
        expiresAt: true,
        createdAt: true,
        likeCount: true,
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            latitude: true,
            longitude: true,
            profileType: true,
            isActive: true,
            lastSeen: true,
          },
        },
      },
    });
    } catch (err) {
      // Story table might not exist yet (migration pending)
      if (
        err instanceof Prisma.PrismaClientKnownRequestError ||
        err instanceof Prisma.PrismaClientValidationError
      ) {
        console.warn("[stories/active] Story table not available yet:", (err as Error).message?.slice(0, 120));
        return res.json({ stories: [] });
      }
      throw err;
    }

    // Group by user, filter by location if provided
    const byUser = new Map<string, { user: any; stories: any[] }>();
    for (const s of stories) {
      if (!s.user.isActive) continue;
      // location filter
      if (lat != null && lng != null && s.user.latitude != null && s.user.longitude != null) {
        const dist = haversineKm(lat, lng, s.user.latitude, s.user.longitude);
        if (dist > radiusKm) continue;
      }
      if (!byUser.has(s.user.id)) {
        byUser.set(s.user.id, { user: s.user, stories: [] });
      }
      byUser.get(s.user.id)!.stories.push(s);
    }

    // Compute which visible stories the viewer liked (single query)
    const visibleIds = Array.from(byUser.values()).flatMap(({ stories }) => stories.map((s) => s.id));
    const likedIds = new Set<string>();
    if (visibleIds.length > 0 && (viewerUserId || anonId)) {
      try {
        const likes = await prisma.storyLike.findMany({
          where: {
            storyId: { in: visibleIds },
            OR: [
              ...(viewerUserId ? [{ userId: viewerUserId }] : []),
              ...(anonId ? [{ anonymousId: anonId }] : []),
            ],
          },
          select: { storyId: true },
        });
        for (const l of likes) likedIds.add(l.storyId);
      } catch {
        // StoryLike table might not exist yet (migration pending) — ignore
      }
    }

    const result = Array.from(byUser.values()).map(({ user, stories: userStories }) => ({
      userId: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      avatarUrl: user.avatarUrl,
      profileHref: user.profileType === "ESTABLISHMENT" ? `/hospedaje/${user.id}` : `/profesional/${user.id}`,
      stories: userStories
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((s) => ({
          id: s.id,
          mediaUrl: s.mediaUrl,
          mediaType: s.mediaType,
          expiresAt: s.expiresAt.toISOString(),
          createdAt: s.createdAt.toISOString(),
          likeCount: s.likeCount ?? 0,
          likedByMe: likedIds.has(s.id),
        })),
    }));

    return res.json({ stories: result });
  }),
);

/* ─── POST /stories/upload ───────────────────────────────────
   Upload a new story (image or video). Auth required.
   Multipart: field "file"
   ─────────────────────────────────────────────────────────── */
storiesRouter.post(
  "/stories/upload",
  requireAuth,
  uploadMedia.single("file"),
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "UNAUTHENTICATED" });

    if (!req.file) return res.status(400).json({ error: "NO_FILE" });

    const mediaType = (req.file.mimetype || "").toLowerCase().startsWith("video/")
      ? "VIDEO"
      : "IMAGE";

    const finalFilename = mediaType === "IMAGE" ? await optimizeUploadedImage(req.file, "cover") : req.file.filename;
    const publicUrl = `${config.apiUrl.replace(/\/$/, "")}/uploads/${finalFilename}`;

    const expiresAt = new Date(Date.now() + STORY_TTL_HOURS * 60 * 60 * 1000);

    let story: any;
    try {
      story = await prisma.story.create({
        data: {
          userId: user.id,
          mediaUrl: publicUrl,
          mediaType: mediaType as "IMAGE" | "VIDEO",
          expiresAt,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError ||
        err instanceof Prisma.PrismaClientValidationError
      ) {
        return res.status(503).json({ error: "STORY_TABLE_NOT_READY", message: "La funcionalidad de stories aún no está disponible. Pendiente migración." });
      }
      throw err;
    }

    return res.status(201).json({
      story: {
        id: story.id,
        mediaUrl: story.mediaUrl,
        mediaType: story.mediaType,
        expiresAt: story.expiresAt.toISOString(),
        createdAt: story.createdAt.toISOString(),
      },
    });
  }),
);

/* ─── POST /stories/:id/like ─────────────────────────────────
   Toggle like on a story. Anonymous users (no session) can also
   like — identified by a long-lived httpOnly cookie (uzeed_anon_id).
   The story owner gets a single aggregated notification that
   increments its count instead of creating one per like.
   ─────────────────────────────────────────────────────────── */
storiesRouter.post(
  "/stories/:id/like",
  asyncHandler(async (req, res) => {
    const storyId = req.params.id;
    const viewerUser = (req as any).user;
    const viewerUserId = viewerUser?.id as string | undefined;

    const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, userId: true, expiresAt: true },
    });
    if (!story) return res.status(404).json({ error: "NOT_FOUND" });
    if (story.expiresAt.getTime() <= Date.now()) {
      return res.status(410).json({ error: "STORY_EXPIRED" });
    }

    // Can't self-like
    const isOwner = viewerUserId && viewerUserId === story.userId;

    const anonId = viewerUserId ? null : getOrSetAnonId(req, res);

    // Toggle: try to create; on unique conflict, delete (unlike)
    let liked: boolean;
    let likeCount: number;

    try {
      const result = await prisma.$transaction(async (tx) => {
        const created = await tx.storyLike.create({
          data: {
            storyId,
            userId: viewerUserId ?? null,
            anonymousId: anonId,
          },
        });
        const updated = await tx.story.update({
          where: { id: storyId },
          data: { likeCount: { increment: 1 } },
          select: { likeCount: true },
        });
        return { liked: true, likeCount: updated.likeCount, createdId: created.id };
      });
      liked = result.liked;
      likeCount = result.likeCount;
    } catch (err: any) {
      if (err?.code === "P2002") {
        // Already liked — unlike (toggle off)
        const result = await prisma.$transaction(async (tx) => {
          await tx.storyLike.deleteMany({
            where: viewerUserId
              ? { storyId, userId: viewerUserId }
              : { storyId, anonymousId: anonId! },
          });
          const fresh = await tx.story.findUnique({
            where: { id: storyId },
            select: { likeCount: true },
          });
          if (fresh && fresh.likeCount > 0) {
            const updated = await tx.story.update({
              where: { id: storyId },
              data: { likeCount: { decrement: 1 } },
              select: { likeCount: true },
            });
            return { liked: false, likeCount: updated.likeCount };
          }
          return { liked: false, likeCount: fresh?.likeCount ?? 0 };
        });
        return res.json({ liked: result.liked, likeCount: result.likeCount });
      }
      // StoryLike table might not exist yet (migration pending)
      if (
        err instanceof Prisma.PrismaClientKnownRequestError ||
        err instanceof Prisma.PrismaClientValidationError
      ) {
        return res.status(503).json({ error: "LIKES_NOT_READY" });
      }
      throw err;
    }

    // Aggregate notification for story owner — one per story, bumped on each like
    if (!isOwner) {
      try {
        const existing = await prisma.notification.findFirst({
          where: {
            userId: story.userId,
            type: "STORY_LIKE",
            readAt: null,
            data: { path: ["storyId"], equals: storyId } as any,
          },
          orderBy: { createdAt: "desc" },
        });

        const newCount = likeCount;
        const payload = {
          storyId,
          count: newCount,
          title: "❤️ Nuevo like en tu historia",
          body:
            newCount === 1
              ? "Alguien reaccionó a tu historia"
              : `${newCount} personas han reaccionado a tu historia`,
          url: "/dashboard/stories",
          tag: `story-like-${storyId}`,
        };

        if (existing) {
          // Refresh existing notification so it bubbles to the top with the new count.
          // Delete + create lets the Prisma middleware emit SSE + push naturally.
          // deleteMany is idempotent — safe against concurrent like races.
          await prisma.notification.deleteMany({ where: { id: existing.id } });
        }
        await prisma.notification.create({
          data: {
            userId: story.userId,
            type: "STORY_LIKE",
            data: payload,
          },
        });
      } catch (err) {
        console.error("[stories/like] notification aggregation failed:", (err as Error)?.message);
      }
    }

    return res.json({ liked, likeCount });
  }),
);

/* ─── DELETE /stories/:id ────────────────────────────────────
   Delete own story. Auth required.
   ─────────────────────────────────────────────────────────── */
storiesRouter.delete(
  "/stories/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: "UNAUTHENTICATED" });

    await prisma.story.deleteMany({
      where: { id: req.params.id, userId: user.id },
    });

    return res.json({ ok: true });
  }),
);

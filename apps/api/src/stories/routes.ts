import { Router } from "express";
import multer from "multer";
import path from "path";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { config } from "../config";
import { LocalStorageProvider } from "../storage/localStorageProvider";
import { asyncHandler } from "../lib/asyncHandler";

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

const STORY_TTL_HOURS = 24;

/* ─── GET /stories/active ─────────────────────────────────────
   Returns active stories (not expired) for a city/area.
   Query: lat, lng, radiusKm (optional — defaults to 100 km)
   Returns stories with owner info for the Story viewer.
   ─────────────────────────────────────────────────────────── */
storiesRouter.get(
  "/stories/active",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const lat = req.query.lat ? Number(req.query.lat) : null;
    const lng = req.query.lng ? Number(req.query.lng) : null;
    const radiusKm = Math.max(1, Math.min(200, Number(req.query.radiusKm) || 100));

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

    // Fetch active stories with owner profile info
    const stories = await prisma.story.findMany({
      where: { expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        mediaUrl: true,
        mediaType: true,
        expiresAt: true,
        createdAt: true,
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

    // Group by user, filter by location if provided
    const byUser = new Map<string, { user: (typeof stories)[0]["user"]; stories: typeof stories }>();
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

    const publicUrl = `${config.apiUrl.replace(/\/$/, "")}/uploads/${req.file.filename}`;

    const expiresAt = new Date(Date.now() + STORY_TTL_HOURS * 60 * 60 * 1000);

    const story = await prisma.story.create({
      data: {
        userId: user.id,
        mediaUrl: publicUrl,
        mediaType: mediaType as "IMAGE" | "VIDEO",
        expiresAt,
      },
    });

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

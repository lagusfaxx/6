import { Router } from "express";
import multer from "multer";
import path from "path";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { config } from "../config";
import { LocalStorageProvider } from "../storage/localStorageProvider";
import { isBusinessPlanActive } from "../lib/subscriptions";
import { validateUploadedFile } from "../lib/uploads";
import { asyncHandler } from "../lib/asyncHandler";

export const profileRouter = Router();

const storageProvider = new LocalStorageProvider({
  baseDir: config.storageDir,
  publicPathPrefix: `${config.apiUrl.replace(/\/$/, "")}/uploads`
});

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await storageProvider.ensureBaseDir();
    cb(null, config.storageDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, "");
    const name = `${Date.now()}-${safeBase}${ext}`;
    cb(null, name);
  }
});

const uploadImage = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = (file.mimetype || "").toLowerCase().startsWith("image/");
    if (!ok) return cb(new Error("INVALID_FILE_TYPE"));
    return cb(null, true);
  }
});

const uploadMedia = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }
});

profileRouter.get("/profiles", asyncHandler(async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const types = typeof req.query.types === "string" ? req.query.types.split(",").map((t) => t.trim()) : [];
  const where: any = {
    profileType: { in: types.length ? types : ["CREATOR", "PROFESSIONAL", "SHOP"] }
  };
  if (q) {
    where.OR = [
      { username: { contains: q, mode: "insensitive" } },
      { displayName: { contains: q, mode: "insensitive" } },
      { serviceCategory: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } }
    ];
  }

  const profiles = await prisma.user.findMany({
    where,
    select: {
      id: true,
      displayName: true,
      username: true,
      avatarUrl: true,
      coverUrl: true,
      bio: true,
      city: true,
      address: true,
      serviceCategory: true,
      serviceDescription: true,
      profileType: true,
      subscriptionPrice: true,
      membershipExpiresAt: true,
      shopTrialEndsAt: true,
      latitude: true,
      longitude: true
    }
  });

  const filtered = profiles.filter((p) => isBusinessPlanActive(p));

  return res.json({ profiles: filtered });
}));

profileRouter.get("/profiles/:username", asyncHandler(async (req, res) => {
  const username = req.params.username;
  const viewerId = req.session.userId || null;
  const profile = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      displayName: true,
      username: true,
      avatarUrl: true,
      coverUrl: true,
      bio: true,
      city: true,
      address: true,
      serviceCategory: true,
      serviceDescription: true,
      profileType: true,
      subscriptionPrice: true,
      membershipExpiresAt: true,
      shopTrialEndsAt: true,
      latitude: true,
      longitude: true
    }
  });
  if (!profile) return res.status(404).json({ error: "NOT_FOUND" });
  const isOwner = viewerId === profile.id;
  if (!isOwner && !isBusinessPlanActive(profile)) {
    return res.status(403).json({ error: "PLAN_EXPIRED" });
  }

  const posts = await prisma.post.findMany({
    where: { authorId: profile.id },
    orderBy: { createdAt: "desc" },
    include: { media: true }
  });

  const subscription = viewerId
    ? await prisma.profileSubscription.findUnique({
      where: { subscriberId_profileId: { subscriberId: viewerId, profileId: profile.id } }
    })
    : null;
  const isSubscribed =
    (!!subscription && subscription.status === "ACTIVE" && subscription.expiresAt.getTime() > Date.now()) ||
    (viewerId && viewerId === profile.id);

  const payload = posts.map((p) => {
    const paywalled = !p.isPublic && !isSubscribed;
    return {
      id: p.id,
      title: p.title,
      body: paywalled ? p.body.slice(0, 220) + "…" : p.body,
      createdAt: p.createdAt.toISOString(),
      isPublic: p.isPublic,
      media: paywalled ? [] : p.media.map((m) => ({ id: m.id, type: m.type, url: m.url })),
      preview: p.media[0] ? { id: p.media[0].id, type: p.media[0].type, url: p.media[0].url } : null,
      paywalled
    };
  });

  const serviceItems = await prisma.serviceItem.findMany({
    where: { ownerId: profile.id },
    orderBy: { createdAt: "desc" },
    include: { media: true }
  });

  const gallery = await prisma.profileMedia.findMany({
    where: { ownerId: profile.id },
    orderBy: { createdAt: "desc" }
  });

  return res.json({
    profile,
    isSubscribed,
    isOwner,
    subscriptionExpiresAt: subscription?.expiresAt.toISOString() || null,
    posts: payload,
    serviceItems,
    gallery
  });
}));

profileRouter.post("/profiles/:username/subscribe", requireAuth, asyncHandler(async (req, res) => {
  return res.status(410).json({ error: "USE_BILLING_START" });
}));

profileRouter.get("/profile/me", requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.session.userId! } });
  if (!user) return res.status(404).json({ error: "NOT_FOUND" });
  return res.json({ user });
}));

async function updateProfile(req: any, res: any) {
  const {
    displayName,
    bio,
    address,
    phone,
    preferenceGender,
    gender,
    username,
    subscriptionPrice,
    serviceCategory,
    serviceDescription,
    city,
    latitude,
    longitude,
    allowFreeMessages,
    birthdate
  } = req.body as Record<string, string | null>;
  const allowedGenders = new Set(["MALE", "FEMALE", "OTHER"]);
  const allowedPrefs = new Set(["MALE", "FEMALE", "ALL", "OTHER"]);
  const safeGender = gender && allowedGenders.has(gender) ? gender : undefined;
  const safePreference = preferenceGender && allowedPrefs.has(preferenceGender) ? preferenceGender : undefined;
  const priceValue = subscriptionPrice ? Number(subscriptionPrice) : undefined;
  const safePrice =
    priceValue !== undefined && Number.isFinite(priceValue)
      ? Math.max(100, Math.min(20000, priceValue))
      : undefined;
  const me = await prisma.user.findUnique({
    where: { id: req.session.userId! },
    select: { profileType: true }
  });
  if (!me) return res.status(404).json({ error: "NOT_FOUND" });
  if (me.profileType === "PROFESSIONAL" && bio !== undefined) {
    if (!bio || bio.trim().length < 20) {
      return res.status(400).json({
        error: "BIO_REQUIRED",
        message: "La descripción del perfil debe tener al menos 20 caracteres."
      });
    }
  }
  const canSetPrice = me.profileType === "CREATOR";
  const allowFree = allowFreeMessages === "true";
  let safeBirthdate: Date | null | undefined = undefined;
  if (birthdate !== undefined) {
    if (!birthdate) {
      safeBirthdate = null;
    } else {
      const parsed = new Date(birthdate);
      if (Number.isNaN(parsed.getTime())) {
        return res.status(400).json({ error: "BIRTHDATE_INVALID", message: "La fecha de nacimiento no es válida." });
      }
      const now = new Date();
      let age = now.getFullYear() - parsed.getFullYear();
      const m = now.getMonth() - parsed.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < parsed.getDate())) {
        age -= 1;
      }
      if (age < 18) {
        return res.status(400).json({ error: "BIRTHDATE_UNDERAGE", message: "Debes ser mayor de 18 años." });
      }
      safeBirthdate = parsed;
    }
  }
  const user = await prisma.user.update({
    where: { id: req.session.userId! },
    data: {
      displayName: displayName ?? undefined,
      bio: bio ?? undefined,
      address: address ?? undefined,
      phone: phone ?? undefined,
      preferenceGender: safePreference,
      gender: safeGender,
      username: username ?? undefined,
      subscriptionPrice: canSetPrice ? safePrice : undefined,
      allowFreeMessages: canSetPrice ? allowFree : undefined,
      serviceCategory: serviceCategory ?? undefined,
      serviceDescription: serviceDescription ?? undefined,
      city: city ?? undefined,
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
      birthdate: safeBirthdate
    }
  });
  return res.json({ user });
}

// Front (dashboard) usa PATCH; mantenemos PUT por compatibilidad.
profileRouter.put(
  "/profile",
  requireAuth,
  asyncHandler(async (req, res) => updateProfile(req, res))
);

profileRouter.patch(
  "/profile",
  requireAuth,
  asyncHandler(async (req, res) => updateProfile(req, res))
);

profileRouter.post("/profile/avatar", requireAuth, uploadImage.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "NO_FILE" });
  await validateUploadedFile(req.file, "image");
  const url = storageProvider.publicUrl(req.file.filename);
  const user = await prisma.user.update({
    where: { id: req.session.userId! },
    data: { avatarUrl: url }
  });
  return res.json({ user });
}));

profileRouter.post("/profile/cover", requireAuth, uploadImage.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "NO_FILE" });
  await validateUploadedFile(req.file, "image");
  const url = storageProvider.publicUrl(req.file.filename);
  const user = await prisma.user.update({
    where: { id: req.session.userId! },
    data: { coverUrl: url }
  });
  return res.json({ user });
}));

profileRouter.get("/profile/media", requireAuth, asyncHandler(async (req, res) => {
  const media = await prisma.profileMedia.findMany({
    where: { ownerId: req.session.userId! },
    orderBy: { createdAt: "desc" }
  });
  return res.json({ media });
}));

profileRouter.post("/profile/media", requireAuth, uploadMedia.array("files", 12), asyncHandler(async (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) return res.status(400).json({ error: "NO_FILES" });
  const media = [];
  for (const file of files) {
    const { type } = await validateUploadedFile(file, "image-or-video");
    const url = storageProvider.publicUrl(file.filename);
    media.push(
      await prisma.profileMedia.create({
        data: { ownerId: req.session.userId!, type, url }
      })
    );
  }
  return res.json({ media });
}));

profileRouter.delete("/profile/media/:id", requireAuth, asyncHandler(async (req, res) => {
  const media = await prisma.profileMedia.findUnique({ where: { id: req.params.id } });
  if (!media || media.ownerId !== req.session.userId!) return res.status(404).json({ error: "NOT_FOUND" });
  await prisma.profileMedia.delete({ where: { id: media.id } });
  return res.json({ ok: true });
}));

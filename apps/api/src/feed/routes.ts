import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { isBusinessPlanActive } from "../lib/subscriptions";
import { asyncHandler } from "../lib/asyncHandler";

export const feedRouter = Router();

async function handleFeed(req: any, res: any, mediaType?: "IMAGE" | "VIDEO") {
  const userId = req.session.userId as string | undefined;
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(24, Math.max(6, Number(req.query.limit || 12)));
  const tab = typeof req.query.tab === "string" ? req.query.tab : "for-you";
  const search = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const rawTypes = typeof req.query.types === "string" ? req.query.types.split(",").map((t) => t.trim()) : [];
  const categories = typeof req.query.categories === "string" ? req.query.categories.split(",").map((c) => c.trim()) : [];
  const sort = typeof req.query.sort === "string" ? req.query.sort : "new";
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ? Number(req.query.lng) : null;

  // Prisma enum is ProfileType (CREATOR | PROFESSIONAL | VIEWER | SHOP).
  // The UI/seed data sometimes uses PERSON/PERSONA; normalize that to VIEWER and
  // drop anything invalid to avoid Prisma "Invalid value for argument `in`".
  const validProfileTypes = new Set(["CREATOR", "PROFESSIONAL", "VIEWER", "SHOP"]);
  const types = rawTypes
    .map((t) => {
      const up = String(t || "").trim().toUpperCase();
      if (up === "PERSON" || up === "PERSONA") return "VIEWER";
      return up;
    })
    .filter((t) => validProfileTypes.has(t));

  const authorWhere: any = {
    // Default should include VIEWER so normal users see their own posts in the main feed.
    profileType: { in: types.length ? types : ["CREATOR", "PROFESSIONAL", "VIEWER"] }
  };

  // "Siguiendo" for UZEED = creators/pros you have an active subscription with.
  if (tab === "following") {
    if (!userId) {
      return res.json({ posts: [], nextPage: null });
    }
    const subs = await prisma.profileSubscription.findMany({
      where: { subscriberId: userId, status: "ACTIVE", expiresAt: { gt: new Date() } },
      select: { profileId: true }
    });
    const followingIds = subs.map((s) => s.profileId);
    if (!followingIds.length) {
      return res.json({ posts: [], nextPage: null });
    }
    authorWhere.id = { in: followingIds };
  }

  if (categories.length) {
    authorWhere.OR = categories.map((category) => ({
      serviceCategory: { contains: category, mode: "insensitive" }
    }));
  }

  const and: any[] = [];

  // Always allow the logged-in user to see their own posts in the feed.
  if (userId) {
    and.push({ OR: [{ author: authorWhere }, { authorId: userId }] });
  } else {
    and.push({ author: authorWhere });
  }

  if (mediaType) {
    and.push({ media: { some: { type: mediaType } } });
    and.push({ type: mediaType === "VIDEO" ? "VIDEO" : "IMAGE" });
  }

  if (search) {
    and.push({
      OR: [
        { title: { contains: search, mode: "insensitive" } },
        { body: { contains: search, mode: "insensitive" } },
        {
          author: {
            OR: [
              { username: { contains: search, mode: "insensitive" } },
              { displayName: { contains: search, mode: "insensitive" } },
              { serviceCategory: { contains: search, mode: "insensitive" } },
              { city: { contains: search, mode: "insensitive" } }
            ]
          }
        }
      ]
    });
  }

  const where: any = { AND: and };

  const posts = await prisma.post.findMany({
    orderBy: sort === "popular"
      ? [{ media: { _count: "desc" } }, { createdAt: "desc" }]
      : [{ createdAt: "desc" }],
    skip: (page - 1) * limit,
    take: limit,
    where,
    include: {
      media: true,
      author: {
        select: {
          id: true,
          displayName: true,
          username: true,
          avatarUrl: true,
          profileType: true,
          subscriptionPrice: true,
          coverUrl: true,
          bio: true,
          city: true,
          serviceCategory: true,
          latitude: true,
          longitude: true,
          membershipExpiresAt: true,
          shopTrialEndsAt: true
        }
      }
    }
  });

  const authorIds = Array.from(new Set(posts.map((p) => p.author?.id).filter(Boolean))) as string[];
  const ratings = authorIds.length
    ? await prisma.serviceRating.groupBy({
      by: ["profileId"],
      where: { profileId: { in: authorIds } },
      _avg: { rating: true }
    })
    : [];
  const ratingMap = new Map(ratings.map((r) => [r.profileId, r._avg.rating]));
  const subscriptions = userId && authorIds.length
    ? await prisma.profileSubscription.findMany({
      where: {
        subscriberId: userId,
        profileId: { in: authorIds },
        status: "ACTIVE",
        expiresAt: { gt: new Date() }
      }
    })
    : [];
  const subscriptionSet = new Set(subscriptions.map((s) => s.profileId));

  const payload = posts
    .filter((p) => {
      if (!p.author) return true;
      return isBusinessPlanActive(p.author);
    })
    .map((p) => {
      const author = p.author || {
        id: "unknown",
        displayName: "UZEED",
        username: "uzeed",
        avatarUrl: null,
        profileType: "CREATOR",
        subscriptionPrice: 2500,
        coverUrl: null,
        bio: null,
        city: null,
        serviceCategory: null,
        latitude: null,
        longitude: null
      };
      const rating = author.id ? ratingMap.get(author.id) ?? null : null;
      const isSubscribed = !!(userId && (userId === author.id || subscriptionSet.has(author.id)));
      const paywalled = !p.isPublic && !isSubscribed;
      const filteredMedia = mediaType
        ? p.media.filter((m) => m.type === mediaType)
        : p.media;
      const preview = filteredMedia[0]
        ? { id: filteredMedia[0].id, type: filteredMedia[0].type, url: filteredMedia[0].url }
        : null;
      const distance =
        lat !== null &&
        lng !== null &&
        author.latitude !== null &&
        author.longitude !== null
          ? Math.sqrt((author.latitude - lat) ** 2 + (author.longitude - lng) ** 2)
          : null;
      return {
        id: p.id,
        title: p.title,
        body: paywalled ? p.body.slice(0, 220) + "…" : p.body,
        createdAt: p.createdAt.toISOString(),
        price: p.price,
        isPublic: p.isPublic,
        media: paywalled ? [] : filteredMedia.map((m) => ({ id: m.id, type: m.type, url: m.url })),
        preview,
        paywalled,
        isSubscribed,
        distance,
        author: { ...author, rating: rating ? Number(rating) : null }
      };
    });

  const sortedPayload = sort === "near" && lat !== null && lng !== null
    ? [...payload].sort((a, b) => {
      if (a.distance === null && b.distance === null) return 0;
      if (a.distance === null) return 1;
      if (b.distance === null) return -1;
      return a.distance - b.distance;
    })
    : payload;

  // Keep response compatible with both clients:
  // - ReelsClient expects `posts`
  // - FeedClient historically used `items`
  return res.json({
    posts: sortedPayload,
    items: sortedPayload,
    nextPage: sortedPayload.length === limit ? page + 1 : null,
  });
}

feedRouter.get("/explore", asyncHandler((req, res) => handleFeed(req, res)));
// New canonical feed endpoint (used by /inicio and /reels)
feedRouter.get("/posts", asyncHandler((req, res) => {
  const type = typeof req.query.type === "string" ? req.query.type : undefined;
  if (type === "VIDEO") return handleFeed(req, res, "VIDEO");
  if (type === "IMAGE") return handleFeed(req, res, "IMAGE");
  return handleFeed(req, res);
}));

// Backwards compatible aliases
feedRouter.get("/feed", asyncHandler((req, res) => handleFeed(req, res, "IMAGE")));
feedRouter.get("/videos", asyncHandler((req, res) => handleFeed(req, res, "VIDEO")));

feedRouter.get("/dashboard", requireAuth, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.session.userId! },
    select: {
      membershipExpiresAt: true,
      shopTrialEndsAt: true,
      profileType: true,
      avatarUrl: true,
      coverUrl: true,
      address: true,
      phone: true,
      displayName: true,
      username: true,
      bio: true,
      subscriptionPrice: true
    }
  });
  const expiresAt = user?.membershipExpiresAt?.toISOString() || null;
  const active = !!(user?.membershipExpiresAt && user.membershipExpiresAt.getTime() > Date.now());
  const shopTrialEndsAt = user?.shopTrialEndsAt?.toISOString() || null;
  return res.json({
    active,
    membershipExpiresAt: expiresAt,
    shopTrialEndsAt,
    profileType: user?.profileType,
    avatarUrl: user?.avatarUrl,
    coverUrl: user?.coverUrl,
    address: user?.address,
    phone: user?.phone,
    displayName: user?.displayName,
    username: user?.username,
    bio: user?.bio,
    subscriptionPrice: user?.subscriptionPrice
  });
}));

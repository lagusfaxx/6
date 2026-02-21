import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";

export const reviewRouter = Router();

/* ── GET /reviews/:professionalId — Public reviews for a professional ── */

reviewRouter.get(
  "/reviews/:professionalId",
  asyncHandler(async (req, res) => {
    const { professionalId } = req.params;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 10), 50);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: {
          professionalId,
          isApproved: true,
          isReported: false,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.review.count({
        where: {
          professionalId,
          isApproved: true,
          isReported: false,
        },
      }),
    ]);

    // Compute average
    const agg = await prisma.review.aggregate({
      where: {
        professionalId,
        isApproved: true,
        isReported: false,
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    return res.json({
      reviews,
      total,
      page,
      limit,
      averageRating: agg._avg.rating ?? 0,
      totalReviews: agg._count.rating,
    });
  }),
);

/* ── POST /reviews — Create a review (auth required) ── */

reviewRouter.post(
  "/reviews",
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "UNAUTHENTICATED" });
    }

    const { professionalId, rating, comment } = req.body;

    if (!professionalId || typeof professionalId !== "string") {
      return res.status(400).json({ error: "professionalId is required" });
    }
    if (typeof rating !== "number" || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return res.status(400).json({ error: "rating must be an integer 1-5" });
    }
    if (comment !== undefined && comment !== null && typeof comment !== "string") {
      return res.status(400).json({ error: "comment must be a string" });
    }
    if (typeof comment === "string" && comment.length > 500) {
      return res.status(400).json({ error: "comment must be 500 characters or less" });
    }

    // Prevent reviewing yourself
    if (userId === professionalId) {
      return res.status(400).json({ error: "Cannot review yourself" });
    }

    // Check professional exists
    const professional = await prisma.user.findUnique({
      where: { id: professionalId },
      select: { id: true, profileType: true },
    });
    if (!professional) {
      return res.status(404).json({ error: "Professional not found" });
    }

    const review = await prisma.review.create({
      data: {
        userId,
        professionalId,
        rating,
        comment: comment ? comment.trim() : null,
      },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
      },
    });

    return res.status(201).json(review);
  }),
);

/* ── POST /reviews/:id/report — Report a review (auth required) ── */

reviewRouter.post(
  "/reviews/:id/report",
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "UNAUTHENTICATED" });
    }

    const { id } = req.params;
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      return res.status(404).json({ error: "Review not found" });
    }

    await prisma.review.update({
      where: { id },
      data: { isReported: true },
    });

    return res.json({ ok: true });
  }),
);

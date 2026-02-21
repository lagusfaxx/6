import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";

export const adsRouter = Router();

/* ── GET /ads — Active ads by position (public) ── */

adsRouter.get(
  "/ads",
  asyncHandler(async (req, res) => {
    const position = typeof req.query.position === "string" ? req.query.position.trim().toUpperCase() : "";
    const now = new Date();

    const where: Record<string, unknown> = {
      isActive: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };
    if (position) {
      (where as any).position = position;
    }

    const ads = await prisma.adSlot.findMany({
      where: where as any,
      orderBy: { priority: "desc" },
      take: 10,
      select: {
        id: true,
        position: true,
        imageUrl: true,
        linkUrl: true,
        tierTarget: true,
      },
    });

    res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=60");
    return res.json({ ads });
  }),
);

/* ── POST /ads/:id/event — Track impression or click (public, fire-and-forget) ── */

adsRouter.post(
  "/ads/:id/event",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { eventType } = req.body;

    if (eventType !== "impression" && eventType !== "click") {
      return res.status(400).json({ error: "eventType must be 'impression' or 'click'" });
    }

    // Fire-and-forget — don't block the response on DB write
    prisma.adSlotEvent.create({
      data: { adSlotId: id, eventType },
    }).catch(() => { /* silent — ad tracking is non-critical */ });

    return res.json({ ok: true });
  }),
);

import { prisma } from "../db";

/**
 * One-shot migration: when the story TTL was bumped from 7 to 20 days, previously
 * expired rows (still in the DB because we never physically delete stories)
 * were hidden from the feed. This extends their expiresAt to 20 days from
 * creation so recently-expired stories come back.
 *
 * Guarded by a PlatformConfig marker so it runs exactly once across deploys.
 */
const MARKER_KEY = "stories_ttl_20_recovery_v1";
const NEW_TTL_DAYS = 20;

export async function runStoriesTtlExtensionOnce(): Promise<void> {
  const existing = await prisma.platformConfig.findUnique({ where: { key: MARKER_KEY } });
  if (existing) return;

  const now = new Date();
  const cutoff = new Date(now.getTime() - NEW_TTL_DAYS * 24 * 60 * 60 * 1000);

  const candidates = await prisma.story.findMany({
    where: {
      expiresAt: { lte: now },
      createdAt: { gte: cutoff },
    },
    select: { id: true, createdAt: true },
  });

  let extended = 0;
  for (const s of candidates) {
    const newExpiresAt = new Date(s.createdAt.getTime() + NEW_TTL_DAYS * 24 * 60 * 60 * 1000);
    if (newExpiresAt.getTime() <= now.getTime()) continue;
    await prisma.story.update({
      where: { id: s.id },
      data: { expiresAt: newExpiresAt },
    });
    extended++;
  }

  await prisma.platformConfig.upsert({
    where: { key: MARKER_KEY },
    create: { key: MARKER_KEY, value: `${new Date().toISOString()}:${extended}` },
    update: { value: `${new Date().toISOString()}:${extended}` },
  });

  console.log(`[stories] TTL recovery: extended ${extended} expired stories (one-shot)`);
}

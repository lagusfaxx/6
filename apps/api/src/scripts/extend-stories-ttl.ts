/**
 * Recover recently-expired stories by extending expiresAt to 20 days from creation.
 *
 * Stories are never physically deleted — they're only filtered out at query time
 * via `expiresAt > now`. Bumping expiresAt restores visibility.
 *
 * By default we only recover stories whose createdAt falls within the new
 * 20-day window (so we don't resurrect ancient content). Pass --all to
 * extend every expired story regardless of age.
 *
 * Usage:
 *   npx tsx src/scripts/extend-stories-ttl.ts [--dry-run] [--all] [--days=20]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function argFlag(name: string): boolean {
  return process.argv.some((a) => a === `--${name}`);
}

function argValue(name: string, fallback: number): number {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!raw) return fallback;
  const n = Number(raw.split("=")[1]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function main() {
  const DRY_RUN = argFlag("dry-run");
  const ALL = argFlag("all");
  const DAYS = argValue("days", 20);
  const now = new Date();
  const cutoff = new Date(now.getTime() - DAYS * 24 * 60 * 60 * 1000);

  console.log(`[stories] Extending TTL to ${DAYS} days${DRY_RUN ? " (dry run)" : ""}`);
  console.log(`[stories] Scope: ${ALL ? "ALL expired stories" : `createdAt >= ${cutoff.toISOString()}`}`);

  const where: any = { expiresAt: { lte: now } };
  if (!ALL) where.createdAt = { gte: cutoff };

  const candidates = await prisma.story.findMany({
    where,
    select: { id: true, createdAt: true, expiresAt: true },
  });

  console.log(`[stories] ${candidates.length} expired stories match criteria`);
  if (candidates.length === 0) return;

  let updated = 0;
  for (const s of candidates) {
    const newExpiresAt = new Date(s.createdAt.getTime() + DAYS * 24 * 60 * 60 * 1000);
    if (newExpiresAt.getTime() <= now.getTime()) continue; // still expired under new TTL
    if (DRY_RUN) {
      updated++;
      continue;
    }
    await prisma.story.update({
      where: { id: s.id },
      data: { expiresAt: newExpiresAt },
    });
    updated++;
  }

  console.log(`[stories] ${DRY_RUN ? "Would extend" : "Extended"} ${updated} stories`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

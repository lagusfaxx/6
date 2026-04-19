/**
 * Backfill: for every UmateCreator that currently has zero UmatePost rows,
 * build ONE carousel post (visibility FREE) from the owner's ProfileMedia
 * (Uzeed professional gallery). Runs on each deploy via docker-entrypoint.sh
 * after Prisma migrations.
 *
 *  - Idempotent: creators with any existing post are skipped.
 *  - Non-destructive: never modifies or deletes the original ProfileMedia rows;
 *    UmatePostMedia.url just re-uses the same /uploads/... URL.
 *  - Non-fatal: per-creator errors are logged and skipped; the API still
 *    starts even if the whole script fails.
 *
 * Env:
 *   IMPORT_GALLERY_TO_UMATE=skip  — disable this job on a given deploy
 */
const { PrismaClient } = require("@prisma/client");

async function main() {
  if (process.env.IMPORT_GALLERY_TO_UMATE === "skip") {
    console.log("[import-gallery] skipped via env");
    return;
  }
  const prisma = new PrismaClient();
  try {
    const creators = await prisma.umateCreator.findMany({
      select: { id: true, userId: true, displayName: true },
    });
    let seeded = 0;
    let skipped = 0;
    let failed = 0;
    for (const c of creators) {
      try {
        const existing = await prisma.umatePost.count({ where: { creatorId: c.id } });
        if (existing > 0) {
          skipped++;
          continue;
        }
        const gallery = await prisma.profileMedia.findMany({
          where: { ownerId: c.userId },
          orderBy: { createdAt: "asc" },
        });
        if (gallery.length === 0) {
          skipped++;
          continue;
        }
        await prisma.umatePost.create({
          data: {
            creatorId: c.id,
            caption: null,
            visibility: "FREE",
            media: {
              create: gallery.map((m, pos) => ({
                type: m.type,
                url: m.url,
                pos,
                visibility: "FREE",
              })),
            },
          },
        });
        await prisma.umateCreator.update({
          where: { id: c.id },
          data: { totalPosts: { increment: 1 } },
        });
        seeded++;
        console.log(`[import-gallery] seeded ${gallery.length} media for creator ${c.displayName} (${c.id})`);
      } catch (err) {
        failed++;
        console.error(`[import-gallery] creator ${c.id} failed:`, err.message || err);
      }
    }
    console.log(`[import-gallery] done — seeded=${seeded} skipped=${skipped} failed=${failed} total=${creators.length}`);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error("[import-gallery] fatal:", err);
  process.exit(0);
});

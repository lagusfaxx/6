/**
 * hide-photoless-professionals.js
 *
 * Deactivates (isActive=false) every PROFESSIONAL that is currently public but
 * has fewer than the required gallery photos. The profiles are only hidden,
 * never deleted — adding photos and re-approving them restores visibility.
 *
 * This clears the backlog left by the old /register behaviour, which published
 * professionals before (or without) their separate photo-upload step.
 *
 * Usage:
 *   node prisma/scripts/hide-photoless-professionals.js            # dry run
 *   node prisma/scripts/hide-photoless-professionals.js --apply    # apply
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const MIN_PHOTOS = 3;
const APPLY = process.argv.includes("--apply");

async function main() {
  // All currently-public professionals.
  const pros = await prisma.user.findMany({
    where: { profileType: "PROFESSIONAL", isActive: true },
    select: { id: true, username: true, email: true },
  });

  // Image counts grouped by owner (professionals with zero photos simply do
  // not appear here, so they default to 0 below).
  const counts = await prisma.profileMedia.groupBy({
    by: ["ownerId"],
    where: { type: "IMAGE", ownerId: { in: pros.map((p) => p.id) } },
    _count: true,
  });
  const countByOwner = new Map(counts.map((c) => [c.ownerId, c._count]));

  const photoless = pros
    .map((p) => ({ ...p, photos: countByOwner.get(p.id) || 0 }))
    .filter((p) => p.photos < MIN_PHOTOS)
    .sort((a, b) => a.photos - b.photos);

  console.log(
    `Scanned ${pros.length} active professionals — ${photoless.length} have fewer than ${MIN_PHOTOS} photos.`,
  );
  for (const p of photoless) {
    console.log(`  ${p.photos} photo(s)  ${p.username} <${p.email}>`);
  }

  if (photoless.length === 0) {
    console.log("Nothing to hide.");
    return;
  }
  if (!APPLY) {
    console.log("\nDry run. Re-run with --apply to deactivate these profiles.");
    return;
  }

  const result = await prisma.user.updateMany({
    where: { id: { in: photoless.map((p) => p.id) } },
    data: { isActive: false },
  });
  console.log(`\nDeactivated ${result.count} photoless professional(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

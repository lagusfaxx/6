/**
 * Backfill avatarUrl for professionals who have gallery photos but no avatar.
 * This fixes profiles registered via /publicate that didn't set avatarUrl.
 *
 * Usage:
 *   node prisma/scripts/backfill-avatar-from-gallery.js
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // Find all professionals with no avatarUrl
  const professionals = await prisma.user.findMany({
    where: {
      profileType: "PROFESSIONAL",
      avatarUrl: null,
    },
    select: { id: true, displayName: true, email: true },
  });

  console.log(`Found ${professionals.length} professionals without avatarUrl`);

  let updated = 0;
  let skipped = 0;

  for (const prof of professionals) {
    // Get first gallery image
    const firstMedia = await prisma.profileMedia.findFirst({
      where: { ownerId: prof.id, type: "IMAGE" },
      orderBy: { createdAt: "asc" },
      select: { url: true },
    });

    if (!firstMedia) {
      skipped++;
      continue;
    }

    await prisma.user.update({
      where: { id: prof.id },
      data: { avatarUrl: firstMedia.url },
    });

    updated++;
    console.log(`  ✓ ${prof.displayName || prof.email} → ${firstMedia.url}`);
  }

  console.log(`\nDone: ${updated} updated, ${skipped} skipped (no gallery photos)`);
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

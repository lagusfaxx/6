/**
 * deactivate-incomplete-professionals.js
 *
 * Finds PROFESSIONAL profiles that have fewer than the required number of
 * gallery photos (IMAGE media) and deactivates them (isActive = false) so they
 * stop showing up in discovery until they complete their gallery.
 *
 * This cleans up profiles created before the Google-signup flow enforced the
 * 3-photo minimum (those landed with 0–2 photos and only the Google
 * letter-avatar).
 *
 * Usage:
 *   node prisma/scripts/deactivate-incomplete-professionals.js            # dry run (no writes)
 *   node prisma/scripts/deactivate-incomplete-professionals.js --apply    # actually deactivate
 *
 *   or via pnpm:
 *   pnpm --filter @uzeed/prisma professionals:deactivate-incomplete -- --apply
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const MIN_PROFESSIONAL_GALLERY_PHOTOS = 3;
const APPLY = process.argv.includes("--apply");

async function main() {
  const professionals = await prisma.user.findMany({
    where: { profileType: "PROFESSIONAL" },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      isActive: true,
      _count: {
        select: { profileMedia: { where: { type: "IMAGE" } } },
      },
    },
  });

  const incomplete = professionals.filter(
    (p) => p._count.profileMedia < MIN_PROFESSIONAL_GALLERY_PHOTOS,
  );

  console.log(
    `Scanned ${professionals.length} professional profiles. ` +
      `${incomplete.length} have fewer than ${MIN_PROFESSIONAL_GALLERY_PHOTOS} photos.`,
  );

  if (incomplete.length === 0) {
    console.log("Nothing to deactivate. ✅");
    return;
  }

  // Only those currently active actually need a write.
  const toDeactivate = incomplete.filter((p) => p.isActive);

  for (const p of incomplete) {
    console.log(
      `  - ${p.displayName || p.username} (${p.email}) — ` +
        `${p._count.profileMedia} photo(s)` +
        (p.isActive ? "" : " [already inactive]"),
    );
  }

  if (!APPLY) {
    console.log(
      `\nDRY RUN: would deactivate ${toDeactivate.length} active profile(s). ` +
        `Re-run with --apply to perform the changes.`,
    );
    return;
  }

  if (toDeactivate.length === 0) {
    console.log("\nAll incomplete profiles are already inactive. ✅");
    return;
  }

  const result = await prisma.user.updateMany({
    where: { id: { in: toDeactivate.map((p) => p.id) } },
    data: { isActive: false },
  });

  console.log(
    `\n✅ Deactivated ${result.count} professional profile(s) with an incomplete gallery.`,
  );
}

main()
  .catch((err) => {
    console.error("❌ Error deactivating incomplete professionals:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

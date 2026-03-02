/**
 * clean-test-profiles.js
 *
 * Removes every user whose email ends with @testseed.uzeed.cl
 * and all related data (cascade via Prisma relations + manual cleanup
 * for relations that use SetNull instead of Cascade).
 *
 * Usage:  node prisma/scripts/clean-test-profiles.js
 *   or:   pnpm --filter @uzeed/prisma clean:test
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const TEST_EMAIL_DOMAIN = "@testseed.uzeed.cl";

async function main() {
  // Collect all test-seed user IDs
  const users = await prisma.user.findMany({
    where: { email: { endsWith: TEST_EMAIL_DOMAIN } },
    select: { id: true, email: true },
  });

  const ids = users.map((u) => u.id);
  console.log(`Found ${ids.length} test-seed profiles to remove.`);

  if (ids.length === 0) {
    console.log("Nothing to clean.");
    return;
  }

  // Delete related records that might not cascade automatically
  // (relations using onDelete: SetNull or no cascade)
  await prisma.favorite.deleteMany({
    where: { OR: [{ userId: { in: ids } }, { professionalId: { in: ids } }] },
  });
  await prisma.serviceRequest.deleteMany({
    where: { OR: [{ clientId: { in: ids } }, { professionalId: { in: ids } }] },
  });
  await prisma.profileSubscription.deleteMany({
    where: { OR: [{ subscriberId: { in: ids } }, { profileId: { in: ids } }] },
  });
  await prisma.paymentIntent.deleteMany({
    where: { OR: [{ subscriberId: { in: ids } }, { profileId: { in: ids } }] },
  });
  await prisma.message.deleteMany({
    where: { OR: [{ fromId: { in: ids } }, { toId: { in: ids } }] },
  });

  // The remaining relations use onDelete: Cascade so deleting users
  // will automatically remove: profileMedia, serviceItem (+ serviceMedia),
  // posts (+ media), payments, khipuSubscription, notification,
  // serviceRating, profileReviewSurvey, product (+ productMedia),
  // shopCategory, motelRoom, motelPack, motelPromotion, story, pushSubscription.

  const result = await prisma.user.deleteMany({
    where: { id: { in: ids } },
  });

  console.log(`✅ Removed ${result.count} test-seed profiles and all related data.`);
}

main()
  .catch((err) => {
    console.error("❌ Error cleaning test profiles:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

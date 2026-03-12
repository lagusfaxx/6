/**
 * Backfill forum threads for already-created professional profiles.
 *
 * Usage:
 *   node prisma/scripts/backfill-professional-forum-threads.js
 *   pnpm --filter @uzeed/prisma forum:backfill:professionals
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function normalizeForumCategoryInput(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function resolveForumCategoryId(primaryCategory) {
  const normalized = normalizeForumCategoryInput(primaryCategory);

  const targetGroup =
    normalized.includes("masaj") &&
    !normalized.includes("videollam") &&
    !normalized.includes("despedida")
      ? "MASAJES"
      : "ESCORTS";

  const slugs =
    targetGroup === "MASAJES"
      ? ["masajistas", "masajes"]
      : ["escorts", "escorts-santiago", "escort"];

  const category = await prisma.forumCategory.findFirst({
    where: {
      OR: [
        { slug: { in: slugs } },
        {
          name: {
            in:
              targetGroup === "MASAJES"
                ? ["masajistas", "masajes"]
                : ["escorts", "escorts santiago", "escort"],
            mode: "insensitive",
          },
        },
      ],
    },
    select: { id: true },
  });

  return category?.id || null;
}

async function createThreadForProfessional(user) {
  const existingThread = await prisma.forumThread.findFirst({
    where: { authorId: user.id },
    select: { id: true },
  });
  if (existingThread) return { skipped: true, reason: "already_has_thread" };

  const categoryId = await resolveForumCategoryId(user.primaryCategory);
  if (!categoryId) return { skipped: true, reason: "category_not_found" };

  const safeName = user.displayName || user.username;
  const profileUrl = `/profesional/${encodeURIComponent(user.username)}`;
  const contentLines = [
    `Hilo oficial de ${safeName}.`,
    `Nickname: @${user.username}`,
    user.avatarUrl ? `Foto: ${user.avatarUrl}` : null,
    `Ver perfil: ${profileUrl}`,
  ].filter(Boolean);

  await prisma.forumThread.create({
    data: {
      categoryId,
      authorId: user.id,
      title: `${safeName} (@${user.username})`,
      posts: {
        create: {
          authorId: user.id,
          content: contentLines.join("\n"),
        },
      },
    },
  });

  return { skipped: false };
}

async function main() {
  const professionals = await prisma.user.findMany({
    where: { profileType: "PROFESSIONAL" },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
      primaryCategory: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let created = 0;
  let skipped = 0;
  const skippedByReason = {};

  for (const professional of professionals) {
    const result = await createThreadForProfessional(professional);
    if (result.skipped) {
      skipped += 1;
      skippedByReason[result.reason] = (skippedByReason[result.reason] || 0) + 1;
    } else {
      created += 1;
    }
  }

  console.log("Backfill finalizado");
  console.log(`- Profesionales evaluadas: ${professionals.length}`);
  console.log(`- Hilos creados: ${created}`);
  console.log(`- Saltados: ${skipped}`);
  if (Object.keys(skippedByReason).length > 0) {
    console.log("- Detalle saltados:", skippedByReason);
  }
}

main()
  .catch((error) => {
    console.error("Error en backfill de hilos de foro:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

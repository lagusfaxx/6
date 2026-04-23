import { prisma } from "../db";

function normalizeForumCategoryInput(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export async function resolveForumCategoryId(
  primaryCategory: string | null | undefined,
) {
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

export async function createProfessionalForumThread(params: {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl?: string | null;
  primaryCategory: string | null | undefined;
}) {
  const existingThread = await prisma.forumThread.findFirst({
    where: { authorId: params.userId },
    select: { id: true },
  });
  if (existingThread) return;

  const categoryId = await resolveForumCategoryId(params.primaryCategory);
  if (!categoryId) return;

  const profileUrl = `/profesional/${encodeURIComponent(params.username)}`;
  const safeName = params.displayName || params.username;
  const contentLines = [
    `Hilo oficial de ${safeName}.`,
    `Nickname: @${params.username}`,
    params.avatarUrl ? `Foto: ${params.avatarUrl}` : null,
    `Ver perfil: ${profileUrl}`,
  ].filter(Boolean);

  await prisma.forumThread.create({
    data: {
      categoryId,
      authorId: params.userId,
      title: `${safeName} (@${params.username})`,
      posts: {
        create: {
          authorId: params.userId,
          content: contentLines.join("\n"),
        },
      },
    },
  });
}

export async function geocodeAddress(address: string) {
  const token =
    process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token || !address.trim()) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=1&language=es`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const payload = await response.json();
    const first = payload?.features?.[0];
    if (!first?.center || first.center.length < 2) return null;
    const city = Array.isArray(first.context)
      ? String(
          first.context.find((c: any) =>
            String(c.id || "").startsWith("place."),
          )?.text || "",
        ).trim() || null
      : null;
    return {
      longitude: Number(first.center[0]),
      latitude: Number(first.center[1]),
      city,
    };
  } catch {
    return null;
  }
}

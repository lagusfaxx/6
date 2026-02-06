import { PrismaClient, CategoryKind } from "@prisma/client";

const legacySlugMap: Record<string, string> = {
  acompanamiento: "acompanantes",
  acompananamiento: "acompanantes",
  acompanantes: "acompanantes",
  acompanante: "acompanantes",
  "acompañamiento": "acompanantes",
  "acompañantes": "acompanantes",
  masajes: "masajes-sensuales",
  masaje: "masajes-sensuales",
  bienestar: "masajes-sensuales",
  "experienciasintimas": "experiencias-intimas",
  "experiencias-intimas": "experiencias-intimas",
  "experiencias íntimas": "experiencias-intimas",
  "serviciosvip": "servicios-vip",
  vip: "servicios-vip",
  motel: "moteles",
  moteles: "moteles",
  hotel: "hoteles-por-hora",
  hoteles: "hoteles-por-hora",
  "hotelesporhora": "hoteles-por-hora",
  "centrosprivados": "centros-privados",
  "centros privados": "centros-privados",
  "espaciosexclusivos": "espacios-exclusivos",
  "espacios exclusivos": "espacios-exclusivos",
  "nightclub": "espacios-exclusivos",
  club: "espacios-exclusivos",
  saunas: "espacios-exclusivos",
  sexshop: "sex-shop",
  "sex shop": "sex-shop",
  tienda: "sex-shop",
  lenceria: "lenceria",
  "lencería": "lenceria",
  juguetes: "juguetes-intimos",
  "juguetesintimos": "juguetes-intimos",
  "juguetes íntimos": "juguetes-intimos",
  lubricantes: "productos-premium",
  promociones: "productos-premium",
  accesorios: "productos-premium",
  modelos: "experiencias-intimas",
  bailarinas: "experiencias-intimas"
};

export function normalizeCategoryText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_\s]+/g, " ")
    .trim()
    .toLowerCase();
}

export function slugifyCategory(value: string) {
  return normalizeCategoryText(value)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function resolveCategorySlug(value?: string | null) {
  if (!value) return null;
  const normalized = normalizeCategoryText(value);
  if (!normalized) return null;
  const key = normalized.replace(/\s+/g, "");
  return legacySlugMap[key] || legacySlugMap[normalized] || slugifyCategory(value);
}

export async function findCategoryByRef(
  prisma: PrismaClient,
  {
    categoryId,
    categorySlug,
    categoryName,
    kind
  }: {
    categoryId?: string | null;
    categorySlug?: string | null;
    categoryName?: string | null;
    kind?: CategoryKind;
  }
) {
  if (categoryId) {
    return prisma.category.findUnique({ where: { id: categoryId } });
  }

  const slug = resolveCategorySlug(categorySlug || categoryName || undefined);
  if (slug) {
    const found = await prisma.category.findFirst({
      where: {
        slug: { equals: slug, mode: "insensitive" },
        ...(kind ? { kind } : {})
      }
    });
    if (found) return found;
  }

  if (categoryName) {
    return prisma.category.findFirst({
      where: {
        ...(kind ? { kind } : {}),
        OR: [
          { displayName: { equals: categoryName, mode: "insensitive" } },
          { name: { equals: categoryName, mode: "insensitive" } }
        ]
      }
    });
  }

  return null;
}

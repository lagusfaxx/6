import { prisma } from "../db";
import { CategoryKind, ProfileAttributeType } from "@prisma/client";

/**
 * Crea categorías por defecto (si aún no existen).
 * Esto evita que el Home muestre "No hay categorías disponibles" en un DB nueva.
 */
export async function seedCategories(): Promise<void> {
  const count = await prisma.category.count();
  if (count > 0) return;

  await prisma.category.createMany({
    data: [
      // Experiencias
      {
        name: "Escort",
        slug: "escort",
        displayName: "Escort",
        kind: CategoryKind.PROFESSIONAL,
        order: 1,
        isActive: true,
      },
      {
        name: "Masajes",
        slug: "masajes",
        displayName: "Masajes",
        kind: CategoryKind.PROFESSIONAL,
        order: 2,
        isActive: true,
      },
      {
        name: "Maduras",
        slug: "maduras",
        displayName: "Maduras",
        kind: CategoryKind.PROFESSIONAL,
        order: 3,
        isActive: true,
      },
      {
        name: "Trans",
        slug: "trans",
        displayName: "Trans",
        kind: CategoryKind.PROFESSIONAL,
        order: 4,
        isActive: true,
      },

      // Lugares
      {
        name: "Moteles",
        slug: "moteles",
        displayName: "Moteles",
        kind: CategoryKind.ESTABLISHMENT,
        order: 5,
        isActive: true,
      },
      {
        name: "Hoteles por hora",
        slug: "hoteles-por-hora",
        displayName: "Hoteles por hora",
        kind: CategoryKind.ESTABLISHMENT,
        order: 6,
        isActive: true,
      },
      {
        name: "Despedidas de soltero",
        slug: "despedidas-soltero",
        displayName: "Despedidas de soltero",
        kind: CategoryKind.ESTABLISHMENT,
        order: 7,
        isActive: true,
      },

      // Tiendas
      {
        name: "Sex shop",
        slug: "sexshop",
        displayName: "Sex Shop",
        kind: CategoryKind.SHOP,
        order: 8,
        isActive: true,
      },
      {
        name: "Packs",
        slug: "packs",
        displayName: "Packs",
        kind: CategoryKind.SHOP,
        order: 9,
        isActive: true,
      },
      {
        name: "Video llamadas",
        slug: "video-llamadas",
        displayName: "Video llamadas",
        kind: CategoryKind.SHOP,
        order: 10,
        isActive: true,
      },
      {
        name: "Productos premium",
        slug: "productos-premium",
        displayName: "Productos premium",
        kind: CategoryKind.SHOP,
        order: 11,
        isActive: true,
      },
    ],
    skipDuplicates: true,
  });

  await prisma.profileAttribute.createMany({
    data: [
      {
        slug: "hombres",
        label: "Hombres",
        type: ProfileAttributeType.GENDER_GROUP,
      },
      {
        slug: "mujeres",
        label: "Mujeres",
        type: ProfileAttributeType.GENDER_GROUP,
      },
      {
        slug: "trans",
        label: "Trans",
        type: ProfileAttributeType.GENDER_GROUP,
      },
      {
        slug: "maduras",
        label: "Maduras",
        type: ProfileAttributeType.GENDER_GROUP,
      },
      {
        slug: "masajes",
        label: "Masajes",
        type: ProfileAttributeType.SERVICE_TAG,
      },
      {
        slug: "despedidas-soltero",
        label: "Despedidas de soltero",
        type: ProfileAttributeType.SERVICE_TAG,
      },
      { slug: "packs", label: "Packs", type: ProfileAttributeType.SERVICE_TAG },
      {
        slug: "video-llamadas",
        label: "Video llamadas",
        type: ProfileAttributeType.SERVICE_TAG,
      },
      {
        slug: "destacada",
        label: "Destacada",
        type: ProfileAttributeType.FEATURE,
      },
    ],
    skipDuplicates: true,
  });

  const activeTerms = await prisma.termsVersion.findFirst({
    where: { isActive: true },
  });
  if (!activeTerms) {
    await prisma.termsVersion.create({
      data: {
        version: "v1.0.0",
        pdfUrl: "/terms/cliente-terminos.pdf",
        contentUrl: "/terminos",
        isActive: true,
      },
    });
  }
}

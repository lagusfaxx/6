import { prisma } from "../db";
import { CategoryKind } from "@prisma/client";

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
      { name: "Acompañantes", slug: "acompanantes", displayName: "Acompañantes", kind: CategoryKind.PROFESSIONAL },
      { name: "Masajes sensuales", slug: "masajes-sensuales", displayName: "Masajes sensuales", kind: CategoryKind.PROFESSIONAL },
      { name: "Experiencias íntimas", slug: "experiencias-intimas", displayName: "Experiencias íntimas", kind: CategoryKind.PROFESSIONAL },
      { name: "Servicios VIP", slug: "servicios-vip", displayName: "Servicios VIP", kind: CategoryKind.PROFESSIONAL },

      // Lugares
      { name: "Moteles", slug: "moteles", displayName: "Moteles", kind: CategoryKind.ESTABLISHMENT },
      { name: "Hoteles por hora", slug: "hoteles-por-hora", displayName: "Hoteles por hora", kind: CategoryKind.ESTABLISHMENT },
      { name: "Espacios exclusivos", slug: "espacios-exclusivos", displayName: "Espacios exclusivos", kind: CategoryKind.ESTABLISHMENT },

      // Tiendas
      { name: "Sex shop", slug: "sex-shop", displayName: "Sex shop", kind: CategoryKind.SHOP },
      { name: "Lencería", slug: "lenceria", displayName: "Lencería", kind: CategoryKind.SHOP },
      { name: "Juguetes íntimos", slug: "juguetes-intimos", displayName: "Juguetes íntimos", kind: CategoryKind.SHOP },
      { name: "Productos premium", slug: "productos-premium", displayName: "Productos premium", kind: CategoryKind.SHOP }
    ],
    skipDuplicates: true
  });
}

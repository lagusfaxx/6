/**
 * seed-umate-creators.js
 *
 * Crea 10 perfiles de creadoras U-Mate reutilizando usuarios existentes de
 * Uzeed. NO crea usuarios nuevos — solo promueve perfiles que ya existen en
 * la DB al vertical U-Mate, para poder visualizar cómo queda el home
 * (sección "Creadoras U-Mate") y otras páginas del vertical.
 *
 * Cómo funciona:
 *   1. Busca 10 usuarios activos (con avatar) que NO tengan todavía un
 *      UmateCreator asociado. Prioriza profesionales con bio + cover para
 *      que las cards se vean bien.
 *   2. Para cada uno crea un UmateCreator en estado ACTIVE copiando su
 *      displayName / bio / avatar / cover y asignándole una tarifa mensual
 *      random entre $2.990 y $19.990.
 *   3. Guarda los IDs creados en `.umate-seed-manifest.json` para que el
 *      script de limpieza pueda revertir exactamente esta corrida.
 *
 * Reversible:
 *   node prisma/scripts/clean-umate-creators.js
 *     → Lee el manifest y borra SOLO los creators creados por este seed.
 *     Los usuarios originales quedan intactos.
 *
 * Uso:
 *   node prisma/scripts/seed-umate-creators.js
 *   pnpm --filter @uzeed/prisma seed:umate
 */

const { PrismaClient } = require("@prisma/client");
const fs = require("node:fs");
const path = require("node:path");

const prisma = new PrismaClient();

const MANIFEST_PATH = path.join(__dirname, ".umate-seed-manifest.json");
const TARGET_COUNT = 10;

// Tarifas sugeridas (en CLP, rango razonable para cards del home)
const PRICE_OPTIONS = [2990, 3990, 4990, 5990, 6990, 7990, 9990, 12990, 14990, 19990];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  // 1) Bail out si ya hay manifest (evita seedear dos veces por error)
  if (fs.existsSync(MANIFEST_PATH)) {
    console.error(
      "❌ Ya existe un manifest de seed en",
      MANIFEST_PATH,
      "\n   Ejecuta primero `node prisma/scripts/clean-umate-creators.js` para revertir la corrida anterior.",
    );
    process.exit(1);
  }

  console.log(`🌱 Buscando hasta ${TARGET_COUNT} usuarios elegibles para seedear como creadoras U-Mate...`);

  // 2) Busca candidatos — activos, con avatar, sin UmateCreator asociado.
  //    Orden de preferencia:
  //      1º: PROFESSIONAL con bio + cover
  //      2º: PROFESSIONAL con avatar + bio
  //      3º: cualquier usuario activo con avatar
  const baseWhere = {
    isActive: true,
    avatarUrl: { not: null },
    umateCreator: null, // no tiene creator todavía
  };

  const candidates = [];

  // Nivel 1: profesionales completos
  const lvl1 = await prisma.user.findMany({
    where: {
      ...baseWhere,
      profileType: "PROFESSIONAL",
      bio: { not: null },
      coverUrl: { not: null },
    },
    select: { id: true, username: true, displayName: true, bio: true, avatarUrl: true, coverUrl: true },
    take: TARGET_COUNT,
    orderBy: { createdAt: "desc" },
  });
  candidates.push(...lvl1);

  // Nivel 2: profesionales con avatar + bio (sin cover)
  if (candidates.length < TARGET_COUNT) {
    const existingIds = new Set(candidates.map((c) => c.id));
    const lvl2 = await prisma.user.findMany({
      where: {
        ...baseWhere,
        profileType: "PROFESSIONAL",
        bio: { not: null },
        id: { notIn: [...existingIds] },
      },
      select: { id: true, username: true, displayName: true, bio: true, avatarUrl: true, coverUrl: true },
      take: TARGET_COUNT - candidates.length,
      orderBy: { createdAt: "desc" },
    });
    candidates.push(...lvl2);
  }

  // Nivel 3: cualquier usuario activo con avatar
  if (candidates.length < TARGET_COUNT) {
    const existingIds = new Set(candidates.map((c) => c.id));
    const lvl3 = await prisma.user.findMany({
      where: {
        ...baseWhere,
        id: { notIn: [...existingIds] },
      },
      select: { id: true, username: true, displayName: true, bio: true, avatarUrl: true, coverUrl: true },
      take: TARGET_COUNT - candidates.length,
      orderBy: { createdAt: "desc" },
    });
    candidates.push(...lvl3);
  }

  if (candidates.length === 0) {
    console.error("❌ No se encontraron usuarios elegibles (activos, con avatar, sin UmateCreator previo).");
    process.exit(1);
  }

  console.log(`✅ ${candidates.length} usuario(s) seleccionado(s). Creando creators...\n`);

  // 3) Crear los UmateCreator y recolectar los IDs en el manifest
  const now = new Date();
  const createdCreators = [];

  for (const user of candidates) {
    const monthlyPriceCLP = pick(PRICE_OPTIONS);
    const fakeSubscriberCount = randInt(0, 250);

    try {
      const creator = await prisma.umateCreator.create({
        data: {
          userId: user.id,
          displayName: user.displayName || user.username || "Creadora",
          bio: user.bio,
          avatarUrl: user.avatarUrl,
          coverUrl: user.coverUrl,
          monthlyPriceCLP,
          // Activa inmediatamente para que aparezca en /umate/creators y en el home
          status: "ACTIVE",
          // Marca los términos como aceptados (de otra forma algunas queries podrían filtrarla)
          termsAcceptedAt: now,
          rulesAcceptedAt: now,
          contractAcceptedAt: now,
          // Stats fake sólo para que las cards tengan un contador de suscriptores
          subscriberCount: fakeSubscriberCount,
          totalPosts: 0,
          totalLikes: 0,
        },
        select: { id: true, displayName: true, monthlyPriceCLP: true },
      });

      createdCreators.push({
        id: creator.id,
        userId: user.id,
        username: user.username,
        displayName: creator.displayName,
        monthlyPriceCLP: creator.monthlyPriceCLP,
      });

      console.log(
        `  ✓ @${user.username}  →  ${creator.displayName}  ($${creator.monthlyPriceCLP.toLocaleString("es-CL")}/mes)`,
      );
    } catch (err) {
      console.warn(`  ✗ @${user.username}  →  error: ${err?.message || err}`);
    }
  }

  if (createdCreators.length === 0) {
    console.error("\n❌ No se creó ningún creator. Revisa los errores arriba.");
    process.exit(1);
  }

  // 4) Guardar manifest para el revert
  const manifest = {
    createdAt: now.toISOString(),
    count: createdCreators.length,
    creators: createdCreators,
  };

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");

  console.log(`\n🎉 Listo. ${createdCreators.length} creadora(s) seedeada(s).`);
  console.log(`   Manifest: ${MANIFEST_PATH}`);
  console.log(`\n   Para revertir:`);
  console.log(`     node prisma/scripts/clean-umate-creators.js`);
  console.log(`     o  pnpm --filter @uzeed/prisma clean:umate\n`);
}

main()
  .catch((err) => {
    console.error("❌ Error seedeando creadoras U-Mate:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

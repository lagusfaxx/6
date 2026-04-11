/**
 * clean-umate-creators.js
 *
 * Revierte la corrida de seed-umate-creators.js. Lee el manifest
 * `.umate-seed-manifest.json` generado por el seed y borra SOLO los
 * UmateCreator listados ahí — los usuarios originales quedan intactos.
 *
 * Prisma tiene onDelete: Cascade en las relaciones hijas de UmateCreator
 * (UmatePost, UmateCreatorSub, UmateDirectSubscription, UmatePostMedia),
 * así que borrar cada creator limpia también posts, medios y suscripciones
 * asociadas en la misma transacción.
 *
 * Uso:
 *   node prisma/scripts/clean-umate-creators.js
 *   pnpm --filter @uzeed/prisma clean:umate
 */

const { PrismaClient } = require("@prisma/client");
const fs = require("node:fs");
const path = require("node:path");

const prisma = new PrismaClient();

const MANIFEST_PATH = path.join(__dirname, ".umate-seed-manifest.json");

async function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.log(`ℹ️  No hay manifest en ${MANIFEST_PATH}.`);
    console.log(`   Nada que revertir (o ya fue limpiado antes).`);
    return;
  }

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  } catch (err) {
    console.error(`❌ Manifest corrupto en ${MANIFEST_PATH}:`, err?.message || err);
    process.exit(1);
  }

  const creators = Array.isArray(manifest.creators) ? manifest.creators : [];
  if (creators.length === 0) {
    console.log("ℹ️  El manifest existe pero no contiene creadoras. Borrando manifest...");
    fs.unlinkSync(MANIFEST_PATH);
    return;
  }

  const ids = creators.map((c) => c.id).filter(Boolean);
  console.log(`🧹 Revirtiendo ${ids.length} creadora(s) seedeada(s)...`);

  // Verificar cuántas existen realmente antes de borrar (por si ya fueron borradas manualmente)
  const existing = await prisma.umateCreator.findMany({
    where: { id: { in: ids } },
    select: { id: true, displayName: true, user: { select: { username: true } } },
  });

  if (existing.length === 0) {
    console.log("   Ninguna de las creators del manifest existe ya en la DB. Borrando manifest...");
    fs.unlinkSync(MANIFEST_PATH);
    return;
  }

  // Borra una por una para poder reportar bien si alguna falla.
  // Prisma cascadea a UmatePost, UmatePostMedia, UmateCreatorSub y
  // UmateDirectSubscription gracias a onDelete: Cascade en el schema.
  let deleted = 0;
  for (const c of existing) {
    try {
      await prisma.umateCreator.delete({ where: { id: c.id } });
      deleted++;
      console.log(`  ✓ @${c.user?.username || "?"} — ${c.displayName}`);
    } catch (err) {
      console.warn(`  ✗ ${c.id} — error: ${err?.message || err}`);
    }
  }

  // Limpia también referencias huérfanas en User.flowCustomerId / flowCardLast4
  // NO se tocan: esos campos pertenecen al usuario, no al creator, y pueden
  // estar siendo usados por otras suscripciones (ej. Uzeed Pro).

  fs.unlinkSync(MANIFEST_PATH);

  console.log(`\n🎉 Listo. ${deleted}/${existing.length} creadora(s) borrada(s). Manifest eliminado.`);
  console.log(`   Los usuarios originales no fueron tocados.`);
}

main()
  .catch((err) => {
    console.error("❌ Error limpiando el seed de U-Mate:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

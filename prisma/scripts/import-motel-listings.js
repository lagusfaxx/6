/**
 * import-motel-listings.js
 *
 * Carga en el directorio de moteles (/moteles y /moteles/{comuna}) los
 * moteles que existen en las regiones de Chile y que todavía no tienen cuenta
 * en UZEED. Quedan como "listing" (Establishment con externalOnly = true): la
 * ficha /motel/{id} muestra nombre, dirección, mapa y el botón a su sitio web.
 *
 * Los datos salen de prisma/scripts/data/moteles-chile.json (OpenStreetMap,
 * © colaboradores de OpenStreetMap, licencia ODbL), sólo moteles con sitio
 * web propio que respondía al momento de armar la lista.
 *
 * Es idempotente: un motel que ya está (mismo sitio web, o mismo nombre en la
 * misma comuna) se actualiza sólo en los campos vacíos; nunca se pisa lo que
 * se editó a mano en /admin. No borra nada.
 *
 * Uso:
 *   node prisma/scripts/import-motel-listings.js --dry-run   (muestra qué haría)
 *   node prisma/scripts/import-motel-listings.js
 *   pnpm --filter @uzeed/prisma import:moteles
 */

const path = require("path");
const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const DATA = path.join(__dirname, "data", "moteles-chile.json");

function norm(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "https://www.Motel.cl/" y "http://motel.cl" son el mismo sitio. */
function siteKey(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "").toLowerCase() + u.pathname.replace(/\/+$/, "").toLowerCase();
  } catch {
    return null;
  }
}

async function main() {
  const motels = JSON.parse(fs.readFileSync(DATA, "utf8"));
  const category = await prisma.category.findFirst({ where: { slug: "moteles" } });
  if (!category) throw new Error('No existe la categoría "moteles"');

  const existing = await prisma.establishment.findMany({
    where: { externalOnly: true },
    select: { id: true, name: true, city: true, address: true, websiteUrl: true, latitude: true, longitude: true, description: true, phone: true },
  });
  const bySite = new Map();
  const byName = new Map();
  for (const e of existing) {
    const k = e.websiteUrl && siteKey(e.websiteUrl);
    if (k) bySite.set(k, e);
    byName.set(`${norm(e.name)}|${norm(e.city)}`, e);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const m of motels) {
    const k = siteKey(m.websiteUrl);
    const found = (k && bySite.get(k)) || byName.get(`${norm(m.name)}|${norm(m.city)}`);
    if (found) {
      /* Sólo completa lo que falta. */
      const data = {};
      if (!found.websiteUrl && m.websiteUrl) data.websiteUrl = m.websiteUrl;
      if (found.latitude == null && m.latitude != null) data.latitude = m.latitude;
      if (found.longitude == null && m.longitude != null) data.longitude = m.longitude;
      if (!found.address && m.address) data.address = m.address;
      if (!found.phone && m.phone) data.phone = m.phone;
      if (!found.description && m.description) data.description = m.description;
      if (!Object.keys(data).length) {
        skipped++;
        continue;
      }
      console.log(`~ ${m.name} (${m.city}): ${Object.keys(data).join(", ")}`);
      if (!DRY_RUN) await prisma.establishment.update({ where: { id: found.id }, data });
      updated++;
      continue;
    }
    console.log(`+ ${m.name} (${m.city}) → ${m.websiteUrl}`);
    if (!DRY_RUN) {
      const row = await prisma.establishment.create({
        data: {
          categoryId: category.id,
          name: m.name,
          city: m.city,
          address: m.address || m.city,
          phone: m.phone || "",
          description: m.description || null,
          latitude: m.latitude,
          longitude: m.longitude,
          websiteUrl: m.websiteUrl,
          externalOnly: true,
        },
        select: { id: true, name: true, city: true, websiteUrl: true },
      });
      if (k) bySite.set(k, row);
      byName.set(`${norm(row.name)}|${norm(row.city)}`, row);
    }
    created++;
  }

  console.log(
    `\n${DRY_RUN ? "[dry-run] " : ""}${created} nuevos, ${updated} completados, ${skipped} sin cambios (de ${motels.length} en la lista).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/**
 * Bulk convert existing uploaded images to WebP.
 *
 * Usage:
 *   npx tsx src/scripts/convert-images-webp.ts [--dry-run]
 *
 * Scans the uploads directory, converts .jpg/.jpeg/.png/.bmp/.tiff to .webp,
 * then updates all matching URLs in the database.
 */

import sharp from "sharp";
import path from "path";
import fs from "node:fs/promises";

const UPLOADS_DIR = path.resolve(
  process.env.UPLOAD_DIR ||
    process.env.STORAGE_DIR ||
    process.env.UPLOADS_DIR ||
    "./uploads",
);

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif"]);
const WEBP_QUALITY = 80;
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  console.log(`[convert] Scanning ${UPLOADS_DIR}...`);
  if (DRY_RUN) console.log("[convert] DRY RUN — no files will be modified");

  let files: string[];
  try {
    files = await fs.readdir(UPLOADS_DIR);
  } catch {
    console.error(`[convert] Cannot read directory: ${UPLOADS_DIR}`);
    process.exit(1);
  }

  const candidates = files.filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
  console.log(`[convert] Found ${candidates.length} images to convert (out of ${files.length} total files)`);

  let converted = 0;
  let skipped = 0;
  let failed = 0;
  const renames: Array<{ oldName: string; newName: string }> = [];

  for (const filename of candidates) {
    const ext = path.extname(filename).toLowerCase();
    const baseName = path.basename(filename, ext);
    const newFilename = `${baseName}.webp`;
    const srcPath = path.join(UPLOADS_DIR, filename);
    const dstPath = path.join(UPLOADS_DIR, newFilename);

    // Skip if webp already exists
    try {
      await fs.access(dstPath);
      skipped++;
      continue;
    } catch {
      // Good — doesn't exist yet
    }

    if (DRY_RUN) {
      console.log(`  [dry] ${filename} → ${newFilename}`);
      renames.push({ oldName: filename, newName: newFilename });
      converted++;
      continue;
    }

    try {
      await sharp(srcPath)
        .webp({ quality: WEBP_QUALITY })
        .toFile(dstPath);

      // Remove original
      await fs.unlink(srcPath).catch(() => {});
      renames.push({ oldName: filename, newName: newFilename });
      converted++;

      if (converted % 50 === 0) {
        console.log(`  [convert] Progress: ${converted}/${candidates.length}`);
      }
    } catch (err: any) {
      console.error(`  [convert] Failed: ${filename} — ${err.message}`);
      failed++;
    }
  }

  console.log(`[convert] Done: ${converted} converted, ${skipped} skipped, ${failed} failed`);

  if (renames.length === 0) {
    console.log("[convert] No DB updates needed.");
    return;
  }

  // Update database URLs
  console.log(`[convert] Updating ${renames.length} URLs in database...`);

  if (DRY_RUN) {
    console.log("[convert] DRY RUN — skipping DB updates");
    return;
  }

  // Dynamic import to avoid requiring DB connection for dry run
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  try {
    for (const { oldName, newName } of renames) {
      const oldEncoded = encodeURIComponent(oldName);
      const newEncoded = encodeURIComponent(newName);

      // Update User avatarUrl and coverUrl
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET "avatarUrl" = REPLACE("avatarUrl", $1, $2) WHERE "avatarUrl" LIKE $3`,
        oldEncoded, newEncoded, `%${oldEncoded}%`,
      );
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET "coverUrl" = REPLACE("coverUrl", $1, $2) WHERE "coverUrl" LIKE $3`,
        oldEncoded, newEncoded, `%${oldEncoded}%`,
      );

      // Update ProfileMedia
      await prisma.$executeRawUnsafe(
        `UPDATE "ProfileMedia" SET "url" = REPLACE("url", $1, $2) WHERE "url" LIKE $3`,
        oldEncoded, newEncoded, `%${oldEncoded}%`,
      );

      // Update Media (posts)
      await prisma.$executeRawUnsafe(
        `UPDATE "Media" SET "url" = REPLACE("url", $1, $2) WHERE "url" LIKE $3`,
        oldEncoded, newEncoded, `%${oldEncoded}%`,
      );

      // Update Story
      await prisma.$executeRawUnsafe(
        `UPDATE "Story" SET "mediaUrl" = REPLACE("mediaUrl", $1, $2) WHERE "mediaUrl" LIKE $3`,
        oldEncoded, newEncoded, `%${oldEncoded}%`,
      );

      // Update Banner
      await prisma.$executeRawUnsafe(
        `UPDATE "Banner" SET "imageUrl" = REPLACE("imageUrl", $1, $2) WHERE "imageUrl" LIKE $3`,
        oldEncoded, newEncoded, `%${oldEncoded}%`,
      );

      // Update ServiceMedia
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "ServiceMedia" SET "url" = REPLACE("url", $1, $2) WHERE "url" LIKE $3`,
          oldEncoded, newEncoded, `%${oldEncoded}%`,
        );
      } catch {
        // Table might not exist
      }

      // Update ProductMedia
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "ProductMedia" SET "url" = REPLACE("url", $1, $2) WHERE "url" LIKE $3`,
          oldEncoded, newEncoded, `%${oldEncoded}%`,
        );
      } catch {
        // Table might not exist
      }
    }

    console.log("[convert] DB updates complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[convert] Fatal:", err);
  process.exit(1);
});

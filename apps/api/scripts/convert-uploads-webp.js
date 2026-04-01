/**
 * Convert legacy jpg/png uploads to webp.
 * Runs on each deploy via docker-entrypoint.sh.
 * Safe to run multiple times — skips already converted files.
 * Non-fatal — if it fails, the API still starts.
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs/promises");

const UPLOADS_DIR = path.resolve(
  process.env.UPLOAD_DIR || process.env.STORAGE_DIR || process.env.UPLOADS_DIR || "./uploads"
);
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".bmp", ".tiff", ".tif"]);
const WEBP_QUALITY = 80;

async function main() {
  let files;
  try {
    files = await fs.readdir(UPLOADS_DIR);
  } catch {
    console.log("[convert] No uploads directory — skipping");
    return;
  }

  const candidates = files.filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()));
  if (!candidates.length) {
    console.log("[convert] No jpg/png images to convert");
    return;
  }

  console.log(`[convert] Found ${candidates.length} images to convert...`);

  let converted = 0;
  let skipped = 0;
  let failed = 0;
  const renames = [];

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

    try {
      await sharp(srcPath).webp({ quality: WEBP_QUALITY }).toFile(dstPath);
      await fs.unlink(srcPath).catch(() => {});
      renames.push({ oldName: filename, newName: newFilename });
      converted++;
      if (converted % 50 === 0) {
        console.log(`[convert] Progress: ${converted}/${candidates.length}`);
      }
    } catch (err) {
      console.error(`[convert] Failed: ${filename} — ${err.message}`);
      failed++;
    }
  }

  console.log(`[convert] Done: ${converted} converted, ${skipped} skipped, ${failed} failed`);

  if (!renames.length) return;

  // Update database URLs
  console.log(`[convert] Updating ${renames.length} URLs in database...`);
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  try {
    for (const { oldName, newName } of renames) {
      const oldEnc = encodeURIComponent(oldName);
      const newEnc = encodeURIComponent(newName);
      const like = `%${oldEnc}%`;

      const tables = [
        { table: "User", column: "avatarUrl" },
        { table: "User", column: "coverUrl" },
        { table: "ProfileMedia", column: "url" },
        { table: "Media", column: "url" },
        { table: "Story", column: "mediaUrl" },
        { table: "Banner", column: "imageUrl" },
        { table: "ServiceMedia", column: "url" },
        { table: "ProductMedia", column: "url" },
      ];

      for (const { table, column } of tables) {
        try {
          await prisma.$executeRawUnsafe(
            `UPDATE "${table}" SET "${column}" = REPLACE("${column}", $1, $2) WHERE "${column}" LIKE $3`,
            oldEnc,
            newEnc,
            like
          );
        } catch {
          // Table might not exist — skip silently
        }
      }
    }
    console.log("[convert] DB updates complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[convert] Error (non-fatal):", err.message);
  process.exit(0); // Exit 0 so it doesn't block the deploy
});

/**
 * Backfill Uzeed watermark on existing uploads.
 *
 * For every *.webp image in the uploads directory (that isn't already
 * watermarked), re-writes the file with the Uzeed watermark stamped in the
 * bottom-right corner, renames it with a `wm_` prefix (idempotency marker),
 * deletes the original, and updates every DB column/array that referenced
 * the old filename.
 *
 * Safe to run multiple times — files starting with `wm_` are skipped.
 *
 * Scope: only stamps images in "gallery-ish" size buckets. Files under
 * 400px wide (thumbnails, very small avatars) are left untouched to match
 * the runtime upload policy in apps/api/src/lib/imageOptimizer.ts.
 *
 * Usage:
 *   node apps/api/scripts/backfill-watermarks.js
 *
 * Or via the API Docker container's node at startup.
 *
 * Non-fatal on errors — exits 0 so it can be wired into deploy flows
 * without risk of blocking.
 */
const sharp = require("sharp");
const path = require("path");
const fs = require("fs/promises");

const UPLOADS_DIR = path.resolve(
  process.env.UPLOAD_DIR ||
    process.env.STORAGE_DIR ||
    process.env.UPLOADS_DIR ||
    "./uploads",
);

const WATERMARK_PREFIX = "wm_";
const MIN_WIDTH = 400;
const WEBP_QUALITY = 80;
const IMAGE_EXTS = new Set([".webp", ".jpg", ".jpeg", ".png"]);

/* ──────────────────────────────────────────────────────────────
   Watermark (duplicated from src/lib/watermark.ts so this script
   can run as plain JS without a TS build step). If you change
   the design there, mirror it here.
   ────────────────────────────────────────────────────────────── */
const watermarkCache = new Map();

function buildSvg(width, height) {
  const fontSize = Math.round(height * 0.62);
  const strokeW = Math.max(1, Math.round(fontSize / 18));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${strokeW * 1.2}"/>
      <feOffset dx="0" dy="${Math.max(1, Math.round(strokeW / 2))}" result="offsetblur"/>
      <feComponentTransfer><feFuncA type="linear" slope="0.65"/></feComponentTransfer>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <linearGradient id="wmGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#f5d7ff" stop-opacity="0.95"/>
    </linearGradient>
  </defs>
  <text
    x="50%" y="50%"
    dominant-baseline="middle"
    text-anchor="middle"
    font-family="'Helvetica Neue', Arial, sans-serif"
    font-weight="900"
    font-size="${fontSize}"
    letter-spacing="${Math.round(fontSize * 0.02)}"
    fill="url(#wmGrad)"
    fill-opacity="0.55"
    stroke="#1a0033"
    stroke-opacity="0.35"
    stroke-width="${strokeW}"
    paint-order="stroke fill"
    filter="url(#shadow)"
  >Uzeed.cl</text>
</svg>`;
}

async function buildWatermark(targetWidth) {
  const bucketed = Math.max(200, Math.round(targetWidth / 100) * 100);
  const cached = watermarkCache.get(bucketed);
  if (cached) return cached;

  const width = Math.round(bucketed * 0.22);
  const height = Math.round(width / 3.6);
  const margin = Math.max(8, Math.round(bucketed * 0.015));
  const svg = buildSvg(width, height);
  const promise = sharp(Buffer.from(svg))
    .png()
    .toBuffer()
    .then((png) =>
      sharp(png)
        .extend({
          top: 0,
          left: 0,
          right: margin,
          bottom: margin,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer(),
    );
  watermarkCache.set(bucketed, promise);
  promise.catch(() => watermarkCache.delete(bucketed));
  return promise;
}

/* ──────────────────────────────────────────────────────────────
   File walker + watermark stamper
   ────────────────────────────────────────────────────────────── */

/**
 * Recursively list relative paths of image files under UPLOADS_DIR.
 * Skips files that already carry the watermark prefix.
 */
async function walkImages(absDir, relPrefix = "") {
  let entries;
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const out = [];
  for (const entry of entries) {
    const rel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      const sub = await walkImages(abs, rel);
      out.push(...sub);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) continue;
    if (entry.name.startsWith(WATERMARK_PREFIX)) continue;
    out.push(rel);
  }
  return out;
}

async function stampOne(relPath) {
  const absIn = path.join(UPLOADS_DIR, relPath);
  const dirname = path.dirname(relPath);
  const filename = path.basename(relPath);
  const ext = path.extname(filename);
  const baseName = path.basename(filename, ext);
  const newFilename = `${WATERMARK_PREFIX}${baseName}.webp`;
  const newRel = dirname === "." ? newFilename : `${dirname}/${newFilename}`;
  const absOut = path.join(UPLOADS_DIR, newRel);

  // If the marked twin already exists, nothing to do (idempotent).
  try {
    await fs.access(absOut);
    // Still delete the unmarked original to avoid orphans.
    if (absIn !== absOut) {
      await fs.unlink(absIn).catch(() => {});
    }
    return { skipped: true, oldRel: relPath, newRel };
  } catch {}

  const meta = await sharp(absIn).metadata();
  const srcW = meta.width || 0;

  if (srcW < MIN_WIDTH) {
    // Too small to watermark — leave in place, don't rename.
    return { tooSmall: true, oldRel: relPath, newRel: relPath };
  }

  // Don't enlarge. Use original width as target for watermark sizing.
  const wm = await buildWatermark(srcW);

  await sharp(absIn)
    .rotate()
    .composite([{ input: wm, gravity: "southeast" }])
    .webp({ quality: WEBP_QUALITY })
    .toFile(absOut);

  if (absIn !== absOut) {
    await fs.unlink(absIn).catch(() => {});
  }

  return { stamped: true, oldRel: relPath, newRel };
}

/* ──────────────────────────────────────────────────────────────
   Database URL rewrites
   ────────────────────────────────────────────────────────────── */

/** Scalar string columns that may embed an uploaded filename. */
const SCALAR_TARGETS = [
  { table: "User", column: "avatarUrl" },
  { table: "User", column: "coverUrl" },
  { table: "ProfileMedia", column: "url" },
  { table: "Media", column: "url" },
  { table: "Story", column: "mediaUrl" },
  { table: "Banner", column: "imageUrl" },
  { table: "Banner", column: "promoImageUrl" },
  { table: "ServiceMedia", column: "url" },
  { table: "ProductMedia", column: "url" },
  { table: "UmateCreator", column: "avatarUrl" },
  { table: "UmateCreator", column: "coverUrl" },
  { table: "UmatePostMedia", column: "url" },
];

/** text[] array columns that may embed an uploaded filename in any element. */
const ARRAY_TARGETS = [
  { table: "Establishment", column: "galleryUrls" },
  { table: "MotelRoom", column: "photoUrls" },
];

async function updateUrlsForRename(prisma, oldRel, newRel) {
  // Try both raw and URL-encoded forms to cover legacy records that stored
  // either the bare path or an encoded URL fragment.
  const forms = [
    [oldRel, newRel],
    [encodeURIComponent(oldRel), encodeURIComponent(newRel)],
  ];
  // Also handle the last path segment alone (for records that stored just
  // the filename, no directory prefix) — applies only when there's no slash.
  const oldBase = path.basename(oldRel);
  const newBase = path.basename(newRel);
  if (!oldRel.includes("/")) {
    forms.push([oldBase, newBase]);
    forms.push([encodeURIComponent(oldBase), encodeURIComponent(newBase)]);
  }

  for (const [oldStr, newStr] of forms) {
    const like = `%${oldStr}%`;

    for (const { table, column } of SCALAR_TARGETS) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "${table}" SET "${column}" = REPLACE("${column}", $1, $2) WHERE "${column}" LIKE $3`,
          oldStr,
          newStr,
          like,
        );
      } catch {
        // Table/column may not exist in all deployments — skip silently
      }
    }

    for (const { table, column } of ARRAY_TARGETS) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE "${table}" SET "${column}" = (
             SELECT array_agg(REPLACE(elem, $1, $2))
             FROM unnest("${column}") AS elem
           )
           WHERE array_to_string("${column}", '||') LIKE $3`,
          oldStr,
          newStr,
          like,
        );
      } catch {
        // Array column may not exist — skip silently
      }
    }
  }
}

/* ──────────────────────────────────────────────────────────────
   Main
   ────────────────────────────────────────────────────────────── */

async function main() {
  let files;
  try {
    files = await walkImages(UPLOADS_DIR);
  } catch (err) {
    console.log(`[watermark] Cannot read uploads dir (${UPLOADS_DIR}) — skipping:`, err.message);
    return;
  }

  if (!files.length) {
    console.log("[watermark] No unmarked images found — nothing to do.");
    return;
  }

  console.log(`[watermark] Found ${files.length} unmarked images in ${UPLOADS_DIR}`);

  let stamped = 0;
  let skipped = 0;
  let tooSmall = 0;
  let failed = 0;
  const renames = [];

  for (const rel of files) {
    try {
      const r = await stampOne(rel);
      if (r.stamped) {
        stamped++;
        renames.push({ oldRel: r.oldRel, newRel: r.newRel });
      } else if (r.skipped) {
        skipped++;
        renames.push({ oldRel: r.oldRel, newRel: r.newRel });
      } else if (r.tooSmall) {
        tooSmall++;
      }
      if ((stamped + skipped) % 25 === 0 && stamped + skipped > 0) {
        console.log(
          `[watermark] Progress: ${stamped + skipped}/${files.length} (stamped=${stamped}, skipped=${skipped}, tooSmall=${tooSmall}, failed=${failed})`,
        );
      }
    } catch (err) {
      console.error(`[watermark] Failed: ${rel} — ${err.message}`);
      failed++;
    }
  }

  console.log(
    `[watermark] File pass done: ${stamped} stamped, ${skipped} already-watermarked, ${tooSmall} too small, ${failed} failed`,
  );

  if (!renames.length) {
    console.log("[watermark] No DB updates needed.");
    return;
  }

  console.log(`[watermark] Updating DB URLs for ${renames.length} renamed files...`);
  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();

  try {
    let dbUpdated = 0;
    for (const { oldRel, newRel } of renames) {
      if (oldRel === newRel) continue;
      await updateUrlsForRename(prisma, oldRel, newRel);
      dbUpdated++;
      if (dbUpdated % 50 === 0) {
        console.log(`[watermark] DB progress: ${dbUpdated}/${renames.length}`);
      }
    }
    console.log(`[watermark] DB updates complete (${dbUpdated} renames applied).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[watermark] Error (non-fatal):", err.message);
  process.exit(0);
});

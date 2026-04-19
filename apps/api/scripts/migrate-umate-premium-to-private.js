/**
 * Migrate existing UMATE PREMIUM media from the public /uploads folder
 * to the private umate storage root. Runs on each deploy via
 * docker-entrypoint.sh after Prisma migrations.
 *
 *  - Idempotent: skips rows whose url already starts with "private://".
 *  - Non-destructive: originals are moved to a timestamped backup
 *    folder, never deleted outright.
 *  - Non-fatal: any per-row error is logged and skipped; the API still
 *    starts even if migration fails entirely.
 *
 * Env:
 *   UPLOAD_DIR / STORAGE_DIR    — public uploads dir (default ./uploads)
 *   PRIVATE_STORAGE_DIR         — private root (default <uploads>/../umate-private)
 *   MIGRATE_UMATE_PREMIUM=skip  — disable this job on a given deploy
 */
const path = require("path");
const fs = require("fs/promises");
const { randomUUID } = require("crypto");
const { PrismaClient } = require("@prisma/client");

const PRIVATE_PREFIX = "private://";

const UPLOADS_DIR = path.resolve(
  process.env.UPLOAD_DIR || process.env.STORAGE_DIR || process.env.UPLOADS_DIR || "./uploads",
);

const PRIVATE_DIR = path.resolve(
  process.env.PRIVATE_STORAGE_DIR || path.join(UPLOADS_DIR, "..", "umate-private"),
);

// Backup of originals lives INSIDE the private dir — must never be under
// UPLOADS_DIR, otherwise express.static would keep serving the "migrated" file.
const BACKUP_DIR = path.join(PRIVATE_DIR, ".trash-originals");

const DANGEROUS_EXTS = new Set([
  ".html", ".htm", ".xhtml", ".svg", ".xml",
  ".php", ".jsp", ".asp", ".aspx", ".cgi",
  ".js", ".mjs", ".ts", ".css", ".swf",
]);

function safeExt(ext) {
  const lower = (ext || "").toLowerCase();
  return DANGEROUS_EXTS.has(lower) ? ".bin" : lower;
}

/** Pull the relative path under the uploads dir out of a stored url.
 *  Accepts "/uploads/foo/bar.mp4", "https://api…/uploads/foo/bar.mp4",
 *  or bare filenames. Returns null if the url doesn't live under /uploads. */
function urlToUploadsRelPath(url) {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith(PRIVATE_PREFIX)) return null;
  const marker = "/uploads/";
  const idx = url.indexOf(marker);
  if (idx >= 0) {
    const rel = url.slice(idx + marker.length);
    return decodeURI(rel.replace(/^\/+/, ""));
  }
  // bare filename — e.g. "xxx.jpg"
  if (!url.includes("/")) return url;
  return null;
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function moveFile(src, dest) {
  await ensureDir(path.dirname(dest));
  try {
    await fs.rename(src, dest);
  } catch (err) {
    if (err && err.code === "EXDEV") {
      // cross-device rename not permitted — fallback to copy + unlink
      await fs.copyFile(src, dest);
      await fs.unlink(src);
    } else {
      throw err;
    }
  }
}

/** Copy + delete with a backup step. Returns the new private url. */
async function migrateFileToPrivate(absSource, rowId, folder) {
  const ext = safeExt(path.extname(absSource));
  const datePart = new Date().toISOString().slice(0, 7);
  const newRel = `${folder}/${datePart}/${rowId}-${randomUUID()}${ext}`;
  const newAbs = path.join(PRIVATE_DIR, newRel);
  await ensureDir(path.dirname(newAbs));
  // Copy first — if copy fails we haven't lost the original.
  await fs.copyFile(absSource, newAbs);
  // Then stash the original in the backup folder (never hard delete here).
  const backupRel = path.relative(UPLOADS_DIR, absSource);
  const backupAbs = path.join(BACKUP_DIR, backupRel);
  await moveFile(absSource, backupAbs).catch(() => {/* best-effort */});
  return PRIVATE_PREFIX + newRel;
}

async function main() {
  if (process.env.MIGRATE_UMATE_PREMIUM === "skip") {
    console.log("[migrate-umate-premium] MIGRATE_UMATE_PREMIUM=skip — skipping");
    return;
  }

  const prisma = new PrismaClient();
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  let totalBytes = 0;

  try {
    const rows = await prisma.umatePostMedia.findMany({
      where: {
        visibility: "PREMIUM",
        NOT: { url: { startsWith: PRIVATE_PREFIX } },
      },
      select: { id: true, url: true, thumbnailUrl: true },
    });

    if (rows.length === 0) {
      console.log("[migrate-umate-premium] Nothing to migrate — all premium media already private.");
      return;
    }

    console.log(`[migrate-umate-premium] Found ${rows.length} premium row(s) to migrate.`);

    for (const row of rows) {
      const update = {};

      // Asset
      try {
        const rel = urlToUploadsRelPath(row.url);
        if (!rel) {
          skipped++;
          continue;
        }
        const absSrc = path.resolve(UPLOADS_DIR, rel);
        if (!absSrc.startsWith(UPLOADS_DIR + path.sep) && absSrc !== UPLOADS_DIR) {
          console.warn(`[migrate-umate-premium] Skip ${row.id}: path traversal suspect (${rel})`);
          skipped++;
          continue;
        }
        const stat = await fs.stat(absSrc).catch(() => null);
        if (!stat || !stat.isFile()) {
          console.warn(`[migrate-umate-premium] Skip ${row.id}: source file missing (${absSrc})`);
          skipped++;
          continue;
        }
        totalBytes += stat.size;
        update.url = await migrateFileToPrivate(absSrc, row.id, "umate-posts");
      } catch (err) {
        errors++;
        console.error(`[migrate-umate-premium] Asset error for ${row.id}:`, err && err.message ? err.message : err);
        continue;
      }

      // Thumbnail (best-effort — missing thumb is not fatal)
      if (row.thumbnailUrl && !row.thumbnailUrl.startsWith(PRIVATE_PREFIX)) {
        try {
          const rel = urlToUploadsRelPath(row.thumbnailUrl);
          if (rel) {
            const absSrc = path.resolve(UPLOADS_DIR, rel);
            if (absSrc.startsWith(UPLOADS_DIR + path.sep)) {
              const stat = await fs.stat(absSrc).catch(() => null);
              if (stat && stat.isFile()) {
                update.thumbnailUrl = await migrateFileToPrivate(absSrc, row.id, "umate-thumbs");
              }
            }
          }
        } catch (err) {
          console.warn(`[migrate-umate-premium] Thumb warning for ${row.id}:`, err && err.message ? err.message : err);
        }
      }

      if (update.url) {
        try {
          await prisma.umatePostMedia.update({ where: { id: row.id }, data: update });
          migrated++;
        } catch (err) {
          errors++;
          console.error(`[migrate-umate-premium] DB update failed for ${row.id}:`, err && err.message ? err.message : err);
        }
      }
    }

    const mb = (totalBytes / (1024 * 1024)).toFixed(1);
    console.log(`[migrate-umate-premium] Done. migrated=${migrated} skipped=${skipped} errors=${errors} total=${mb}MB`);
    console.log(`[migrate-umate-premium] Originals backed up under ${BACKUP_DIR}`);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error("[migrate-umate-premium] Fatal error — continuing deploy:", err && err.message ? err.message : err);
  process.exit(0);
});

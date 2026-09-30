import { Router, type Request, type Response } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { prisma } from "../db";
import { requireAuth, requireAdmin } from "../auth/middleware";
import { config } from "../config";
import { asyncHandler } from "../lib/asyncHandler";
import { PRIVATE_DIR, PRIVATE_PREFIX, isPrivateRef, privateRefToRelPath, streamPrivateFile } from "../umate/privateStorage";
import { serveFromS3, S3_PUBLIC_PREFIX } from "../storage/s3Serve";

/**
 * Professional accreditation documents.
 *
 * Creators upload PDFs or images of their exams / certificates here so an
 * admin can grant them the "profesional con examenes" tag. They are health
 * data (datos sensibles), so files live in the private storage dir — never
 * under the public /uploads mount — and are only streamed through
 * authenticated routes: the owner via /profile/documents/:id/file and admins
 * via /admin/professional-documents/:id/file.
 *
 * Rows store a "private://professional-docs/<file>" ref. Older rows still hold
 * a public /uploads/professional-docs/... URL; `migrateLegacyProfessionalDocs`
 * moves those files into private storage at boot.
 */

export const professionalDocsRouter = Router();

// ── Storage ──────────────────────────────────────────────────────────────
export const DOCS_SUBFOLDER = "professional-docs";
const DOCS_DIR = path.join(PRIVATE_DIR, DOCS_SUBFOLDER);
/** Where documents were stored before they moved to private storage (served publicly). */
export const LEGACY_DOCS_DIR = path.join(path.resolve(config.storageDir), DOCS_SUBFOLDER);

async function ensureDocsDir() {
  await fs.mkdir(DOCS_DIR, { recursive: true });
}

// Extensions considered safe for accreditation documents.
// Intentionally conservative — no HTML/JS/SVG (handled by server's CSP header too).
const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif",
]);

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
]);

function sanitizeExt(ext: string): string {
  const lower = ext.toLowerCase();
  if (ALLOWED_EXTENSIONS.has(lower)) return lower;
  return ".bin";
}

const MAX_SIZE = 15 * 1024 * 1024; // 15 MB
const MAX_DOCS_PER_USER = 10;

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        await ensureDocsDir();
        cb(null, DOCS_DIR);
      } catch (err) {
        cb(err as Error, DOCS_DIR);
      }
    },
    filename: (_req, file, cb) => {
      const ext = sanitizeExt(path.extname(file.originalname || ""));
      const name = `${Date.now()}-${randomUUID()}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || "").toLowerCase();
    if (!ALLOWED_MIMES.has(mime)) {
      return cb(new Error("INVALID_FILE_TYPE"));
    }
    return cb(null, true);
  },
});

function privateRefFor(filename: string): string {
  return `${PRIVATE_PREFIX}${DOCS_SUBFOLDER}/${filename}`;
}

/** Filename of a legacy public URL (".../uploads/professional-docs/<file>"), or null. */
function legacyFilename(fileUrl: string): string | null {
  let pathname = fileUrl;
  try {
    pathname = new URL(fileUrl).pathname;
  } catch {
    // relative path
  }
  let name: string;
  try {
    name = path.posix.basename(decodeURIComponent(pathname));
  } catch {
    return null;
  }
  if (!name || name.startsWith(".") || name.includes("\\") || name.includes("\0")) return null;
  return name;
}

/** The URL clients get instead of the storage ref: an authenticated API route. */
function fileRouteFor(scope: "owner" | "admin", id: string): string {
  const base = config.apiUrl.replace(/\/$/, "");
  return scope === "owner"
    ? `${base}/profile/documents/${id}/file`
    : `${base}/admin/professional-documents/${id}/file`;
}

function withFileRoute<T extends { id: string; fileUrl: string }>(scope: "owner" | "admin", doc: T): T {
  return { ...doc, fileUrl: fileRouteFor(scope, doc.id) };
}

async function isFile(abs: string): Promise<boolean> {
  try {
    return (await fs.stat(abs)).isFile();
  } catch {
    return false;
  }
}

/** Absolute path on disk of a stored document, or null if it can't be resolved safely. */
function localPathFor(fileUrl: string): string | null {
  if (isPrivateRef(fileUrl)) {
    const rel = privateRefToRelPath(fileUrl);
    if (!rel) return null;
    const abs = path.resolve(PRIVATE_DIR, rel);
    return abs.startsWith(DOCS_DIR + path.sep) ? abs : null;
  }
  const name = legacyFilename(fileUrl);
  return name ? path.join(LEGACY_DOCS_DIR, name) : null;
}

const LEGACY_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Content-Disposition": "inline",
  "Content-Security-Policy": "default-src 'none'; img-src 'self'",
};

async function sendLegacyFromDisk(name: string, res: Response): Promise<boolean> {
  const abs = path.join(LEGACY_DOCS_DIR, name);
  if (!(await isFile(abs))) return false;
  for (const [k, v] of Object.entries(LEGACY_HEADERS)) res.setHeader(k, v);
  res.sendFile(abs);
  return true;
}

async function streamDocument(fileUrl: string, req: Request, res: Response): Promise<void> {
  res.setHeader("Referrer-Policy", "no-referrer");
  if (isPrivateRef(fileUrl)) {
    const rel = privateRefToRelPath(fileUrl);
    const abs = localPathFor(fileUrl);
    if (!rel || !abs) {
      res.status(404).json({ error: "NOT_FOUND" });
      return;
    }
    // Migrated rows keep their original copy; use it if the private one is missing.
    if (!(await isFile(abs)) && (await sendLegacyFromDisk(path.basename(abs), res))) return;
    await streamPrivateFile(rel, req, res);
    return;
  }
  // Legacy row whose file could not be migrated at boot (e.g. only in S3).
  const name = legacyFilename(fileUrl);
  if (!name) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  if (await sendLegacyFromDisk(name, res)) return;
  const served = await serveFromS3(`${S3_PUBLIC_PREFIX}${DOCS_SUBFOLDER}/${name}`, req, res, LEGACY_HEADERS).catch(() => false);
  if (!served && !res.headersSent) res.status(404).json({ error: "NOT_FOUND" });
}

/**
 * Copies documents uploaded before the switch to private storage into
 * PRIVATE_DIR and repoints their rows. The public copy is kept as a backup
 * (it is no longer reachable: /uploads blocks this folder and the S3 mirror
 * skips it) and is removed together with the document. Idempotent; runs on
 * every boot. Rows whose file is not on local disk are left as-is and are
 * still served (from S3) through the authenticated routes.
 */
export async function migrateLegacyProfessionalDocs(): Promise<void> {
  const legacy = await prisma.professionalDocument.findMany({
    where: { NOT: { fileUrl: { startsWith: PRIVATE_PREFIX } } },
    select: { id: true, fileUrl: true },
  });
  if (!legacy.length) return;
  await ensureDocsDir();
  let moved = 0;
  for (const doc of legacy) {
    const name = legacyFilename(doc.fileUrl);
    if (!name) continue;
    const from = path.join(LEGACY_DOCS_DIR, name);
    const to = path.join(DOCS_DIR, name);
    try {
      if (!(await isFile(to))) {
        if (!(await isFile(from))) continue;
        await fs.copyFile(from, to);
      }
      await prisma.professionalDocument.update({
        where: { id: doc.id },
        data: { fileUrl: privateRefFor(name) },
      });
      moved++;
    } catch (err) {
      console.error("[professional-docs] migration failed", doc.id, (err as Error)?.message);
    }
  }
  console.log(`[professional-docs] copied ${moved}/${legacy.length} legacy documents to private storage`);
}

async function cleanupFile(absPath: string) {
  try {
    await fs.unlink(absPath);
  } catch {
    // ignore
  }
}

// ── Creator-facing endpoints ────────────────────────────────────────────
professionalDocsRouter.use("/profile/documents", requireAuth);

professionalDocsRouter.get(
  "/profile/documents",
  asyncHandler(async (req, res) => {
    const docs = await prisma.professionalDocument.findMany({
      where: { userId: req.session.userId! },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        fileUrl: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        note: true,
        status: true,
        rejectReason: true,
        reviewedAt: true,
        createdAt: true,
      },
    });
    return res.json({ documents: docs.map((d) => withFileRoute("owner", d)) });
  }),
);

professionalDocsRouter.get(
  "/profile/documents/:id/file",
  asyncHandler(async (req, res) => {
    const doc = await prisma.professionalDocument.findUnique({
      where: { id: req.params.id },
      select: { userId: true, fileUrl: true },
    });
    if (!doc || doc.userId !== req.session.userId!) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    await streamDocument(doc.fileUrl, req, res);
  }),
);

professionalDocsRouter.post(
  "/profile/documents",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const file = req.file as Express.Multer.File | undefined;
    if (!file) return res.status(400).json({ error: "NO_FILE" });

    // Enforce per-user cap to prevent abuse of the persistent volume.
    const existing = await prisma.professionalDocument.count({
      where: { userId: req.session.userId! },
    });
    if (existing >= MAX_DOCS_PER_USER) {
      await cleanupFile(file.path);
      return res.status(400).json({
        error: "TOO_MANY_DOCUMENTS",
        message: `Puedes subir hasta ${MAX_DOCS_PER_USER} documentos. Elimina alguno antiguo para subir uno nuevo.`,
      });
    }

    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 500) : null;

    const fileUrl = privateRefFor(file.filename);

    const doc = await prisma.professionalDocument.create({
      data: {
        userId: req.session.userId!,
        fileUrl,
        originalName: file.originalname || file.filename,
        mimeType: file.mimetype || "application/octet-stream",
        sizeBytes: file.size || 0,
        note: note || null,
      },
      select: {
        id: true,
        fileUrl: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        note: true,
        status: true,
        rejectReason: true,
        reviewedAt: true,
        createdAt: true,
      },
    });

    return res.json({ document: withFileRoute("owner", doc) });
  }),
);

professionalDocsRouter.delete(
  "/profile/documents/:id",
  asyncHandler(async (req, res) => {
    const doc = await prisma.professionalDocument.findUnique({
      where: { id: req.params.id },
    });
    if (!doc || doc.userId !== req.session.userId!) {
      return res.status(404).json({ error: "NOT_FOUND" });
    }

    // Try to remove the underlying file. Best-effort: DB row is still removed
    // even if the file is already missing from disk.
    const abs = localPathFor(doc.fileUrl);
    if (abs) {
      await cleanupFile(abs);
      // Migrated rows also left their original copy in the old public folder.
      await cleanupFile(path.join(LEGACY_DOCS_DIR, path.basename(abs)));
    }

    await prisma.professionalDocument.delete({ where: { id: doc.id } });
    return res.json({ ok: true });
  }),
);

// ── Admin endpoints ──────────────────────────────────────────────────────
professionalDocsRouter.use("/admin/professional-documents", requireAdmin);

professionalDocsRouter.get(
  "/admin/professional-documents",
  asyncHandler(async (req, res) => {
    const status = typeof req.query.status === "string"
      ? req.query.status.toUpperCase()
      : "PENDING";
    const allowed = new Set(["PENDING", "APPROVED", "REJECTED", "ALL"]);
    if (!allowed.has(status)) {
      return res.status(400).json({ error: "INVALID_STATUS" });
    }

    const where: any = {};
    if (status !== "ALL") where.status = status;

    const docs = await prisma.professionalDocument.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        fileUrl: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        note: true,
        status: true,
        rejectReason: true,
        reviewedAt: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            email: true,
            profileType: true,
            profileTags: true,
          },
        },
      },
    });

    return res.json({ documents: docs.map((d) => withFileRoute("admin", d)) });
  }),
);

professionalDocsRouter.get(
  "/admin/professional-documents/:id/file",
  asyncHandler(async (req, res) => {
    const doc = await prisma.professionalDocument.findUnique({
      where: { id: req.params.id },
      select: { fileUrl: true },
    });
    if (!doc) return res.status(404).json({ error: "NOT_FOUND" });
    await streamDocument(doc.fileUrl, req, res);
  }),
);

professionalDocsRouter.post(
  "/admin/professional-documents/:id/review",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const action = String(req.body?.action || "").toUpperCase();
    const rejectReason = typeof req.body?.rejectReason === "string"
      ? req.body.rejectReason.trim().slice(0, 500)
      : null;

    if (action !== "APPROVE" && action !== "REJECT") {
      return res.status(400).json({ error: "INVALID_ACTION" });
    }

    const doc = await prisma.professionalDocument.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true },
    });
    if (!doc) return res.status(404).json({ error: "NOT_FOUND" });

    const newStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";

    const updated = await prisma.professionalDocument.update({
      where: { id },
      data: {
        status: newStatus,
        rejectReason: action === "REJECT" ? rejectReason || null : null,
        reviewedAt: new Date(),
        reviewedById: req.session.userId!,
      },
      select: {
        id: true,
        status: true,
        rejectReason: true,
        reviewedAt: true,
      },
    });

    return res.json({ document: updated });
  }),
);

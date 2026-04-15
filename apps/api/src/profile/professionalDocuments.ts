import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { prisma } from "../db";
import { requireAuth, requireAdmin } from "../auth/middleware";
import { config } from "../config";
import { asyncHandler } from "../lib/asyncHandler";

/**
 * Professional accreditation documents.
 *
 * Creators upload PDFs or images of their exams / certificates here so an
 * admin can grant them the "profesional con examenes" tag. Files are stored
 * under the persistent uploads volume (${storageDir}/professional-docs/...)
 * so they survive redeploys.
 */

export const professionalDocsRouter = Router();

// ── Storage ──────────────────────────────────────────────────────────────
const DOCS_SUBFOLDER = "professional-docs";
const DOCS_DIR = path.join(path.resolve(config.storageDir), DOCS_SUBFOLDER);

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

function publicUrlFor(filename: string): string {
  const base = config.apiUrl.replace(/\/$/, "");
  return `${base}/uploads/${DOCS_SUBFOLDER}/${encodeURIComponent(filename)}`;
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
    return res.json({ documents: docs });
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

    const fileUrl = publicUrlFor(file.filename);

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

    return res.json({ document: doc });
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
    try {
      const url = new URL(doc.fileUrl);
      const filename = path.basename(decodeURIComponent(url.pathname));
      if (filename) {
        await cleanupFile(path.join(DOCS_DIR, filename));
      }
    } catch {
      // Legacy rows without a parseable URL — skip filesystem cleanup.
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

    return res.json({ documents: docs });
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

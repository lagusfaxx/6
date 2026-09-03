import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { createHash, randomBytes, randomUUID } from "node:crypto";

import { prisma } from "../db";
import { config } from "../config";
import { requireAdmin } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { emitAdminEvent } from "../lib/adminEvents";
import { normalizePhoneForWhatsApp } from "../notifications/whatsapp";
import { sendBaileysText } from "../notifications/whatsappBaileys";

/**
 * Verificación facial de perfiles pendientes.
 *
 * El admin genera un enlace único por perfil y se lo manda por WhatsApp. La
 * profesional lo abre —sin iniciar sesión, porque suele estar en otro
 * teléfono— y se toma tres fotos guiadas. El admin las compara con las de su
 * galería y recién ahí publica el perfil.
 *
 * El enlace es un token aleatorio de 32 bytes del que sólo se guarda el
 * SHA-256: si alguien lee la base de datos no puede reconstruir la URL, y
 * como es de un solo uso y con vencimiento, reenviarlo tampoco sirve.
 */

export const faceVerificationRouter = Router();

const LINK_TTL_HOURS = 48;
const SHOTS_SUBFOLDER = "face-verification";
const SHOTS_DIR = path.join(path.resolve(config.storageDir), SHOTS_SUBFOLDER);
const MAX_SHOT_BYTES = 8 * 1024 * 1024;
const MAX_SHOTS = 5;

/** Poses que se le piden, en orden. El front las muestra una a una. */
export const REQUIRED_POSES = ["FRONT", "LEFT", "RIGHT"] as const;

const ALLOWED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function publicUrlFor(filename: string): string {
  const base = config.apiUrl.replace(/\/$/, "");
  return `${base}/uploads/${SHOTS_SUBFOLDER}/${encodeURIComponent(filename)}`;
}

function verificationUrl(token: string): string {
  return `${config.appUrl.replace(/\/$/, "")}/verificacion/${token}`;
}

const uploadShots = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        await fs.mkdir(SHOTS_DIR, { recursive: true });
        cb(null, SHOTS_DIR);
      } catch (err) {
        cb(err as Error, SHOTS_DIR);
      }
    },
    filename: (_req, file, cb) => {
      const ext = (file.mimetype || "").includes("png")
        ? ".png"
        : (file.mimetype || "").includes("webp")
          ? ".webp"
          : ".jpg";
      cb(null, `${Date.now()}-${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_SHOT_BYTES, files: MAX_SHOTS },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.has((file.mimetype || "").toLowerCase())) {
      return cb(new Error("INVALID_FILE_TYPE"));
    }
    return cb(null, true);
  },
});

/** Busca la verificación por token y decide si todavía sirve. */
async function findByToken(token: string) {
  if (!token || token.length < 20) return null;
  const verification = await prisma.faceVerification.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      user: { select: { id: true, displayName: true, username: true } },
    },
  });
  return verification;
}

/* ── Página pública del enlace (sin sesión) ──────────────────── */

faceVerificationRouter.get(
  "/face-verification/:token",
  asyncHandler(async (req, res) => {
    const verification = await findByToken(String(req.params.token));
    if (!verification) return res.status(404).json({ error: "NOT_FOUND" });

    const expired = verification.expiresAt.getTime() <= Date.now();
    // El vencimiento se materializa al abrirlo: así el admin ve el estado real
    // sin depender de un proceso que barra la tabla.
    if (expired && verification.status === "PENDING") {
      await prisma.faceVerification.update({
        where: { id: verification.id },
        data: { status: "EXPIRED" },
      });
    }

    return res.json({
      status: expired && verification.status === "PENDING" ? "EXPIRED" : verification.status,
      name: verification.user.displayName || verification.user.username,
      poses: REQUIRED_POSES,
      expiresAt: verification.expiresAt.toISOString(),
    });
  }),
);

faceVerificationRouter.post(
  "/face-verification/:token/shots",
  uploadShots.array("shots", MAX_SHOTS),
  asyncHandler(async (req, res) => {
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const cleanup = () =>
      Promise.all(files.map((f) => fs.unlink(f.path).catch(() => {})));

    const verification = await findByToken(String(req.params.token));
    if (!verification) {
      await cleanup();
      return res.status(404).json({ error: "NOT_FOUND" });
    }
    if (verification.expiresAt.getTime() <= Date.now()) {
      await cleanup();
      await prisma.faceVerification
        .update({ where: { id: verification.id }, data: { status: "EXPIRED" } })
        .catch(() => {});
      return res.status(410).json({
        error: "LINK_EXPIRED",
        message: "El enlace venció. Pídele uno nuevo al equipo.",
      });
    }
    if (verification.status !== "PENDING") {
      await cleanup();
      return res.status(409).json({
        error: "ALREADY_SUBMITTED",
        message: "Ya recibimos tus fotos, están en revisión.",
      });
    }
    if (files.length === 0) {
      return res.status(400).json({ error: "NO_FILES", message: "No llegó ninguna foto." });
    }

    // Las poses viajan en el mismo orden que los archivos.
    const rawPoses = req.body?.poses;
    const poses: string[] = Array.isArray(rawPoses)
      ? rawPoses.map(String)
      : typeof rawPoses === "string"
        ? String(rawPoses).split(",")
        : [];

    await prisma.$transaction([
      prisma.faceVerificationShot.createMany({
        data: files.map((file, i) => ({
          verificationId: verification.id,
          url: publicUrlFor(file.filename),
          pose: (poses[i] || REQUIRED_POSES[i] || "FRONT").toUpperCase().slice(0, 16),
        })),
      }),
      prisma.faceVerification.update({
        where: { id: verification.id },
        data: { status: "SUBMITTED", submittedAt: new Date() },
      }),
    ]);

    await emitAdminEvent({
      type: "face_verification_submitted",
      user: verification.user.displayName || verification.user.username,
      targetId: verification.id,
    }).catch((err) => {
      console.error("[faceVerification] admin event failed:", (err as Error)?.message);
    });

    return res.status(201).json({ ok: true, received: files.length });
  }),
);

/* ── Admin ───────────────────────────────────────────────────── */

faceVerificationRouter.use("/admin/face-verifications", requireAdmin);

/** Crea el enlace de un perfil y, si se pide, lo manda por WhatsApp. */
faceVerificationRouter.post(
  "/admin/face-verifications",
  asyncHandler(async (req, res) => {
    const adminId = req.session.userId!;
    const userId = String(req.body?.userId || "");
    const send = req.body?.send !== false;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true, username: true, phone: true },
    });
    if (!user) return res.status(404).json({ error: "NOT_FOUND" });

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + LINK_TTL_HOURS * 60 * 60 * 1000);

    // Un enlace vivo por perfil: los anteriores dejan de servir apenas se crea
    // uno nuevo, para que no queden URLs sueltas circulando por WhatsApp.
    const created = await prisma.$transaction(async (tx) => {
      await tx.faceVerification.updateMany({
        where: { userId, status: "PENDING" },
        data: { status: "EXPIRED" },
      });
      return tx.faceVerification.create({
        data: {
          userId,
          tokenHash: hashToken(token),
          expiresAt,
          createdById: adminId,
        },
        select: { id: true, expiresAt: true },
      });
    });

    const url = verificationUrl(token);
    let whatsapp: { sent: boolean; error?: string } = { sent: false };

    if (send) {
      const to = normalizePhoneForWhatsApp(user.phone);
      if (!to) {
        whatsapp = { sent: false, error: "INVALID_PHONE" };
      } else {
        const name = user.displayName || user.username;
        const text =
          `Hola ${name} 👋 Somos el equipo de UZEED.\n\n` +
          `Para publicar tu perfil necesitamos una verificación rápida: entra a este enlace y sigue los pasos, ` +
          `son 3 fotos de tu cara y toma menos de un minuto.\n\n${url}\n\n` +
          `El enlace es personal y vence en ${LINK_TTL_HOURS} horas. No lo compartas con nadie.`;
        const result = await sendBaileysText(to, text);
        whatsapp = { sent: result.ok, error: result.error };
        if (result.ok) {
          await prisma.faceVerification.update({
            where: { id: created.id },
            data: { sentAt: new Date(), sentTo: to },
          });
        }
      }
    }

    // La URL se devuelve una sola vez: después ya no es recuperable desde la
    // base, así que el admin puede copiarla si el envío automático falló.
    return res.status(201).json({
      id: created.id,
      url,
      expiresAt: created.expiresAt.toISOString(),
      whatsapp,
    });
  }),
);

/** Verificaciones para revisar, con las capturas y la galería del perfil. */
faceVerificationRouter.get(
  "/admin/face-verifications",
  asyncHandler(async (req, res) => {
    const status = String(req.query.status || "SUBMITTED").toUpperCase();
    const where: any = {};
    if (["PENDING", "SUBMITTED", "APPROVED", "REJECTED", "EXPIRED"].includes(status)) {
      where.status = status;
    }

    const [verifications, submittedCount] = await Promise.all([
      prisma.faceVerification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          status: true,
          expiresAt: true,
          sentAt: true,
          sentTo: true,
          submittedAt: true,
          reviewedAt: true,
          rejectReason: true,
          createdAt: true,
          shots: {
            orderBy: { createdAt: "asc" },
            select: { id: true, url: true, pose: true },
          },
          user: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              phone: true,
              city: true,
              isVerified: true,
              isActive: true,
              createdAt: true,
              profileMedia: {
                where: { type: "IMAGE" },
                orderBy: { createdAt: "desc" },
                take: 12,
                select: { id: true, url: true },
              },
            },
          },
          review: { select: { id: true, username: true, displayName: true } },
        },
      }),
      prisma.faceVerification.count({ where: { status: "SUBMITTED" } }),
    ]);

    return res.json({ verifications, submittedCount });
  }),
);

/** Aprobar: verifica y publica el perfil. */
faceVerificationRouter.post(
  "/admin/face-verifications/:id/approve",
  asyncHandler(async (req, res) => {
    const adminId = req.session.userId!;
    const verification = await prisma.faceVerification.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true, status: true },
    });
    if (!verification) return res.status(404).json({ error: "NOT_FOUND" });
    if (verification.status !== "SUBMITTED") {
      return res.status(409).json({
        error: "NOT_SUBMITTED",
        message: "Solo se aprueban verificaciones con fotos enviadas.",
      });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: verification.userId },
        data: {
          isVerified: true,
          verifiedAt: new Date(),
          isActive: true,
        },
      }),
      prisma.faceVerification.update({
        where: { id: verification.id },
        data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: adminId },
      }),
    ]);

    await prisma.notification
      .create({
        data: {
          userId: verification.userId,
          type: "FACE_VERIFICATION_REVIEWED",
          data: {
            title: "¡Perfil verificado!",
            body: "Tu verificación fue aprobada y tu perfil ya está publicado.",
            url: "/cuenta/perfil",
            status: "APPROVED",
          },
        },
      })
      .catch((err) => console.error("[faceVerification] notify failed:", (err as Error)?.message));

    return res.json({ ok: true });
  }),
);

/** Rechazar: el perfil sigue sin publicarse y ella recibe el motivo. */
faceVerificationRouter.post(
  "/admin/face-verifications/:id/reject",
  asyncHandler(async (req, res) => {
    const adminId = req.session.userId!;
    const reason = req.body?.reason ? String(req.body.reason).trim().slice(0, 500) : null;

    const verification = await prisma.faceVerification.findUnique({
      where: { id: req.params.id },
      select: { id: true, userId: true, status: true },
    });
    if (!verification) return res.status(404).json({ error: "NOT_FOUND" });
    if (verification.status !== "SUBMITTED") {
      return res.status(409).json({ error: "NOT_SUBMITTED" });
    }

    await prisma.faceVerification.update({
      where: { id: verification.id },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewedById: adminId,
        rejectReason: reason,
      },
    });

    await prisma.notification
      .create({
        data: {
          userId: verification.userId,
          type: "FACE_VERIFICATION_REVIEWED",
          data: {
            title: "Verificación rechazada",
            body: reason || "Te enviaremos un enlace nuevo para repetir el proceso.",
            url: "/cuenta/perfil",
            status: "REJECTED",
          },
        },
      })
      .catch((err) => console.error("[faceVerification] notify failed:", (err as Error)?.message));

    return res.json({ ok: true });
  }),
);

/** Borrar las capturas de una verificación ya revisada. */
faceVerificationRouter.delete(
  "/admin/face-verifications/:id/shots",
  asyncHandler(async (req, res) => {
    const verification = await prisma.faceVerification.findUnique({
      where: { id: req.params.id },
      select: { id: true, status: true, shots: { select: { id: true, url: true } } },
    });
    if (!verification) return res.status(404).json({ error: "NOT_FOUND" });
    if (verification.status === "SUBMITTED") {
      return res.status(409).json({
        error: "PENDING_REVIEW",
        message: "Revisa la verificación antes de borrar las fotos.",
      });
    }

    // Las capturas son datos sensibles: se borran del disco, no sólo de la base.
    for (const shot of verification.shots) {
      const filename = decodeURIComponent(shot.url.split("/").pop() || "");
      if (!filename || filename.includes("..") || filename.includes("/")) continue;
      await fs.unlink(path.join(SHOTS_DIR, filename)).catch(() => {});
    }
    await prisma.faceVerificationShot.deleteMany({ where: { verificationId: verification.id } });

    return res.json({ ok: true, deleted: verification.shots.length });
  }),
);

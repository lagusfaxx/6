import { Router } from "express";
import { prisma } from "../db";
import { requireAuth } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { config } from "../config";
import {
  createDiditSession,
  extractIdentity,
  isDiditConfigured,
  normalizeStatus,
  retrieveDiditDecision,
  verifyDiditWebhook,
  type NormalizedStatus,
} from "./didit";

export const verificationRouter = Router();

const ELIGIBLE_PROFILE_TYPES = new Set(["PROFESSIONAL", "ESTABLISHMENT", "SHOP"]);

/* Mapea la decisión del proveedor al enum de Prisma. */
function toPrismaStatus(s: NormalizedStatus) {
  return s; // los nombres coinciden con IdentityVerificationStatus
}

/**
 * Inicia (o reabre) la verificación de identidad del profesional.
 * Devuelve la URL de Didit donde completa el escaneo + prueba de vida.
 */
verificationRouter.post(
  "/verification/identity/start",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!isDiditConfigured()) {
      return res.status(503).json({ error: "VERIFICATION_NOT_CONFIGURED" });
    }
    const userId = req.session.userId!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, profileType: true, isVerified: true },
    });
    if (!user) return res.status(404).json({ error: "USER_NOT_FOUND" });
    if (!ELIGIBLE_PROFILE_TYPES.has(String(user.profileType))) {
      return res.status(403).json({ error: "NOT_ELIGIBLE" });
    }

    const callbackUrl = `${config.apiUrl}/verification/identity/webhook`;
    const result = await createDiditSession(userId, callbackUrl);
    if (!result.ok) {
      return res.status(502).json({ error: "PROVIDER_ERROR", detail: result.error });
    }

    await prisma.identityVerification.create({
      data: {
        userId,
        provider: "didit",
        sessionId: result.sessionId,
        status: "PENDING",
      },
    });

    return res.json({ url: result.url, sessionId: result.sessionId });
  }),
);

/** Estado actual de verificación de identidad del usuario. */
verificationRouter.get(
  "/verification/identity/status",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const [user, latest] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { isVerified: true, verifiedAt: true },
      }),
      prisma.identityVerification.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { status: true, decision: true, rejectReason: true, reviewedAt: true, createdAt: true },
      }),
    ]);
    return res.json({
      configured: isDiditConfigured(),
      isVerified: Boolean(user?.isVerified),
      verifiedAt: user?.verifiedAt ?? null,
      latest: latest ?? null,
    });
  }),
);

/**
 * Webhook de Didit. Público pero validado con HMAC. Actualiza la sesión y,
 * si la identidad fue aprobada y es mayor de edad, marca al usuario como
 * verificado y le agrega el badge "verificada".
 */
verificationRouter.post(
  "/verification/identity/webhook",
  asyncHandler(async (req, res) => {
    const rawBody: Buffer | undefined = (req as any).rawBody;
    if (!verifyDiditWebhook(rawBody ?? JSON.stringify(req.body ?? {}), req.headers as any)) {
      return res.status(401).json({ error: "INVALID_SIGNATURE" });
    }

    const body = req.body ?? {};
    const sessionId: string = body.session_id || body.sessionId || "";
    const vendorData: string = body.vendor_data || body.vendorData || "";
    if (!sessionId) return res.status(400).json({ error: "NO_SESSION_ID" });

    const record = await prisma.identityVerification.findUnique({
      where: { sessionId },
      select: { id: true, userId: true },
    });
    // vendor_data es nuestro userId; sirve de respaldo si la sesión no existe
    const userId = record?.userId || vendorData;
    if (!userId) return res.status(404).json({ error: "SESSION_NOT_FOUND" });

    const status = normalizeStatus(body.status || body.decision?.status);

    // Para aprobaciones, traemos la decisión completa para validar la edad.
    let isAdult: boolean | null = null;
    let documentType: string | null = null;
    let fullDecision: any = body.decision ?? null;
    if (status === "APPROVED") {
      const decision = (await retrieveDiditDecision(sessionId)) || body.decision;
      if (decision) {
        fullDecision = decision;
        const extracted = extractIdentity(decision);
        isAdult = extracted.isAdult;
        documentType = extracted.documentType;
      }
    }

    // Menor de edad confirmado: tratamos como rechazo aunque Didit aprobara.
    const isMinor = isAdult === false;
    const finalStatus = isMinor ? "DECLINED" : status;
    const rejectReason = isMinor ? "MENOR_DE_EDAD" : null;
    const resolved = finalStatus === "APPROVED" || finalStatus === "DECLINED";

    if (record) {
      await prisma.identityVerification.update({
        where: { id: record.id },
        data: {
          status: toPrismaStatus(finalStatus),
          decision: String(body.status || finalStatus),
          isAdult,
          documentType,
          rejectReason,
          payload: fullDecision ?? undefined,
          reviewedAt: resolved ? new Date() : null,
        },
      });
    }

    if (finalStatus === "APPROVED") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { profileTags: true },
      });
      const tags = Array.isArray(user?.profileTags) ? user!.profileTags : [];
      const nextTags = tags.includes("verificada") ? tags : [...tags, "verificada"];
      await prisma.user.update({
        where: { id: userId },
        data: {
          isVerified: true,
          verifiedAt: new Date(),
          isActive: true,
          profileTags: nextTags,
        },
      });
      console.log(`[didit] usuario verificado user=${userId} session=${sessionId}`);
    } else if (isMinor) {
      console.warn(`[didit] rechazo por minoría de edad user=${userId} session=${sessionId}`);
    }

    return res.json({ ok: true });
  }),
);

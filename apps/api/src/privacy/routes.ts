import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler";
import { emitAdminEvent } from "../lib/adminEvents";

export const privacyRouter = Router();

/**
 * POST /privacy/request-deletion
 * Public endpoint – anyone can request account/data deletion.
 * Body: { type: "account" | "data", email: string, message?: string }
 */
privacyRouter.post(
  "/privacy/request-deletion",
  asyncHandler(async (req, res) => {
    const { type, email, message } = req.body || {};

    if (!type || !["account", "data"].includes(type)) {
      return res.status(400).json({ error: "INVALID_TYPE", message: "Tipo debe ser 'account' o 'data'." });
    }
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "INVALID_EMAIL", message: "Debes proporcionar un correo válido." });
    }

    const sanitizedEmail = email.trim().slice(0, 254);
    const sanitizedMessage = typeof message === "string" ? message.trim().slice(0, 1000) : "";
    const label = type === "account" ? "cuenta y datos" : "datos";

    await emitAdminEvent({
      type: "deletion_requested",
      user: sanitizedEmail,
      contentType: "profile",
      targetId: type,
    });

    console.info("[privacy] deletion request", { type, email: sanitizedEmail, message: sanitizedMessage });

    return res.json({
      ok: true,
      message: `Solicitud de eliminación de ${label} recibida. Nos pondremos en contacto contigo.`,
    });
  }),
);

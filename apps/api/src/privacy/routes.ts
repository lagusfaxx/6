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
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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

    console.info("[privacy] deletion request", { type, timestamp: new Date().toISOString() });

    return res.json({
      ok: true,
      message: `Solicitud de eliminación de ${label} recibida. Nos pondremos en contacto contigo.`,
    });
  }),
);

/**
 * POST /contact
 * Public endpoint – contact form submissions.
 * Body: { name?: string, email: string, category: string, message: string }
 */
privacyRouter.post(
  "/contact",
  asyncHandler(async (req, res) => {
    const { name, email, category, message } = req.body || {};

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "INVALID_EMAIL", message: "Debes proporcionar un correo válido." });
    }
    if (!message || typeof message !== "string" || message.trim().length < 5) {
      return res.status(400).json({ error: "INVALID_MESSAGE", message: "El mensaje debe tener al menos 5 caracteres." });
    }

    const sanitizedEmail = email.trim().slice(0, 254);
    const sanitizedName = typeof name === "string" ? name.trim().slice(0, 100) : "";
    const sanitizedCategory = typeof category === "string" ? category.trim().slice(0, 50) : "general";
    const sanitizedMessage = message.trim().slice(0, 2000);

    await emitAdminEvent({
      type: "contact_form",
      user: sanitizedName ? `${sanitizedName} (${sanitizedEmail})` : sanitizedEmail,
      contentType: "message",
      targetId: sanitizedCategory,
    });

    console.info("[contact] form submission", {
      category: sanitizedCategory,
      timestamp: new Date().toISOString(),
    });

    return res.json({
      ok: true,
      message: "Tu mensaje ha sido enviado. Te responderemos a la brevedad.",
    });
  }),
);

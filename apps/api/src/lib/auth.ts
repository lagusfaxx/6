import type { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma";

// Half-auth gate: a session whose user passed username+password but has not
// yet supplied the TOTP code is treated as not-authenticated for everything
// except the 2FA verify/status/logout endpoints (which run on a different
// router and bypass this guard).
function blockIfPendingTotp(req: Request, res: Response): boolean {
  if ((req.session as any)?.pendingTotp) {
    res.status(401).json({
      error: "PENDING_TOTP",
      message: "Verifica tu segundo factor (Google Authenticator) para continuar.",
    });
    return true;
  }
  return false;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "UNAUTHENTICATED" });
  if (blockIfPendingTotp(req, res)) return;
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "UNAUTHENTICATED" });
  if (blockIfPendingTotp(req, res)) return;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, totpEnabled: true },
  });
  if (!user || user.role !== "ADMIN") return res.status(403).json({ error: "FORBIDDEN" });
  // Make user available to downstream step-up middleware on this router.
  (req as any).user = user;
  next();
}

// Re-export step-up helpers so adminTokens / wallet / videocall routes can
// gate destructive endpoints with `requireAdmin, requireRecentTotp`.
export {
  requireRecentTotp,
  requireRecentTotpStrict,
  isStepUpFresh,
} from "../auth/twoFactor";

import type { Request } from "express";
import { prisma } from "./prisma";

export type AdminAuditAction =
  | "totp_enabled"
  | "totp_disabled"
  | "totp_verified"
  | "totp_backup_used"
  | "delete_profile"
  | "delete_quick_professional"
  | "delete_quick_listing"
  | "delete_banner"
  | "change_role"
  | "change_membership"
  | "approve_withdrawal"
  | "reject_withdrawal"
  | "approve_deposit"
  | "reject_deposit"
  | "approve_verification"
  | "reject_verification";

interface AuditInput {
  adminId: string;
  adminEmail?: string | null;
  action: AdminAuditAction | string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Append-only write to AdminAuditLog. Failures are logged but never thrown:
 * a logging error must not block the underlying admin action.
 */
export async function writeAdminAuditLog(input: AuditInput): Promise<void> {
  try {
    let email = input.adminEmail || null;
    if (!email) {
      const u = await prisma.user.findUnique({
        where: { id: input.adminId },
        select: { email: true },
      });
      email = u?.email || "unknown";
    }
    await (prisma as any).adminAuditLog.create({
      data: {
        adminId: input.adminId,
        adminEmail: email,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: input.metadata ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error("[adminAudit] failed to write audit log", {
      action: input.action,
      adminId: input.adminId,
      error: (err as Error)?.message,
    });
  }
}

/** Convenience extractor for routes — pulls IP and UA off the request. */
export function reqFingerprint(req: Request): { ip: string | null; userAgent: string | null } {
  const xff = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return {
    ip: xff || req.ip || null,
    userAgent: (req.headers["user-agent"] as string | undefined) || null,
  };
}

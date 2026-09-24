import { Router } from "express";
import { prisma } from "../db";
import { requireAdmin } from "../auth/middleware";
import { requireFresh2FA } from "../auth/twoFactor";
import { asyncHandler } from "../lib/asyncHandler";
import { isUUID } from "../lib/validators";
import { writeAudit } from "./audit";
import { revokeFamily } from "./oauth/store";

/**
 * Panel: quién tiene a Claude conectado y el botón para cortarlo. Sólo el
 * administrador (el equipo queda fuera por MODERATOR_BLOCKED_PREFIXES).
 * Revocar un acceso puntual no pide 2FA: cortar nunca debería costar; cortar
 * todos de una vez sí, porque deja a todo el equipo sin Claude.
 */
export const mcpAdminRouter = Router();

mcpAdminRouter.use("/admin/mcp", requireAdmin);

mcpAdminRouter.get(
  "/admin/mcp/accesos",
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const live = await prisma.mcpOAuthToken.findMany({
      where: { revokedAt: null, rotatedAt: null, familyExpiresAt: { gt: now }, refreshExpiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true, redirectUris: true } } },
    });
    const familyIds = live.map((t) => t.familyId);
    const [starts, users] = await Promise.all([
      prisma.mcpOAuthToken.groupBy({ by: ["familyId"], where: { familyId: { in: familyIds } }, _min: { createdAt: true } }),
      prisma.user.findMany({
        where: { id: { in: [...new Set(live.map((t) => t.userId))] } },
        select: { id: true, email: true, displayName: true, role: true },
      }),
    ]);
    const startById = new Map(starts.map((s) => [s.familyId, s._min.createdAt]));
    const userById = new Map(users.map((u) => [u.id, u]));
    return res.json({
      accesos: live.map((t) => ({
        id: t.familyId,
        usuario: userById.get(t.userId) ?? null,
        aplicacion: t.client.name,
        destino: t.client.redirectUris.map((u) => new URL(u).host),
        permisos: t.scope.split(" "),
        autorizadoEl: startById.get(t.familyId),
        venceEl: t.familyExpiresAt,
        ultimoUso: t.lastUsedAt,
        ultimaIp: t.lastIp,
      })),
    });
  }),
);

mcpAdminRouter.post(
  "/admin/mcp/accesos/:id/revocar",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!isUUID(id)) return res.status(400).json({ error: "INVALID_ID" });
    await revokeFamily(id, "revocado_desde_panel");
    await writeAudit({ tool: "panel_revocar_acceso", scope: "auth", userId: (req as any).user?.id, ip: req.ip, args: { familyId: id }, ok: true });
    return res.json({ ok: true });
  }),
);

mcpAdminRouter.post(
  "/admin/mcp/revocar-todo",
  requireFresh2FA,
  asyncHandler(async (req, res) => {
    const result = await prisma.mcpOAuthToken.updateMany({
      where: { revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: "revocado_todo_desde_panel" },
    });
    await writeAudit({ tool: "panel_revocar_todo", scope: "auth", userId: (req as any).user?.id, ip: req.ip, args: { tokens: result.count }, ok: true });
    return res.json({ ok: true, revocados: result.count });
  }),
);

mcpAdminRouter.get(
  "/admin/mcp/bitacora",
  asyncHandler(async (req, res) => {
    const take = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const rows = await prisma.mcpAuditLog.findMany({ orderBy: { createdAt: "desc" }, take });
    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.userId).filter(Boolean) as string[])] } },
      select: { id: true, email: true },
    });
    const emailById = new Map(users.map((u) => [u.id, u.email]));
    return res.json({ registros: rows.map((r) => ({ ...r, usuario: r.userId ? emailById.get(r.userId) ?? null : null })) });
  }),
);

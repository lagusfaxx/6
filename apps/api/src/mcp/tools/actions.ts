import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "../../db";
import { missingProfileFields } from "../../lib/profileCompletion";
import { guarded, type McpContext } from "../audit";
import { TIERS, errorResult, findUserRef, jsonResult } from "../helpers";

/**
 * Acciones que cambian datos. Sólo se registran con el token completo y todas
 * quedan en la bitácora. A propósito no hay nada de dinero (aprobar
 * depósitos o retiros, reembolsar, ajustar saldos) ni de borrado: eso sigue
 * pasando por el panel, que exige 2FA para lo destructivo.
 *
 * Cada acción replica lo que hace el endpoint equivalente del panel admin.
 */
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

const PROFILE_SELECT = {
  id: true,
  username: true,
  displayName: true,
  profileType: true,
  tier: true,
  isActive: true,
  isVerified: true,
} as const;

const usuarioField = z.string().describe("id (uuid), username o email del perfil");
const motivoField = z.string().max(500).optional().describe("Motivo, queda en la bitácora.");

export function registerActionTools(server: McpServer, ctx: McpContext) {
  if (ctx.scope !== "full") return;

  server.registerTool(
    "cambiar_estado_perfil",
    {
      title: "Activar o desactivar un perfil",
      description:
        "Publica (activo=true) u oculta (activo=false) un perfil del sitio. Equivale al interruptor del panel admin. Confirma con el usuario antes de ejecutar.",
      inputSchema: { usuario: usuarioField, activo: z.boolean(), motivo: motivoField },
      annotations: WRITE,
    },
    guarded(
      "cambiar_estado_perfil",
      ctx,
      async ({ usuario, activo }: { usuario: string; activo: boolean; motivo?: string }) => {
        const id = await findUserRef(usuario);
        if (!id) return errorResult(`No encontré al usuario "${usuario}".`);
        const before = await prisma.user.findUnique({ where: { id }, select: { isActive: true } });
        const updated = await prisma.user.update({ where: { id }, data: { isActive: activo }, select: PROFILE_SELECT });
        return jsonResult({ antes: before, perfil: updated });
      }
    ),
  );

  server.registerTool(
    "aprobar_verificacion",
    {
      title: "Aprobar verificación de perfil",
      description:
        "Marca un perfil como verificado y lo publica (igual que 'Aprobar' en Verificaciones del panel). Devuelve además qué le falta a la ficha, como información. Confirma con el usuario antes de ejecutar.",
      inputSchema: {
        usuario: usuarioField,
        verificadoPorTelefono: z.string().optional().describe("Teléfono con el que se verificó, si aplica."),
        motivo: motivoField,
      },
      annotations: WRITE,
    },
    guarded(
      "aprobar_verificacion",
      ctx,
      async ({ usuario, verificadoPorTelefono }: { usuario: string; verificadoPorTelefono?: string; motivo?: string }) => {
        const id = await findUserRef(usuario);
        if (!id) return errorResult(`No encontré al usuario "${usuario}".`);
        const user = await prisma.user.findUnique({
          where: { id },
          select: {
            profileType: true,
            profileCompletedAt: true,
            birthdate: true,
            heightCm: true,
            weightKg: true,
            measurements: true,
            hairColor: true,
            skinTone: true,
            baseRate: true,
            city: true,
            phone: true,
            bio: true,
            serviceTags: true,
            undisclosedFields: true,
          },
        });
        if (!user) return errorResult("Usuario no encontrado.");

        let missing: { key: string; label: string; tab: string }[] = [];
        if (user.profileType === "PROFESSIONAL") {
          const photoCount = await prisma.profileMedia.count({ where: { ownerId: id, type: "IMAGE" } });
          missing = missingProfileFields(user as any, photoCount);
        }

        const updated = await prisma.user.update({
          where: { id },
          data: {
            isVerified: true,
            verifiedAt: new Date(),
            verifiedByPhone: verificadoPorTelefono || null,
            isActive: true,
            profileCompletedAt: user.profileCompletedAt ?? new Date(),
          },
          select: PROFILE_SELECT,
        });
        return jsonResult({ perfil: updated, fichaIncompleta: missing });
      }
    ),
  );

  server.registerTool(
    "rechazar_verificacion",
    {
      title: "Rechazar verificación de perfil",
      description:
        "Rechaza la verificación de un perfil: queda sin verificar y oculto (igual que 'Rechazar' en Verificaciones del panel). Confirma con el usuario antes de ejecutar.",
      inputSchema: { usuario: usuarioField, motivo: motivoField },
      annotations: WRITE,
    },
    guarded(
      "rechazar_verificacion",
      ctx,
      async ({ usuario }: { usuario: string; motivo?: string }) => {
        const id = await findUserRef(usuario);
        if (!id) return errorResult(`No encontré al usuario "${usuario}".`);
        const updated = await prisma.user.update({ where: { id }, data: { isActive: false }, select: PROFILE_SELECT });
        return jsonResult({ perfil: updated });
      }
    ),
  );

  server.registerTool(
    "cambiar_tier",
    {
      title: "Cambiar tier de un perfil",
      description: "Asigna el tier PREMIUM, GOLD o SILVER a un perfil, o lo quita con NINGUNO. Afecta su posición en el directorio. Confirma con el usuario antes de ejecutar.",
      inputSchema: { usuario: usuarioField, tier: z.enum([...TIERS, "NINGUNO"]), motivo: motivoField },
      annotations: WRITE,
    },
    guarded(
      "cambiar_tier",
      ctx,
      async ({ usuario, tier }: { usuario: string; tier: (typeof TIERS)[number] | "NINGUNO"; motivo?: string }) => {
        const id = await findUserRef(usuario);
        if (!id) return errorResult(`No encontré al usuario "${usuario}".`);
        const before = await prisma.user.findUnique({ where: { id }, select: { tier: true } });
        const updated = await prisma.user.update({
          where: { id },
          // Rango puesto a mano: sin vencimiento.
          data: { tier: tier === "NINGUNO" ? null : tier, tierExpiresAt: null },
          select: PROFILE_SELECT,
        });
        return jsonResult({ antes: before, perfil: updated });
      }
    ),
  );
}

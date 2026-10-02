import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { prisma } from "../../db";
import { missingProfileFields } from "../../lib/profileCompletion";
import { REJECT_REASON_MIN_LENGTH, rejectVerification } from "../../lib/verificationReject";
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
            verificationRejectedAt: null,
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
        "Rechaza la verificación de un perfil: queda sin verificar, oculto y fuera de la cola de pendientes, y la profesional recibe por correo el texto de 'motivo' (obligatorio). Si corrige su ficha vuelve a la cola. Igual que 'Rechazar' en Verificaciones del panel. Confirma con el usuario antes de ejecutar.",
      inputSchema: {
        usuario: usuarioField,
        motivo: z.string().max(1000).describe("Motivo del rechazo: se le envía por correo a la profesional y queda en la bitácora."),
      },
      annotations: WRITE,
    },
    guarded(
      "rechazar_verificacion",
      ctx,
      async ({ usuario, motivo }: { usuario: string; motivo?: string }) => {
        const id = await findUserRef(usuario);
        if (!id) return errorResult(`No encontré al usuario "${usuario}".`);
        const reason = (motivo || "").trim();
        if (reason.length < REJECT_REASON_MIN_LENGTH) {
          return errorResult("Indica el motivo del rechazo en 'motivo': se le envía por correo a la profesional.");
        }
        const { emailSent } = await rejectVerification(id, reason);
        const updated = await prisma.user.findUnique({ where: { id }, select: PROFILE_SELECT });
        return jsonResult({ perfil: updated, correoEnviado: emailSent });
      }
    ),
  );

  server.registerTool(
    "cambiar_tier",
    {
      title: "Cambiar tier de un perfil",
      description: "Asigna el tier PREMIUM, GOLD o SILVER a un perfil, o lo quita con NINGUNO. Afecta su posición en el directorio. El tier sigue a la tarifa (GOLD desde $50.000, PREMIUM/Diamond desde $100.000) y se recalcula cuando la profesional cambia su tarifa; este cambio manual dura hasta entonces. Confirma con el usuario antes de ejecutar.",
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
          data: { tier: tier === "NINGUNO" ? null : tier },
          select: PROFILE_SELECT,
        });
        return jsonResult({ antes: before, perfil: updated });
      }
    ),
  );
}

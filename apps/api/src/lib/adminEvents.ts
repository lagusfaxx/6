import { config } from "../config";
import { prisma } from "./prisma";
import { sendPushToUsers } from "../notifications/push";
import { sendToUser } from "../realtime/sse";

export type AdminEventType =
  | "deposit_submitted"
  | "withdrawal_requested"
  | "profile_verification_requested"
  | "content_reported"
  | "deletion_requested";

type AdminEventInput = {
  type: AdminEventType;
  user?: string | null;
  amount?: number;
  contentType?: "profile" | "message" | "forum";
  targetId?: string;
};

const ADMIN_EVENT_CONFIG: Record<
  AdminEventType,
  { title: string; body: string; url: string }
> = {
  deposit_submitted: {
    title: "Nuevo depósito pendiente",
    body: "Un usuario envió un comprobante de depósito.",
    url: "/admin/deposits",
  },
  withdrawal_requested: {
    title: "Solicitud de retiro recibida",
    body: "Un profesional solicitó un retiro de tokens.",
    url: "/admin/withdrawals",
  },
  profile_verification_requested: {
    title: "Perfil solicitó verificación",
    body: "Un perfil profesional quedó pendiente de verificación.",
    url: "/admin/verifications",
  },
  content_reported: {
    title: "Contenido reportado",
    body: "Se reportó contenido para moderación.",
    url: "/admin/moderation",
  },
  deletion_requested: {
    title: "Solicitud de eliminación",
    body: "Un usuario solicitó eliminar su cuenta o datos.",
    url: "/admin/privacy-requests",
  },
};

async function getAdminIds() {
  const admins = await prisma.user.findMany({
    where: {
      OR: [
        { role: "ADMIN" },
        ...(config.adminEmail ? [{ email: config.adminEmail }] : []),
      ],
    },
    select: { id: true },
  });
  return [...new Set(admins.map((a) => a.id))];
}

export async function emitAdminEvent(input: AdminEventInput) {
  const meta = ADMIN_EVENT_CONFIG[input.type];
  const adminIds = await getAdminIds();
  if (!adminIds.length) return;

  const payload = {
    type: input.type,
    user: input.user || undefined,
    amount: input.amount,
    contentType: input.contentType,
    targetId: input.targetId,
    title: meta.title,
    body: meta.body,
    url: meta.url,
    timestamp: Date.now(),
  };

  for (const adminId of adminIds) {
    sendToUser(adminId, "admin_event", payload);
  }

  await prisma.notification.createMany({
    data: adminIds.map((adminId) => ({
      userId: adminId,
      type: "ADMIN_EVENT" as any,
      data: payload,
    })),
  }).catch((err) => {
    console.error("[adminEvents] Failed to create admin notifications:", err?.message || err);
  });

  await sendPushToUsers(prisma as any, adminIds, {
    title: meta.title,
    body: meta.body,
    data: payload,
    tag: `admin-${input.type}-${Date.now()}`,
  }).catch((err) => {
    console.error("[adminEvents] Failed to send push to admins:", err?.message || err);
  });
}

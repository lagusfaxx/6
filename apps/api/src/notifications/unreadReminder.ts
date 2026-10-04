import type { PrismaClient } from "@prisma/client";
import { isSmsConfigured, sendSms } from "./sms";
import { logDelivery, normalizePhoneForWhatsApp, smsNotificationText } from "./whatsapp";

/**
 * Recordatorio por SMS, lanzado a mano desde /admin/whatsapp, para las
 * profesionales que tienen mensajes de clientes sin leer.
 *
 * Siempre en dos pasos: vista previa (cuántas y el texto) y luego el envío.
 * No se envía de noche (22:00–09:00 hora de Chile) y a quien ya recibió este
 * recordatorio en las últimas 12 h no se le repite.
 */

export const REMINDER_TYPE = "UNREAD_REMINDER";
const NOTIFIABLE_PROFILE_TYPES = ["PROFESSIONAL", "ESTABLISHMENT", "SHOP"] as const;
const REPEAT_BLOCK_MS = 12 * 60 * 60 * 1000;
const SEND_GAP_MS = 300;

export type ReminderTarget = { userId: string; to: string; unread: number };

export function reminderText(unread: number): string {
  return smsNotificationText(`tienes ${unread} ${unread === 1 ? "mensaje" : "mensajes"} sin leer de clientes`);
}

/** Hora actual en Chile (0–23). */
function chileHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Santiago", hour: "numeric", hourCycle: "h23" }).format(new Date()),
  );
}

export function isQuietHours(): boolean {
  const h = chileHour();
  return h >= 22 || h < 9;
}

/** Profesionales activas, con teléfono, con mensajes sin leer de los últimos `days` días. */
export async function findReminderTargets(
  prisma: PrismaClient,
  days: number,
): Promise<{ targets: ReminderTarget[]; skippedRecent: number; skippedNoPhone: number }> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const unread = await prisma.message.groupBy({
    by: ["toId"],
    where: { readAt: null, createdAt: { gte: since } },
    _count: { _all: true },
  });
  if (!unread.length) return { targets: [], skippedRecent: 0, skippedNoPhone: 0 };

  const users = await prisma.user.findMany({
    where: {
      id: { in: unread.map((u) => u.toId) },
      isActive: true,
      profileType: { in: [...NOTIFIABLE_PROFILE_TYPES] },
    },
    select: { id: true, phone: true },
  });
  const recent = await prisma.notificationDelivery.findMany({
    where: {
      type: REMINDER_TYPE,
      ok: true,
      createdAt: { gte: new Date(Date.now() - REPEAT_BLOCK_MS) },
      userId: { in: users.map((u) => u.id) },
    },
    select: { userId: true },
  });
  const remindedRecently = new Set(recent.map((r) => r.userId));
  const counts = new Map(unread.map((u) => [u.toId, u._count._all]));

  const targets: ReminderTarget[] = [];
  let skippedRecent = 0;
  let skippedNoPhone = 0;
  for (const u of users) {
    if (remindedRecently.has(u.id)) {
      skippedRecent++;
      continue;
    }
    const to = normalizePhoneForWhatsApp(u.phone);
    if (!to) {
      skippedNoPhone++;
      continue;
    }
    targets.push({ userId: u.id, to, unread: counts.get(u.id) ?? 1 });
  }
  return { targets, skippedRecent, skippedNoPhone };
}

let running = false;

export function isReminderRunning(): boolean {
  return running;
}

/** Envía en segundo plano, de a uno. Cada envío queda en NotificationDelivery. */
export function startUnreadReminder(prisma: PrismaClient, targets: ReminderTarget[]): boolean {
  if (running || !isSmsConfigured()) return false;
  running = true;
  (async () => {
    let ok = 0;
    for (const t of targets) {
      const result = await sendSms(t.to, reminderText(t.unread));
      await logDelivery(prisma, { userId: t.userId, channel: "SMS", type: REMINDER_TYPE, result });
      if (result.ok) ok++;
      await new Promise((resolve) => setTimeout(resolve, SEND_GAP_MS));
    }
    console.log(`[sms] unread reminder done: ${ok}/${targets.length} sent`);
  })()
    .catch((err) => console.error("[sms] unread reminder error:", err?.message || err))
    .finally(() => {
      running = false;
    });
  return true;
}

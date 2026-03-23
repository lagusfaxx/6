import "dotenv/config";
import cron from "node-cron";
import { prisma } from "./db";
import { sendExpiryEmail, smtpEnabled } from "./worker/email";
import {
  sendNoPhotoReminder,
  sendInactiveProfileReminder,
  sendVideocallConfigReminder,
} from "./lib/notificationEmail";
import { sendInAppAndPush } from "./lib/sendReminder";

/* ─── Anti-spam: check if reminder was already sent ─── */

async function wasReminderSent(userId: string, type: string): Promise<boolean> {
  const existing = await prisma.reminderLog.findUnique({
    where: { userId_type: { userId, type } },
  });
  return !!existing;
}

async function markReminderSent(userId: string, type: string): Promise<void> {
  await prisma.reminderLog.upsert({
    where: { userId_type: { userId, type } },
    update: { createdAt: new Date() },
    create: { userId, type },
  });
}

/* ─── Membership expiry emails (existing) ─── */

async function tickMembershipExpiry() {
  const now = new Date();
  const in3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  if (smtpEnabled()) {
    const soon = await prisma.user.findMany({
      where: {
        membershipExpiresAt: {
          gte: new Date(in3.getTime() - 12 * 60 * 60 * 1000),
          lte: new Date(in3.getTime() + 12 * 60 * 60 * 1000),
        },
      },
    });
    for (const u of soon) {
      await sendExpiryEmail(u.email, u.membershipExpiresAt!);
    }
  }
}

/* ─── Professionals registered 5+ hours ago without ANY photos ─── */
/* "Sin fotos" = no avatar AND no cover AND no gallery images */

async function tickNoPhotoReminder() {
  const now = new Date();
  const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);

  // Professionals created 5+ hours ago
  const professionals = await prisma.user.findMany({
    where: {
      profileType: "PROFESSIONAL",
      createdAt: { lte: fiveHoursAgo },
    },
    select: { id: true, email: true, displayName: true, avatarUrl: true, coverUrl: true },
  });

  for (const p of professionals) {
    // Skip if they have avatar OR cover
    if (p.avatarUrl || p.coverUrl) continue;

    // Check gallery media
    const mediaCount = await prisma.profileMedia.count({
      where: { ownerId: p.id, type: "IMAGE" },
    });
    // Skip if they have at least 1 gallery image
    if (mediaCount > 0) continue;

    // Anti-spam: only send once
    if (await wasReminderSent(p.id, "no_photo")) continue;

    console.log(`[worker] sending no-photo reminder to ${p.email}`);
    await Promise.all([
      sendNoPhotoReminder(p.email, p.displayName),
      sendInAppAndPush(p.id, {
        type: "REMINDER_NO_PHOTO",
        title: "¡Sube tu primera foto!",
        body: "Los perfiles con fotos reciben hasta 10x más visitas. Sube tu primera foto ahora.",
        url: "/dashboard/services",
      }),
    ]);
    await markReminderSent(p.id, "no_photo");
  }
}

/* ─── Inactive profiles (48h+ without login) ─── */
/* Uses lastSeen as the real "last login" indicator */

async function tickInactiveReminder() {
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const inactive = await prisma.user.findMany({
    where: {
      profileType: "PROFESSIONAL",
      OR: [
        // lastSeen is older than 48h
        { lastSeen: { lt: fortyEightHoursAgo } },
        // Never logged in and account is older than 48h
        { lastSeen: null, createdAt: { lt: fortyEightHoursAgo } },
      ],
    },
    select: { id: true, email: true, displayName: true },
  });

  for (const p of inactive) {
    // Anti-spam: only send once
    if (await wasReminderSent(p.id, "inactive_48h")) continue;

    console.log(`[worker] sending inactive reminder to ${p.email}`);
    await Promise.all([
      sendInactiveProfileReminder(p.email, p.displayName),
      sendInAppAndPush(p.id, {
        type: "REMINDER_INACTIVE",
        title: "Te extrañamos en UZEED",
        body: "Hace más de 48h que no ingresas. Tus clientes te están buscando.",
        url: "/",
      }),
    ]);
    await markReminderSent(p.id, "inactive_48h");
  }
}

/* ─── Videocall service added but NOT properly configured ─── */
/* Validates: config exists AND has availableSlots with at least 1 slot AND pricePerMinute > 0 */

async function tickVideocallConfigReminder() {
  const professionals = await prisma.user.findMany({
    where: {
      profileType: "PROFESSIONAL",
      OR: [
        { serviceTags: { hasSome: ["videollamada", "videollamadas", "Videollamada", "Videollamadas"] } },
        { profileTags: { hasSome: ["videollamada", "videollamadas", "Videollamada", "Videollamadas"] } },
      ],
    },
    select: { id: true, email: true, displayName: true },
  });

  for (const p of professionals) {
    const config = await prisma.videocallConfig.findUnique({
      where: { professionalId: p.id },
    });

    // Properly configured = config exists + price > 0 + has at least 1 availability slot
    const isConfigured =
      config &&
      config.pricePerMinute > 0 &&
      config.isActive &&
      Array.isArray(config.availableSlots) &&
      (config.availableSlots as unknown[]).length > 0;

    if (isConfigured) continue;

    // Anti-spam: only send once
    if (await wasReminderSent(p.id, "videocall_config")) continue;

    console.log(`[worker] sending videocall config reminder to ${p.email}`);
    await Promise.all([
      sendVideocallConfigReminder(p.email, p.displayName),
      sendInAppAndPush(p.id, {
        type: "REMINDER_VIDEOCALL_CONFIG",
        title: "Configura tus videollamadas",
        body: "Agregaste videollamadas pero no configuraste horarios ni precios.",
        url: "/videocall",
      }),
    ]);
    await markReminderSent(p.id, "videocall_config");
  }
}

/* ─── Main tick: runs all scheduled checks ─── */

async function tick() {
  console.log("[worker] tick started at", new Date().toISOString());
  await tickMembershipExpiry();
  await tickNoPhotoReminder();
  await tickInactiveReminder();
  await tickVideocallConfigReminder();
  console.log("[worker] tick completed");
}

async function main() {
  console.log("[worker] started");

  // Run every hour to catch thresholds
  cron.schedule("0 * * * *", () => {
    tick().catch((e) => console.error("[worker] tick error", e));
  });

  // Run once on startup
  tick().catch((e) => console.error("[worker] initial tick error", e));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

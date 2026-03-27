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

/* ─── Membership expiry emails ─── */

async function tickMembershipExpiry() {
  if (!smtpEnabled()) return;

  const now = new Date();
  const in3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const soon = await prisma.user.findMany({
    where: {
      membershipExpiresAt: {
        gte: new Date(in3.getTime() - 12 * 60 * 60 * 1000),
        lte: new Date(in3.getTime() + 12 * 60 * 60 * 1000),
      },
    },
    select: { id: true, email: true, membershipExpiresAt: true },
  });

  for (const u of soon) {
    if (await wasReminderSent(u.id, "membership_expiry")) continue;

    console.log(`[worker] sending membership expiry email to ${u.email}`);
    await sendExpiryEmail(u.email, u.membershipExpiresAt!);
    await markReminderSent(u.id, "membership_expiry");
  }
}

/* ─── Professionals registered 5+ hours ago without ANY photos ─── */

async function tickNoPhotoReminder() {
  const now = new Date();
  const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);

  // Only query professionals that haven't received this reminder yet
  const alreadySent = await prisma.reminderLog.findMany({
    where: { type: "no_photo" },
    select: { userId: true },
  });
  const sentIds = new Set(alreadySent.map((r) => r.userId));

  const professionals = await prisma.user.findMany({
    where: {
      profileType: "PROFESSIONAL",
      isActive: true,
      createdAt: { lte: fiveHoursAgo },
      id: { notIn: [...sentIds] },
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
    if (mediaCount > 0) continue;

    console.log(`[worker] sending no-photo reminder to ${p.email}`);
    try {
      await Promise.all([
        sendNoPhotoReminder(p.email, p.displayName),
        sendInAppAndPush(p.id, {
          type: "REMINDER_NO_PHOTO",
          title: "¡Sube tu primera foto!",
          body: "Los perfiles con fotos reciben hasta 10x más visitas. Sube tu primera foto ahora.",
          url: "/dashboard/services",
        }),
      ]);
    } catch (err) {
      console.error(`[worker] no-photo reminder failed for ${p.email}`, err);
    }
    // Mark sent even on partial failure to avoid retrying every hour
    await markReminderSent(p.id, "no_photo");
  }
}

/* ─── Inactive profiles (48h+ without login) ─── */

async function tickInactiveReminder() {
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  // Only query professionals that haven't received this reminder yet
  const alreadySent = await prisma.reminderLog.findMany({
    where: { type: "inactive_48h" },
    select: { userId: true },
  });
  const sentIds = new Set(alreadySent.map((r) => r.userId));

  const inactive = await prisma.user.findMany({
    where: {
      profileType: "PROFESSIONAL",
      isActive: true,
      id: { notIn: [...sentIds] },
      OR: [
        { lastSeen: { lt: fortyEightHoursAgo } },
        { lastSeen: null, createdAt: { lt: fortyEightHoursAgo } },
      ],
    },
    select: { id: true, email: true, displayName: true },
  });

  for (const p of inactive) {
    console.log(`[worker] sending inactive reminder to ${p.email}`);
    try {
      await Promise.all([
        sendInactiveProfileReminder(p.email, p.displayName),
        sendInAppAndPush(p.id, {
          type: "REMINDER_INACTIVE",
          title: "Te extrañamos en UZEED",
          body: "Hace más de 48h que no ingresas. Tus clientes te están buscando.",
          url: "/",
        }),
      ]);
    } catch (err) {
      console.error(`[worker] inactive reminder failed for ${p.email}`, err);
    }
    await markReminderSent(p.id, "inactive_48h");
  }
}

/* ─── Videocall service added but NOT properly configured ─── */

async function tickVideocallConfigReminder() {
  // Only query professionals that haven't received this reminder yet
  const alreadySent = await prisma.reminderLog.findMany({
    where: { type: "videocall_config" },
    select: { userId: true },
  });
  const sentIds = new Set(alreadySent.map((r) => r.userId));

  const professionals = await prisma.user.findMany({
    where: {
      profileType: "PROFESSIONAL",
      isActive: true,
      id: { notIn: [...sentIds] },
      OR: [
        { serviceTags: { hasSome: ["videollamada", "videollamadas", "Videollamada", "Videollamadas"] } },
        { profileTags: { hasSome: ["videollamada", "videollamadas", "Videollamada", "Videollamadas"] } },
      ],
    },
    select: { id: true, email: true, displayName: true },
  });

  for (const p of professionals) {
    const vcConfig = await prisma.videocallConfig.findUnique({
      where: { professionalId: p.id },
    });

    const isConfigured =
      vcConfig &&
      vcConfig.pricePerMinute > 0 &&
      vcConfig.isActive &&
      Array.isArray(vcConfig.availableSlots) &&
      (vcConfig.availableSlots as unknown[]).length > 0;

    if (isConfigured) continue;

    console.log(`[worker] sending videocall config reminder to ${p.email}`);
    try {
      await Promise.all([
        sendVideocallConfigReminder(p.email, p.displayName),
        sendInAppAndPush(p.id, {
          type: "REMINDER_VIDEOCALL_CONFIG",
          title: "Configura tus videollamadas",
          body: "Agregaste videollamadas pero no configuraste horarios ni precios.",
          url: "/videocall",
        }),
      ]);
    } catch (err) {
      console.error(`[worker] videocall config reminder failed for ${p.email}`, err);
    }
    await markReminderSent(p.id, "videocall_config");
  }
}

/* ─── Main tick: runs all scheduled checks ─── */

async function tick() {
  console.log("[worker] tick started at", new Date().toISOString());
  try {
    await tickMembershipExpiry();
    await tickNoPhotoReminder();
    await tickInactiveReminder();
    await tickVideocallConfigReminder();
    console.log("[worker] tick completed");
  } catch (err) {
    console.error("[worker] tick failed", err);
  }
}

/**
 * Start the worker cron jobs.
 * Can be called from the main API process or run standalone via `node dist/worker.js`.
 */
export function startWorker() {
  console.log("[worker] started");

  // Run every hour to catch thresholds
  cron.schedule("0 * * * *", () => {
    tick().catch((e) => console.error("[worker] tick error", e));
  });

  // Run once on startup (delayed 10s to let the API finish booting)
  setTimeout(() => {
    tick().catch((e) => console.error("[worker] initial tick error", e));
  }, 10_000);
}

// Allow standalone execution: `node dist/worker.js`
const isMain =
  typeof require !== "undefined" && require.main === module;
if (isMain) {
  startWorker();
}

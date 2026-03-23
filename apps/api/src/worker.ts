import "dotenv/config";
import cron from "node-cron";
import { prisma } from "./db";
import { sendExpiryEmail, smtpEnabled } from "./worker/email";
import {
  sendNoPhotoReminder,
  sendInactiveProfileReminder,
  sendVideocallConfigReminder,
} from "./lib/notificationEmail";

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

/* ─── Professionals registered 5+ hours ago without photos ─── */

async function tickNoPhotoReminder() {
  const now = new Date();
  const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);

  // Find professionals created between 5-6 hours ago without avatar/cover and no gallery media
  const professionals = await prisma.user.findMany({
    where: {
      profileType: "PROFESSIONAL",
      createdAt: { gte: sixHoursAgo, lte: fiveHoursAgo },
      avatarUrl: null,
      coverUrl: null,
    },
    select: { id: true, email: true, displayName: true },
  });

  for (const p of professionals) {
    // Check if they have any gallery media
    const mediaCount = await prisma.profileMedia.count({
      where: { ownerId: p.id, type: "IMAGE" },
    });
    if (mediaCount === 0) {
      console.log(`[worker] sending no-photo reminder to ${p.email}`);
      await sendNoPhotoReminder(p.email, p.displayName);
    }
  }
}

/* ─── Inactive profiles (48h+ without login or without photos) ─── */

async function tickInactiveReminder() {
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const fiftyHoursAgo = new Date(now.getTime() - 50 * 60 * 60 * 1000);

  // Find professionals whose lastSeen is between 48-50 hours ago (to avoid repeat emails)
  const inactive = await prisma.user.findMany({
    where: {
      profileType: "PROFESSIONAL",
      OR: [
        // Hasn't logged in for 48h
        { lastSeen: { gte: fiftyHoursAgo, lte: fortyEightHoursAgo } },
        // Never logged in and was created 48-50h ago
        { lastSeen: null, createdAt: { gte: fiftyHoursAgo, lte: fortyEightHoursAgo } },
      ],
    },
    select: { id: true, email: true, displayName: true, avatarUrl: true },
  });

  for (const p of inactive) {
    console.log(`[worker] sending inactive reminder to ${p.email}`);
    await sendInactiveProfileReminder(p.email, p.displayName);
  }
}

/* ─── Videocall service added but config not set up ─── */

async function tickVideocallConfigReminder() {
  // Find professionals who have "videollamada" in their service tags
  // but don't have a VideocallConfig record
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
    const hasConfig = await prisma.videocallConfig.findUnique({
      where: { professionalId: p.id },
    });
    if (!hasConfig) {
      console.log(`[worker] sending videocall config reminder to ${p.email}`);
      await sendVideocallConfigReminder(p.email, p.displayName);
    }
  }
}

/* ─── Main tick: runs all scheduled checks ─── */

async function tick() {
  await tickMembershipExpiry();
  await tickNoPhotoReminder();
  await tickInactiveReminder();
  await tickVideocallConfigReminder();
}

async function main() {
  console.log("[worker] started");

  // Run every hour to catch 5h/48h thresholds
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

import "dotenv/config";
import cron from "node-cron";
import { prisma } from "./db";
import { sendExpiryEmail, smtpEnabled } from "./worker/email";
import { getFlowSubscription } from "./khipu/client";
import { config } from "./config";
import {
  sendNoPhotoReminder,
  sendInactiveProfileReminder,
  sendVideocallConfigReminder,
  sendReferralCampaignEmail,
} from "./lib/notificationEmail";
import { sendInAppAndPush } from "./lib/sendReminder";
import { randomBytes } from "crypto";
import { calculateReferralPayout } from "./referral/payout";
import { validatePendingRedemptions } from "./referral/redeem";

function cryptoSuffix(len: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(len);
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/* ─── Mutex: prevent concurrent ticks ─── */

let tickRunning = false;

/* ─── Anti-spam: DB-backed deduplication ─── */

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

/* ─── Safe send: wraps email + push, always marks as sent ─── */

async function safeSend(
  userId: string,
  reminderType: string,
  label: string,
  emailFn: () => Promise<void>,
  pushOpts: { type: string; title: string; body: string; url: string },
) {
  // Double-check right before sending (DB is the source of truth)
  if (await wasReminderSent(userId, reminderType)) return;

  // Mark FIRST to prevent duplicates from concurrent/crashed ticks
  await markReminderSent(userId, reminderType);

  try {
    await Promise.allSettled([
      emailFn(),
      sendInAppAndPush(userId, pushOpts),
    ]);
    console.log(`[worker] ${label} sent`);
  } catch (err) {
    console.error(`[worker] ${label} failed`, err);
    // Already marked — won't retry. Better 0 emails than infinite retries.
  }
}

/* ─── 1. Membership expiry (3 days before) ─── */
/* Uses type key with month+year so renewals get a fresh reminder */

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
    take: 200,
  });

  for (const u of soon) {
    // Include expiry month in type key so renewals get a new reminder
    const expiryKey = `membership_expiry_${u.membershipExpiresAt!.toISOString().slice(0, 7)}`;
    if (await wasReminderSent(u.id, expiryKey)) continue;

    await markReminderSent(u.id, expiryKey);
    try {
      await sendExpiryEmail(u.email, u.membershipExpiresAt!);
      console.log(`[worker] membership expiry sent to ${u.email}`);
    } catch (err) {
      console.error(`[worker] membership expiry failed for ${u.email}`, err);
    }
  }
}

/* ─── 2. No photos (5h–7 days after registration) ─── */
/* Only nudge recent signups, not people from months ago */

async function tickNoPhotoReminder() {
  const now = new Date();
  const fiveHoursAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const professionals = await prisma.user.findMany({
    where: {
      profileType: "PROFESSIONAL",
      isActive: true,
      createdAt: { gte: sevenDaysAgo, lte: fiveHoursAgo },
      avatarUrl: null,
      coverUrl: null,
    },
    select: { id: true, email: true, displayName: true },
    take: 100,
  });

  for (const p of professionals) {
    if (await wasReminderSent(p.id, "no_photo")) continue;

    // Also check gallery media
    const mediaCount = await prisma.profileMedia.count({
      where: { ownerId: p.id, type: "IMAGE" },
    });
    if (mediaCount > 0) {
      // Has gallery photos — mark as sent so we never check again
      await markReminderSent(p.id, "no_photo");
      continue;
    }

    await safeSend(
      p.id,
      "no_photo",
      `no-photo reminder to ${p.email}`,
      () => sendNoPhotoReminder(p.email, p.displayName),
      {
        type: "REMINDER_NO_PHOTO",
        title: "¡Sube tu primera foto!",
        body: "Los perfiles con fotos reciben hasta 10x más visitas. Sube tu primera foto ahora.",
        url: "/dashboard/services",
      },
    );
  }
}

/* ─── 3. Inactive profiles (48h–30 days without login) ─── */
/* Only nudge recent inactivity, not abandoned accounts */

async function tickInactiveReminder() {
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const inactive = await prisma.user.findMany({
    where: {
      profileType: "PROFESSIONAL",
      isActive: true,
      OR: [
        { lastSeen: { gte: thirtyDaysAgo, lt: fortyEightHoursAgo } },
        { lastSeen: null, createdAt: { gte: thirtyDaysAgo, lt: fortyEightHoursAgo } },
      ],
    },
    select: { id: true, email: true, displayName: true },
    take: 100,
  });

  for (const p of inactive) {
    if (await wasReminderSent(p.id, "inactive_48h")) continue;

    await safeSend(
      p.id,
      "inactive_48h",
      `inactive reminder to ${p.email}`,
      () => sendInactiveProfileReminder(p.email, p.displayName),
      {
        type: "REMINDER_INACTIVE",
        title: "Te extrañamos en UZEED",
        body: "Hace más de 48h que no ingresas. Tus clientes te están buscando.",
        url: "/",
      },
    );
  }
}

/* ─── 4. Videocall tag but not configured ─── */

async function tickVideocallConfigReminder() {
  const professionals = await prisma.user.findMany({
    where: {
      profileType: "PROFESSIONAL",
      isActive: true,
      OR: [
        { serviceTags: { hasSome: ["videollamada", "videollamadas", "Videollamada", "Videollamadas"] } },
        { profileTags: { hasSome: ["videollamada", "videollamadas", "Videollamada", "Videollamadas"] } },
      ],
    },
    select: { id: true, email: true, displayName: true },
    take: 100,
  });

  for (const p of professionals) {
    if (await wasReminderSent(p.id, "videocall_config")) continue;

    const vcConfig = await prisma.videocallConfig.findUnique({
      where: { professionalId: p.id },
    });

    const isConfigured =
      vcConfig &&
      vcConfig.pricePerMinute > 0 &&
      vcConfig.isActive &&
      Array.isArray(vcConfig.availableSlots) &&
      (vcConfig.availableSlots as unknown[]).length > 0;

    if (isConfigured) {
      // Already configured — mark so we never check again
      await markReminderSent(p.id, "videocall_config");
      continue;
    }

    await safeSend(
      p.id,
      "videocall_config",
      `videocall config reminder to ${p.email}`,
      () => sendVideocallConfigReminder(p.email, p.displayName),
      {
        type: "REMINDER_VIDEOCALL_CONFIG",
        title: "Configura tus videollamadas",
        body: "Agregaste videollamadas pero no configuraste horarios ni precios.",
        url: "/videocall",
      },
    );
  }
}

/* ─── 5. Expire stale PENDING payment intents ─── */
/* Flow payments that were never completed (user abandoned checkout) */

async function tickExpireStalePendingIntents() {
  const now = new Date();
  // Expire PENDING Flow payment intents older than 2 hours
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const expired = await prisma.paymentIntent.updateMany({
    where: {
      status: "PENDING",
      method: "FLOW",
      createdAt: { lt: twoHoursAgo },
    },
    data: { status: "EXPIRED" },
  });

  if (expired.count > 0) {
    console.log(`[worker] expired ${expired.count} stale PENDING payment intents`);
  }
}

/**
 * Catch missed PAC webhooks: for users with active Flow subscriptions
 * whose membership is about to expire or already expired, verify with
 * Flow and extend if the subscription is still alive.
 */
async function tickSyncPacSubscriptions() {
  const now = new Date();
  // Check users whose membership expires within 2 days or already expired (up to 7 days ago)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);

  const users = await prisma.user.findMany({
    where: {
      flowSubscriptionId: { not: null },
      membershipExpiresAt: { gte: sevenDaysAgo, lte: twoDaysFromNow },
    },
    select: { id: true, flowSubscriptionId: true, membershipExpiresAt: true },
    take: 50,
  });

  if (users.length === 0) return;

  for (const user of users) {
    try {
      const flowSub = await getFlowSubscription(user.flowSubscriptionId!);
      const statusNum = Number(flowSub.status);
      // If subscription is alive (not canceled/completed) and membership already expired or about to
      if (statusNum !== 3 && statusNum !== 4 && user.membershipExpiresAt && user.membershipExpiresAt.getTime() < now.getTime()) {
        // Membership expired but PAC is alive — webhook was missed, extend now
        const base = now;
        const expiresAt = new Date(base.getTime() + config.membershipDays * 24 * 60 * 60 * 1000);
        await prisma.user.update({
          where: { id: user.id },
          data: { membershipExpiresAt: expiresAt },
        });
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: "SUBSCRIPTION_RENEWED",
            data: { source: "pac_sync_worker", previousExpiry: user.membershipExpiresAt.toISOString() },
          },
        });
        console.log("[worker] PAC sync: extended membership (missed webhook)", { userId: user.id, newExpiry: expiresAt.toISOString() });
      }
    } catch (err: any) {
      console.error("[worker] PAC sync failed for user", { userId: user.id, error: err?.message });
    }
  }
}

/* ─── 6. Auto-send referral campaign email 2h after creator registration ─── */

async function tickReferralWelcomeEmail() {
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  // Fetch creators/professionals registered 2h+ ago who haven't received the email.
  // No date floor: covers both new and existing users. The ReminderLog
  // ("referral_welcome_2h") persists in DB so redeploys never re-send.
  // Processes 50 per tick to spread the load across hours.
  const creators = await prisma.user.findMany({
    where: {
      profileType: { in: ["CREATOR", "PROFESSIONAL"] },
      isActive: true,
      email: { not: "" },
      createdAt: { lte: twoHoursAgo },
    },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      creatorReferralCode: { select: { code: true } },
    },
    take: 50,
  });

  for (const user of creators) {
    if (await wasReminderSent(user.id, "referral_welcome_2h")) continue;

    // Auto-generate referral code if needed
    let code = user.creatorReferralCode?.code;
    if (!code) {
      const clean = (user.username || "REF")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .slice(0, 4);
      code = `${clean}${cryptoSuffix(4)}`;

      // Ensure uniqueness
      let attempts = 0;
      while (attempts < 10) {
        const existing = await prisma.creatorReferralCode.findUnique({ where: { code } });
        if (!existing) break;
        code = `${clean}${cryptoSuffix(5)}`;
        attempts++;
      }

      const refCode = await prisma.creatorReferralCode.create({
        data: { creatorId: user.id, code },
      });

      // Create initial cycle
      await prisma.referralCycle.create({
        data: {
          referralCodeId: refCode.id,
          cycleStart: now,
          cycleEnd: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
          status: "ACTIVE",
        },
      });
    }

    await safeSend(
      user.id,
      "referral_welcome_2h",
      `referral welcome to ${user.email}`,
      () => sendReferralCampaignEmail(user.email, {
        displayName: user.displayName,
        referralCode: code!,
      }),
      {
        type: "REFERRAL_WELCOME" as any,
        title: "Gana dinero invitando creadoras",
        body: `Tu codigo de referido es ${code}. Gana hasta $650.000 por ciclo.`,
        url: "/dashboard/referidos",
      },
    );
  }
}

/* ─── 7. Validate pending referral redemptions ─── */

async function tickReferralValidation() {
  const count = await validatePendingRedemptions();
  if (count > 0) {
    console.log(`[worker/referral] validated ${count} pending redemptions`);
  }
}

/* ─── 7. Referral cycle expiry (20-day cycles) ─── */

async function tickReferralCycles() {
  const now = new Date();

  // Find ACTIVE cycles whose cycleEnd has passed
  const expiredCycles = await prisma.referralCycle.findMany({
    where: {
      status: "ACTIVE",
      cycleEnd: { lt: now },
    },
    include: {
      referralCode: {
        select: { id: true, creatorId: true },
      },
    },
    take: 100,
  });

  for (const cycle of expiredCycles) {
    // Count only VALIDATED redemptions for this cycle
    const referralCount = await prisma.referralRedemption.count({
      where: { cycleId: cycle.id, status: "VALIDATED" },
    });

    const payout = calculateReferralPayout(referralCount);

    if (payout.qualifies) {
      // Mark as PENDING_PAYMENT with calculated amounts
      await prisma.referralCycle.update({
        where: { id: cycle.id },
        data: {
          status: "PENDING_PAYMENT",
          totalReferrals: referralCount,
          baseAmount: payout.baseAmount,
          bonusAmount: payout.bonusAmount,
          totalAmount: payout.totalAmount,
        },
      });

      console.log(
        `[worker/referral] cycle ${cycle.id} → PENDING_PAYMENT: ${referralCount} referrals, $${payout.totalAmount} CLP`,
      );
    } else {
      // Did not meet minimum — mark as EXPIRED
      await prisma.referralCycle.update({
        where: { id: cycle.id },
        data: {
          status: "EXPIRED",
          totalReferrals: referralCount,
          baseAmount: 0,
          bonusAmount: 0,
          totalAmount: 0,
        },
      });

      console.log(
        `[worker/referral] cycle ${cycle.id} → EXPIRED: only ${referralCount} referrals (min 10)`,
      );
    }

    // Create a new ACTIVE cycle for the creator (day 21 = fresh start)
    const newCycleEnd = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);
    await prisma.referralCycle.create({
      data: {
        referralCodeId: cycle.referralCode.id,
        cycleStart: now,
        cycleEnd: newCycleEnd,
        status: "ACTIVE",
      },
    });
  }

  if (expiredCycles.length > 0) {
    console.log(`[worker/referral] processed ${expiredCycles.length} expired cycles`);
  }
}

/* ─── Main tick: runs all checks independently ─── */

async function tick() {
  if (tickRunning) {
    console.log("[worker] tick already running, skipping");
    return;
  }
  tickRunning = true;
  console.log("[worker] tick started at", new Date().toISOString());

  // Each task runs independently — one failure doesn't block others
  const tasks = [
    { name: "membershipExpiry", fn: tickMembershipExpiry },
    { name: "noPhotoReminder", fn: tickNoPhotoReminder },
    { name: "inactiveReminder", fn: tickInactiveReminder },
    { name: "videocallConfig", fn: tickVideocallConfigReminder },
    { name: "expireStalePendingIntents", fn: tickExpireStalePendingIntents },
    { name: "syncPacSubscriptions", fn: tickSyncPacSubscriptions },
    { name: "referralWelcomeEmail", fn: tickReferralWelcomeEmail },
    { name: "referralValidation", fn: tickReferralValidation },
    { name: "referralCycles", fn: tickReferralCycles },
  ];

  for (const task of tasks) {
    try {
      await task.fn();
    } catch (err) {
      console.error(`[worker] ${task.name} failed`, err);
    }
  }

  console.log("[worker] tick completed");
  tickRunning = false;
}

/**
 * Start the worker cron jobs.
 * Can be called from the main API process or run standalone.
 */
export function startWorker() {
  console.log("[worker] started");

  cron.schedule("0 * * * *", () => {
    tick().catch((e) => console.error("[worker] tick error", e));
  });

  // U-Mate: expire subscriptions and move pending→available every hour
  cron.schedule("15 * * * *", () => {
    umateSubscriptionTick().catch((e) => console.error("[worker] umate tick error", e));
  });

  // Run once on startup (delayed 10s to let the API finish booting)
  setTimeout(() => {
    tick().catch((e) => console.error("[worker] initial tick error", e));
  }, 10_000);
}

/* ─── U-Mate subscription expiry & balance release ─── */

async function umateSubscriptionTick() {
  const now = new Date();

  // 1. Expire active subscriptions past their cycleEnd
  const expired = await prisma.umateSubscription.updateMany({
    where: { status: "ACTIVE", cycleEnd: { lt: now } },
    data: { status: "EXPIRED" },
  });
  if (expired.count > 0) {
    console.log(`[worker/umate] expired ${expired.count} subscriptions`);
  }

  // 2. Move pending balance → available for active creators
  // This represents the monthly settlement: funds held in pendingBalance
  // become available once the subscription cycle confirms the subscriber stayed.
  const creatorsWithPending = await prisma.umateCreator.findMany({
    where: { status: "ACTIVE", pendingBalance: { gt: 0 } },
    select: { id: true, pendingBalance: true },
  });

  for (const creator of creatorsWithPending) {
    // Only release if creator has had the pending balance for at least 7 days
    // (safety period for chargebacks/disputes)
    const oldestPendingEntry = await prisma.umateLedgerEntry.findFirst({
      where: {
        creatorId: creator.id,
        type: "SLOT_ACTIVATION",
        createdAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "asc" },
    });

    if (oldestPendingEntry) {
      await prisma.umateCreator.update({
        where: { id: creator.id },
        data: {
          availableBalance: { increment: creator.pendingBalance },
          pendingBalance: 0,
        },
      });
      console.log(`[worker/umate] released $${creator.pendingBalance} CLP for creator ${creator.id}`);
    }
  }

  // 3. Clean up expired creator subscriptions (UmateCreatorSub)
  // and decrement subscriber counts for creators that lost subs
  const expiredCreatorSubs = await prisma.umateCreatorSub.findMany({
    where: { expiresAt: { lt: now } },
    select: { id: true, creatorId: true },
  });

  if (expiredCreatorSubs.length > 0) {
    // Group by creator to batch decrement
    const countByCreator = new Map<string, number>();
    for (const sub of expiredCreatorSubs) {
      countByCreator.set(sub.creatorId, (countByCreator.get(sub.creatorId) || 0) + 1);
    }

    await prisma.umateCreatorSub.deleteMany({
      where: { id: { in: expiredCreatorSubs.map((s) => s.id) } },
    });

    for (const [creatorId, count] of countByCreator) {
      const creator = await prisma.umateCreator.findUnique({ where: { id: creatorId }, select: { subscriberCount: true } });
      if (creator) {
        await prisma.umateCreator.update({
          where: { id: creatorId },
          data: { subscriberCount: Math.max(0, creator.subscriberCount - count) },
        });
      }
    }

    console.log(`[worker/umate] cleaned ${expiredCreatorSubs.length} expired creator subs`);
  }
}

// Allow standalone execution: `node dist/worker.js`
const isMain =
  typeof require !== "undefined" && require.main === module;
if (isMain) {
  startWorker();
}

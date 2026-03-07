import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import { getOrCreateWallet, getCommissionPercent, getNoShowPenalty } from "./wallet";
import { sendToUser, broadcast } from "../realtime/sse";
import { randomUUID } from "node:crypto";

export const videocallRouter = Router();

type AvailabilitySlot = {
  day: number;
  from: string;
  to: string;
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const parseAvailabilitySlots = (raw: unknown): AvailabilitySlot[] => {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((slot) => {
      if (!slot || typeof slot !== "object") return null;
      const maybe = slot as Partial<AvailabilitySlot>;
      const day = Number(maybe.day);
      const from = String(maybe.from || "").trim();
      const to = String(maybe.to || "").trim();
      if (!Number.isInteger(day) || day < 0 || day > 6) return null;
      if (!TIME_RE.test(from) || !TIME_RE.test(to) || from >= to) return null;
      return { day, from, to };
    })
    .filter((slot): slot is AvailabilitySlot => Boolean(slot));
};

const isWithinProfessionalAvailability = (scheduledDate: Date, durationMinutes: number, slots: AvailabilitySlot[]) => {
  if (!slots.length) return true;

  const day = scheduledDate.getDay();
  const startMinutes = scheduledDate.getHours() * 60 + scheduledDate.getMinutes();
  const endMinutes = startMinutes + durationMinutes;

  return slots.some((slot) => {
    if (slot.day !== day) return false;
    const [fromH, fromM] = slot.from.split(":").map(Number);
    const [toH, toM] = slot.to.split(":").map(Number);
    const slotStart = fromH * 60 + fromM;
    const slotEnd = toH * 60 + toM;
    return startMinutes >= slotStart && endMinutes <= slotEnd;
  });
};

// ── GET /videocall/config/:professionalId — get professional's VC config ──
videocallRouter.get("/videocall/config/:professionalId", async (req, res) => {
  const config = await prisma.videocallConfig.findUnique({
    where: { professionalId: req.params.professionalId },
    include: {
      professional: {
        select: { id: true, displayName: true, username: true, avatarUrl: true },
      },
    },
  });
  if (!config || !config.isActive) return res.status(404).json({ error: "Not available" });
  res.json({ config });
});

// ── PUT /videocall/config — professional sets/updates their VC config ──
videocallRouter.put("/videocall/config", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { profileType: true } });
  if (user?.profileType !== "PROFESSIONAL") {
    return res.status(403).json({ error: "Only professionals can configure videocalls" });
  }

  const { pricePerMinute, minDurationMin, maxDurationMin, availableSlots, isActive } = req.body;
  const normalizedSlots = availableSlots === undefined ? undefined : parseAvailabilitySlots(availableSlots);

  const config = await prisma.videocallConfig.upsert({
    where: { professionalId: userId },
    update: {
      ...(pricePerMinute != null && { pricePerMinute: parseInt(String(pricePerMinute), 10) }),
      ...(minDurationMin != null && { minDurationMin: parseInt(String(minDurationMin), 10) }),
      ...(maxDurationMin != null && { maxDurationMin: parseInt(String(maxDurationMin), 10) }),
      ...(normalizedSlots !== undefined && { availableSlots: normalizedSlots }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
    },
    create: {
      professionalId: userId,
      pricePerMinute: parseInt(String(pricePerMinute || "10"), 10),
      minDurationMin: parseInt(String(minDurationMin || "5"), 10),
      maxDurationMin: parseInt(String(maxDurationMin || "60"), 10),
      availableSlots: normalizedSlots || null,
      isActive: isActive !== false,
    },
  });
  res.json({ config });
});

// ── POST /videocall/book — client books a videocall ──
videocallRouter.post("/videocall/book", requireAuth, async (req, res) => {
  const clientId = req.session.userId!;
  const { professionalId, scheduledAt, durationMinutes } = req.body;

  if (!professionalId || !scheduledAt || !durationMinutes) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const duration = parseInt(String(durationMinutes), 10);
  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime())) return res.status(400).json({ error: "Invalid date" });

  // Get professional config
  const config = await prisma.videocallConfig.findUnique({ where: { professionalId } });
  if (!config || !config.isActive) return res.status(400).json({ error: "Videocalls not available" });
  if (duration < config.minDurationMin || duration > config.maxDurationMin) {
    return res.status(400).json({ error: `Duration must be ${config.minDurationMin}-${config.maxDurationMin} min` });
  }

  const availability = parseAvailabilitySlots(config.availableSlots);
  if (!isWithinProfessionalAvailability(scheduledDate, duration, availability)) {
    return res.status(400).json({ error: "Horario fuera de disponibilidad de la profesional" });
  }

  const nearbyBookings = await prisma.videocallBooking.findMany({
    where: {
      professionalId,
      status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] },
      scheduledAt: {
        gte: new Date(scheduledDate.getTime() - config.maxDurationMin * 60 * 1000),
        lte: new Date(scheduledDate.getTime() + config.maxDurationMin * 60 * 1000),
      },
    },
    select: { scheduledAt: true, durationMinutes: true },
  });

  const hasOverlap = nearbyBookings.some((item) => {
    const existingStart = item.scheduledAt.getTime();
    const existingEnd = existingStart + item.durationMinutes * 60 * 1000;
    const requestedStart = scheduledDate.getTime();
    const requestedEnd = requestedStart + duration * 60 * 1000;
    return requestedStart < existingEnd && existingStart < requestedEnd;
  });

  if (hasOverlap) {
    return res.status(400).json({ error: "Ese horario ya está reservado. Elige otro bloque." });
  }

  // Calculate cost
  const totalTokens = config.pricePerMinute * duration;
  const commissionPct = await getCommissionPercent();
  const platformFee = Math.ceil(totalTokens * commissionPct / 100);
  const professionalPay = totalTokens - platformFee;

  // Check client balance
  const clientWallet = await getOrCreateWallet(clientId);
  if (clientWallet.balance < totalTokens) {
    return res.status(400).json({ error: "Insufficient tokens", required: totalTokens, available: clientWallet.balance });
  }

  // Hold tokens from client (move from balance to held)
  const updated = await prisma.wallet.updateMany({
    where: { id: clientWallet.id, balance: { gte: totalTokens } },
    data: { balance: { decrement: totalTokens }, heldBalance: { increment: totalTokens } },
  });
  if (updated.count === 0) return res.status(400).json({ error: "Insufficient tokens" });

  const updatedWallet = await prisma.wallet.findUnique({ where: { id: clientWallet.id } });

  // Create booking
  const roomId = randomUUID();
  const [booking] = await prisma.$transaction([
    prisma.videocallBooking.create({
      data: {
        configId: config.id,
        clientId,
        professionalId,
        scheduledAt: scheduledDate,
        durationMinutes: duration,
        totalTokens,
        platformFee,
        professionalPay,
        roomId,
      },
    }),
    prisma.tokenTransaction.create({
      data: {
        walletId: clientWallet.id,
        type: "VIDEOCALL_HOLD",
        amount: -totalTokens,
        balance: updatedWallet!.balance,
        description: `Reserva videollamada: ${totalTokens} tokens retenidos`,
      },
    }),
  ]);

  // Notify professional via SSE
  sendToUser(professionalId, "videocall:booked", {
    bookingId: booking.id,
    clientId,
    scheduledAt: scheduledDate.toISOString(),
    durationMinutes: duration,
    totalTokens,
  });

  res.json({ booking });
});

// ── GET /videocall/bookings — my bookings (client or professional) ──
videocallRouter.get("/videocall/bookings", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const role = String(req.query.role || "client");

  const where = role === "professional"
    ? { professionalId: userId }
    : { clientId: userId };

  const bookings = await prisma.videocallBooking.findMany({
    where,
    orderBy: { scheduledAt: "desc" },
    take: 30,
    include: {
      client: { select: { id: true, displayName: true, username: true, avatarUrl: true } },
      professional: { select: { id: true, displayName: true, username: true, avatarUrl: true } },
    },
  });
  res.json({ bookings });
});

// ── POST /videocall/:id/start — professional starts the call ──
videocallRouter.post("/videocall/:id/start", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const booking = await prisma.videocallBooking.findUnique({ where: { id: req.params.id } });
  if (!booking) return res.status(404).json({ error: "Not found" });
  if (booking.professionalId !== userId) return res.status(403).json({ error: "Not your booking" });
  if (booking.status !== "CONFIRMED" && booking.status !== "PENDING") {
    return res.status(400).json({ error: "Cannot start this booking" });
  }

  const now = Date.now();
  const startsAt = booking.scheduledAt.getTime();
  const earlyWindow = startsAt - 10 * 60 * 1000;
  const lateWindow = startsAt + 10 * 60 * 1000;
  if (now < earlyWindow || now > lateWindow) {
    return res.status(400).json({ error: "Solo puedes iniciar entre 10 min antes y 10 min después de la hora agendada" });
  }

  await prisma.videocallBooking.update({
    where: { id: booking.id },
    data: { status: "IN_PROGRESS", startedAt: new Date() },
  });

  // Notify client
  sendToUser(booking.clientId, "videocall:started", { bookingId: booking.id, roomId: booking.roomId });

  res.json({ roomId: booking.roomId });
});

// ── POST /videocall/:id/complete — mark call as completed, release tokens ──
videocallRouter.post("/videocall/:id/complete", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const booking = await prisma.videocallBooking.findUnique({ where: { id: req.params.id } });
  if (!booking) return res.status(404).json({ error: "Not found" });
  if (booking.professionalId !== userId && booking.clientId !== userId) {
    return res.status(403).json({ error: "Not your booking" });
  }
  if (booking.status !== "IN_PROGRESS") {
    return res.status(400).json({ error: "Call not in progress" });
  }

  const clientWallet = await getOrCreateWallet(booking.clientId);
  const proWallet = await getOrCreateWallet(booking.professionalId);

  // Release from escrow: deduct from held, credit professional
  await prisma.$transaction([
    prisma.videocallBooking.update({
      where: { id: booking.id },
      data: { status: "COMPLETED", endedAt: new Date() },
    }),
    // Remove from client's held balance
    prisma.wallet.update({
      where: { id: clientWallet.id },
      data: {
        heldBalance: { decrement: booking.totalTokens },
        totalSpent: { increment: booking.totalTokens },
      },
    }),
    // Credit professional (minus commission)
    prisma.wallet.update({
      where: { id: proWallet.id },
      data: {
        balance: { increment: booking.professionalPay },
        totalEarned: { increment: booking.professionalPay },
      },
    }),
    prisma.tokenTransaction.create({
      data: {
        walletId: clientWallet.id,
        type: "VIDEOCALL_RELEASE",
        amount: 0,
        balance: clientWallet.balance,
        referenceId: booking.id,
        description: `Videollamada completada — ${booking.totalTokens} tokens liberados`,
      },
    }),
    prisma.tokenTransaction.create({
      data: {
        walletId: proWallet.id,
        type: "VIDEOCALL_RELEASE",
        amount: booking.professionalPay,
        balance: proWallet.balance + booking.professionalPay,
        referenceId: booking.id,
        description: `Ingreso videollamada: ${booking.professionalPay} tokens (${booking.totalTokens} - ${booking.platformFee} comisión)`,
      },
    }),
  ]);

  sendToUser(booking.clientId, "videocall:completed", { bookingId: booking.id });
  sendToUser(booking.professionalId, "videocall:completed", { bookingId: booking.id });

  res.json({ ok: true });
});

// ── POST /videocall/:id/noshow — professional didn't show up, refund client ──
videocallRouter.post("/videocall/:id/noshow", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const booking = await prisma.videocallBooking.findUnique({ where: { id: req.params.id } });
  if (!booking) return res.status(404).json({ error: "Not found" });
  if (booking.clientId !== userId) return res.status(403).json({ error: "Only client can report no-show" });
  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
    return res.status(400).json({ error: "Cannot report no-show at this stage" });
  }

  // Check if scheduled time has passed (at least 10 min grace)
  const now = new Date();
  const grace = new Date(booking.scheduledAt.getTime() + 10 * 60 * 1000);
  if (now < grace) return res.status(400).json({ error: "Please wait 10 minutes after scheduled time" });

  const clientWallet = await getOrCreateWallet(booking.clientId);
  const proWallet = await getOrCreateWallet(booking.professionalId);
  const penalty = await getNoShowPenalty();

  const txns: any[] = [
    prisma.videocallBooking.update({
      where: { id: booking.id },
      data: { status: "NO_SHOW_PROFESSIONAL", endedAt: new Date() },
    }),
    // Refund client: move from held back to balance
    prisma.wallet.update({
      where: { id: clientWallet.id },
      data: {
        heldBalance: { decrement: booking.totalTokens },
        balance: { increment: booking.totalTokens },
      },
    }),
    prisma.tokenTransaction.create({
      data: {
        walletId: clientWallet.id,
        type: "VIDEOCALL_REFUND",
        amount: booking.totalTokens,
        balance: clientWallet.balance + booking.totalTokens,
        referenceId: booking.id,
        description: `Reembolso por no-show: ${booking.totalTokens} tokens devueltos`,
      },
    }),
  ];

  // Apply penalty to professional if they have balance
  if (penalty > 0 && proWallet.balance >= penalty) {
    txns.push(
      prisma.wallet.update({
        where: { id: proWallet.id },
        data: { balance: { decrement: penalty } },
      }),
      prisma.tokenTransaction.create({
        data: {
          walletId: proWallet.id,
          type: "PENALTY",
          amount: -penalty,
          balance: proWallet.balance - penalty,
          referenceId: booking.id,
          description: `Multa por no-show: -${penalty} tokens`,
        },
      }),
    );
  }

  await prisma.$transaction(txns);

  sendToUser(booking.professionalId, "videocall:noshow", { bookingId: booking.id });

  res.json({ ok: true, refunded: booking.totalTokens, penalty });
});

// ── POST /videocall/:id/cancel — client cancels before the call ──
videocallRouter.post("/videocall/:id/cancel", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const booking = await prisma.videocallBooking.findUnique({ where: { id: req.params.id } });
  if (!booking) return res.status(404).json({ error: "Not found" });
  if (booking.clientId !== userId) return res.status(403).json({ error: "Not your booking" });
  if (booking.status !== "PENDING" && booking.status !== "CONFIRMED") {
    return res.status(400).json({ error: "Cannot cancel at this stage" });
  }

  const clientWallet = await getOrCreateWallet(booking.clientId);

  await prisma.$transaction([
    prisma.videocallBooking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED_CLIENT" },
    }),
    prisma.wallet.update({
      where: { id: clientWallet.id },
      data: {
        heldBalance: { decrement: booking.totalTokens },
        balance: { increment: booking.totalTokens },
      },
    }),
    prisma.tokenTransaction.create({
      data: {
        walletId: clientWallet.id,
        type: "VIDEOCALL_REFUND",
        amount: booking.totalTokens,
        balance: clientWallet.balance + booking.totalTokens,
        referenceId: booking.id,
        description: `Cancelación videollamada: ${booking.totalTokens} tokens devueltos`,
      },
    }),
  ]);

  sendToUser(booking.professionalId, "videocall:cancelled", { bookingId: booking.id });

  res.json({ ok: true });
});

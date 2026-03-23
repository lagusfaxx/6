import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../lib/auth";
import { getOrCreateWallet, getCommissionPercent, getNoShowPenalty } from "./wallet";
import { sendToUser, broadcast } from "../realtime/sse";
import { sendVideocallBookingConfirmation } from "../lib/notificationEmail";
import { randomUUID } from "node:crypto";

export const videocallRouter = Router();

type AvailabilitySlot = {
  day: number;
  from: string;
  to: string;
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const CL_TIMEZONE = "America/Santiago";

const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const getChileDayAndMinutes = (date: Date): { day: number; minutes: number } => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CL_TIMEZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const day = WEEKDAY_TO_INDEX[weekday] ?? 0;

  return { day, minutes: hour * 60 + minute };
};

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

  const { day, minutes: startMinutes } = getChileDayAndMinutes(scheduledDate);
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

// ── GET /videocall/professionals — list professionals with active videocall configs ──
videocallRouter.get("/videocall/professionals", async (_req, res) => {
  const configs = await prisma.videocallConfig.findMany({
    where: { isActive: true },
    include: {
      professional: {
        select: {
          id: true,
          displayName: true,
          username: true,
          avatarUrl: true,
          coverUrl: true,
          profileType: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const professionals = configs.map((c) => ({
    id: c.professional.id,
    displayName: c.professional.displayName,
    username: c.professional.username,
    avatarUrl: c.professional.avatarUrl,
    coverUrl: (c.professional as any).coverUrl || null,
    pricePerMinute: c.pricePerMinute,
    minDurationMin: c.minDurationMin,
    maxDurationMin: c.maxDurationMin,
    availableSlots: c.availableSlots,
  }));

  res.json({ professionals });
});

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

// ── GET /videocall/booked-slots/:professionalId — existing bookings for slot display ──
videocallRouter.get("/videocall/booked-slots/:professionalId", async (req, res) => {
  const now = new Date();
  const bookings = await prisma.videocallBooking.findMany({
    where: {
      professionalId: req.params.professionalId,
      status: { in: ["PENDING", "CONFIRMED", "IN_PROGRESS"] },
      scheduledAt: { gte: now },
    },
    select: { scheduledAt: true, durationMinutes: true },
    orderBy: { scheduledAt: "asc" },
  });

  const bookedSlots = bookings.map((b) => ({
    start: b.scheduledAt.toISOString(),
    durationMinutes: b.durationMinutes,
  }));

  res.json({ bookedSlots });
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
    return res.status(400).json({
      error: "Horario fuera de disponibilidad de la profesional",
      timezone: CL_TIMEZONE,
    });
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
  if (!updatedWallet) return res.status(500).json({ error: "Wallet not found after update" });

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

  // Send confirmation email to professional
  const [professional, client] = await Promise.all([
    prisma.user.findUnique({ where: { id: professionalId }, select: { email: true, displayName: true } }),
    prisma.user.findUnique({ where: { id: clientId }, select: { displayName: true } }),
  ]);
  if (professional && client) {
    sendVideocallBookingConfirmation(professional.email, {
      professionalName: professional.displayName,
      clientName: client.displayName,
      scheduledAt: scheduledDate,
      durationMinutes: duration,
      totalTokens,
    }).catch((err) => console.error("[videocall] email failed", err));
  }

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
  const earlyWindow = startsAt - 5 * 60 * 1000;
  const lateWindow = startsAt + 10 * 60 * 1000;
  if (now < earlyWindow || now > lateWindow) {
    return res.status(400).json({ error: "La sala se abre 5 minutos antes de la hora agendada" });
  }

  await prisma.videocallBooking.update({
    where: { id: booking.id },
    data: { status: "IN_PROGRESS", startedAt: new Date() },
  });

  // Notify client
  sendToUser(booking.clientId, "videocall:started", { bookingId: booking.id, roomId: booking.roomId });

  res.json({ roomId: booking.roomId });
});

// ── POST /videocall/:id/join — track that a user joined the room ──
videocallRouter.post("/videocall/:id/join", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const booking = await prisma.videocallBooking.findUnique({ where: { id: req.params.id } });
  if (!booking) return res.status(404).json({ error: "Not found" });
  if (booking.clientId !== userId && booking.professionalId !== userId) {
    return res.status(403).json({ error: "Not your booking" });
  }

  const isClient = booking.clientId === userId;
  const now = new Date();

  // Check room is open (5 min before scheduled time)
  const startsAt = booking.scheduledAt.getTime();
  const earlyWindow = startsAt - 5 * 60 * 1000;
  if (Date.now() < earlyWindow) {
    return res.status(400).json({ error: "La sala aún no está disponible" });
  }

  const updateData = isClient
    ? { clientJoinedAt: booking.clientJoinedAt || now }
    : { professionalJoinedAt: booking.professionalJoinedAt || now };

  await prisma.videocallBooking.update({
    where: { id: booking.id },
    data: updateData,
  });

  // Notify the other party
  const otherUserId = isClient ? booking.professionalId : booking.clientId;
  sendToUser(otherUserId, "videocall:user_joined", {
    bookingId: booking.id,
    role: isClient ? "client" : "professional",
  });

  res.json({ ok: true });
});


// ── POST /videocall/:id/chat — send chat message during videocall ──
videocallRouter.post("/videocall/:id/chat", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const booking = await prisma.videocallBooking.findUnique({
    where: { id: req.params.id },
    include: {
      client: { select: { id: true, username: true, displayName: true } },
      professional: { select: { id: true, username: true, displayName: true } },
    },
  });

  if (!booking) return res.status(404).json({ error: "Not found" });
  if (booking.clientId !== userId && booking.professionalId !== userId) {
    return res.status(403).json({ error: "Not your booking" });
  }
  if (!["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(booking.status)) {
    return res.status(400).json({ error: "La videollamada no está disponible para chat" });
  }

  const message = String(req.body?.message || "").trim();
  if (!message) return res.status(400).json({ error: "Mensaje vacío" });
  if (message.length > 500) return res.status(400).json({ error: "Mensaje demasiado largo (máximo 500 caracteres)" });

  const sender = userId === booking.clientId ? booking.client : booking.professional;
  const payload = {
    bookingId: booking.id,
    fromUserId: userId,
    senderName: sender.displayName || sender.username,
    message,
    createdAt: new Date().toISOString(),
  };

  sendToUser(booking.clientId, "videocall:chat", payload);
  sendToUser(booking.professionalId, "videocall:chat", payload);

  res.json({ ok: true });
});

// ── POST /videocall/:id/complete — mark call as completed, handle token logic ──
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
  const bothJoined = Boolean(booking.clientJoinedAt && booking.professionalJoinedAt);

  if (bothJoined) {
    // Both users joined — release tokens to the professional
    await prisma.$transaction([
      prisma.videocallBooking.update({
        where: { id: booking.id },
        data: { status: "COMPLETED", endedAt: new Date() },
      }),
      prisma.wallet.update({
        where: { id: clientWallet.id },
        data: {
          heldBalance: { decrement: booking.totalTokens },
          totalSpent: { increment: booking.totalTokens },
        },
      }),
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
  } else if (!booking.clientJoinedAt) {
    // Client never joined — refund 100% to client
    await prisma.$transaction([
      prisma.videocallBooking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED_CLIENT", endedAt: new Date() },
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
          description: `Reembolso: cliente no ingresó a la videollamada — ${booking.totalTokens} tokens devueltos`,
        },
      }),
    ]);
  } else if (!booking.professionalJoinedAt) {
    // Professional never joined — refund 100% to client
    await prisma.$transaction([
      prisma.videocallBooking.update({
        where: { id: booking.id },
        data: { status: "NO_SHOW_PROFESSIONAL", endedAt: new Date() },
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
          description: `Reembolso: profesional no ingresó — ${booking.totalTokens} tokens devueltos`,
        },
      }),
    ]);
  }

  sendToUser(booking.clientId, "videocall:completed", { bookingId: booking.id });
  sendToUser(booking.professionalId, "videocall:completed", { bookingId: booking.id });

  res.json({ ok: true, bothJoined });
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

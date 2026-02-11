import { randomUUID } from "node:crypto";
import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { sendToUser } from "../realtime/sse";

export const motelRouter = Router();

let schemaReady = false;
async function ensureMotelSchema() {
  if (schemaReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "MotelBooking" (
      "id" UUID PRIMARY KEY,
      "establishmentId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "roomId" UUID NULL REFERENCES "MotelRoom"("id") ON DELETE SET NULL,
      "clientId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "status" TEXT NOT NULL DEFAULT 'PENDIENTE',
      "durationType" TEXT NOT NULL,
      "priceClp" INTEGER NOT NULL,
      "startAt" TIMESTAMP NULL,
      "note" TEXT NULL,
      "rejectReason" TEXT NULL,
      "rejectNote" TEXT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MotelBooking_establishmentId_idx" ON "MotelBooking" ("establishmentId")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MotelBooking_clientId_idx" ON "MotelBooking" ("clientId")`);

  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelRoom" ADD COLUMN IF NOT EXISTS "roomType" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelRoom" ADD COLUMN IF NOT EXISTS "price3h" INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelRoom" ADD COLUMN IF NOT EXISTS "price6h" INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelRoom" ADD COLUMN IF NOT EXISTS "priceNight" INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelRoom" ADD COLUMN IF NOT EXISTS "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[]`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelRoom" ADD COLUMN IF NOT EXISTS "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[]`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelRoom" ADD COLUMN IF NOT EXISTS "location" TEXT`);

  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelPromotion" ADD COLUMN IF NOT EXISTS "discountClp" INTEGER`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelPromotion" ADD COLUMN IF NOT EXISTS "roomId" UUID`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelPromotion" ADD COLUMN IF NOT EXISTS "roomIds" UUID[] DEFAULT ARRAY[]::UUID[]`);

  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelBooking" ADD COLUMN IF NOT EXISTS "rejectReason" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "MotelBooking" ADD COLUMN IF NOT EXISTS "rejectNote" TEXT`);

  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "addressLastChangedAt" TIMESTAMP`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isPublished" BOOLEAN NOT NULL DEFAULT true`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isOpen" BOOLEAN NOT NULL DEFAULT true`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "operationalStatusUpdatedAt" TIMESTAMP`);

  schemaReady = true;
}


function isMotelOwner(user: any) {
  if (!user) return false;
  const role = String(user.role || "").toUpperCase();
  const profileType = String(user.profileType || "").toUpperCase();
  return profileType === "ESTABLISHMENT" || role === "MOTEL" || role === "MOTEL_OWNER";
}


async function sendBookingMessage(fromId: string, toId: string, text: string) {
  const body = String(text || "").trim();
  if (!body) return;
  const message = await prisma.message.create({ data: { fromId, toId, body } });
  await prisma.notification.create({
    data: {
      userId: toId,
      type: "MESSAGE_RECEIVED",
      data: { fromId, messageId: message.id }
    }
  });
  sendToUser(toId, "message", { message });
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function motelRoomDelegate() {
  return (prisma as any).motelRoom as any;
}

function motelPromotionDelegate() {
  return (prisma as any).motelPromotion as any;
}

async function listRooms(establishmentId: string, onlyActive = false) {
  const delegate = motelRoomDelegate();
  if (delegate?.findMany) {
    return delegate.findMany({
      where: { establishmentId, ...(onlyActive ? { isActive: true } : {}) },
      orderBy: { createdAt: "desc" }
    });
  }

  return prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "MotelRoom" WHERE "establishmentId" = $1::uuid ${onlyActive ? 'AND "isActive" = true' : ""} ORDER BY "createdAt" DESC`,
    establishmentId
  );
}

async function listPromotions(establishmentId: string, onlyActive = false) {
  await prisma.$executeRawUnsafe(
    `UPDATE "MotelPromotion" SET "isActive" = false, "updatedAt" = NOW() WHERE "establishmentId" = $1::uuid AND "isActive" = true AND "endsAt" IS NOT NULL AND "endsAt" < NOW()`,
    establishmentId
  );

  const delegate = motelPromotionDelegate();
  if (delegate?.findMany) {
    return delegate.findMany({
      where: { establishmentId, ...(onlyActive ? { isActive: true } : {}) },
      orderBy: { createdAt: "desc" }
    });
  }

  return prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "MotelPromotion" WHERE "establishmentId" = $1::uuid ${onlyActive ? 'AND "isActive" = true' : ""} ORDER BY "createdAt" DESC`,
    establishmentId
  );
}

async function findRoomForBooking(establishmentId: string, roomId?: string | null) {
  const delegate = motelRoomDelegate();
  if (delegate?.findFirst) {
    if (roomId) {
      const exact = await delegate.findFirst({ where: { id: roomId, establishmentId, isActive: true } });
      if (exact) return exact;
    }
    return delegate.findFirst({ where: { establishmentId, isActive: true }, orderBy: { createdAt: "asc" } });
  }

  if (roomId) {
    const exact = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "MotelRoom" WHERE id = $1::uuid AND "establishmentId" = $2::uuid AND "isActive" = true LIMIT 1`,
      roomId,
      establishmentId
    );
    if (exact[0]) return exact[0];
  }

  const fallback = await prisma.$queryRawUnsafe<any[]>(
    `SELECT * FROM "MotelRoom" WHERE "establishmentId" = $1::uuid AND "isActive" = true ORDER BY "createdAt" ASC LIMIT 1`,
    establishmentId
  );
  return fallback[0] || null;
}

motelRouter.get("/motels", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const category = String(req.query.category || "").toLowerCase();
  const rangeKm = Math.max(1, Math.min(200, Number(req.query.rangeKm || 20)));
  const priceMax = Number(req.query.priceMax || 0);
  const duration = String(req.query.duration || "3H").toUpperCase();
  const onlyPromos = String(req.query.onlyPromos || "false") === "true";
  const minRating = req.query.minRating ? Number(req.query.minRating) : null;
  const search = String(req.query.search || "").trim().toLowerCase();
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lng = req.query.lng ? Number(req.query.lng) : null;

  const users = await prisma.user.findMany({
    where: { profileType: "ESTABLISHMENT", isActive: true },
    select: {
      id: true, username: true, displayName: true, city: true, address: true,
      latitude: true, longitude: true, coverUrl: true,
      isPublished: true, isOpen: true, operationalStatusUpdatedAt: true,
      category: { select: { slug: true, displayName: true, name: true } },
      media: { where: { type: "IMAGE" }, take: 4, orderBy: { createdAt: "desc" }, select: { url: true } }
    },
    take: 300
  });

  const establishmentIds = users.map((u) => u.id);
  const [roomRows, promoRows] = await Promise.all([
    establishmentIds.length
      ? prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "MotelRoom" WHERE "establishmentId" = ANY($1::uuid[]) AND "isActive" = true`, establishmentIds)
      : Promise.resolve([] as any[]),
    establishmentIds.length
      ? prisma.$queryRawUnsafe<any[]>(`SELECT id, "establishmentId" FROM "MotelPromotion" WHERE "establishmentId" = ANY($1::uuid[]) AND "isActive" = true`, establishmentIds)
      : Promise.resolve([] as any[])
  ]);

  const roomMap = new Map<string, any[]>();
  roomRows.forEach((row) => {
    const list = roomMap.get(row.establishmentId) || [];
    list.push(row);
    roomMap.set(row.establishmentId, list);
  });

  const promoMap = new Map<string, number>();
  promoRows.forEach((row) => {
    promoMap.set(row.establishmentId, (promoMap.get(row.establishmentId) || 0) + 1);
  });

  const reviewRows = await prisma.establishmentReview.groupBy({ by: ["establishmentId"], _avg: { stars: true }, _count: { _all: true } });
  const reviewMap = new Map(reviewRows.map((r) => [r.establishmentId, { rating: r._avg.stars ?? null, reviews: r._count._all }]));

  const toDistance = (aLat: number, aLng: number, bLat: number, bLng: number) => {
    const R = 6371;
    const dLat = ((bLat - aLat) * Math.PI) / 180;
    const dLng = ((bLng - aLng) * Math.PI) / 180;
    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLng / 2);
    const aa = s1 * s1 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * s2 * s2;
    return R * (2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa)));
  };

  const mapped = users.map((u) => {
    const categoryName = `${u.category?.slug || ""} ${u.category?.displayName || ""} ${u.category?.name || ""}`.toLowerCase();
    const isHotel = categoryName.includes("hotel");
    const distance = lat != null && lng != null && u.latitude != null && u.longitude != null ? toDistance(lat, lng, u.latitude, u.longitude) : null;
    const motelRooms = roomMap.get(u.id) || [];
    const motelPromotionsCount = promoMap.get(u.id) || 0;
    const firstRoom = motelRooms[0] as any;
    const fromPrice = duration === "6H" ? Number(firstRoom?.price6h || firstRoom?.price || 0) : duration === "NIGHT" ? Number(firstRoom?.priceNight || firstRoom?.price || 0) : Number(firstRoom?.price3h || firstRoom?.price || 0);

    const tags = new Set<string>();
    motelRooms.forEach((r: any) => {
      (r.amenities || []).forEach((a: string) => tags.add(a));
      if ((r.roomType || "").toLowerCase().includes("jacuzzi")) tags.add("Jacuzzi");
    });
    if (motelPromotionsCount > 0) tags.add("Promo");

    return {
      id: u.id,
      name: u.displayName || u.username,
      address: u.address,
      city: u.city,
      latitude: u.latitude,
      longitude: u.longitude,
      distance,
      rating: reviewMap.get(u.id)?.rating ? Number((reviewMap.get(u.id)?.rating || 0).toFixed(2)) : null,
      reviewsCount: reviewMap.get(u.id)?.reviews || 0,
      fromPrice,
      coverUrl: u.coverUrl || u.media[0]?.url || null,
      tags: Array.from(tags).slice(0, 5),
      hasPromo: motelPromotionsCount > 0,
      category: isHotel ? "HOTEL" : "MOTEL",
      isOpen: Boolean((u as any).isOpen ?? true),
      operationalStatusUpdatedAt: (u as any).operationalStatusUpdatedAt || null,
      isPublished: Boolean((u as any).isPublished ?? true)
    };
  })
  .filter((u) => (category === "hotel" ? u.category === "HOTEL" : category === "motel" ? u.category === "MOTEL" : true))
  .filter((u) => (search ? `${u.city} ${u.address} ${u.name}`.toLowerCase().includes(search) : true))
  .filter((u) => u.isPublished)
  .filter((u) => u.latitude != null && u.longitude != null)
  .filter((u) => Number(u.fromPrice || 0) > 0)
  .filter((u) => (u.distance != null ? u.distance <= rangeKm : true))
  .filter((u) => (onlyPromos ? u.hasPromo : true))
  .filter((u) => (priceMax ? u.fromPrice <= priceMax : true))
  .filter((u) => (minRating != null ? (u.rating || 0) >= minRating : true))
  .sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));

  return res.json({ establishments: mapped });
}));

motelRouter.get("/motels/:id", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const id = String(req.params.id);
  const u = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, username: true, displayName: true, address: true, city: true, phone: true,
      bio: true, serviceDescription: true, coverUrl: true, avatarUrl: true, latitude: true, longitude: true, isOpen: true, operationalStatusUpdatedAt: true,
      media: { where: { type: "IMAGE" }, take: 16, orderBy: { createdAt: "desc" }, select: { url: true } }
    }
  });
  if (!u) return res.status(404).json({ error: "NOT_FOUND" });

  const [rooms, promotions] = await Promise.all([
    listRooms(id, true),
    listPromotions(id, true)
  ]);

  const reviews = await prisma.establishmentReview.groupBy({ by: ["establishmentId"], where: { establishmentId: id }, _avg: { stars: true }, _count: { _all: true } });
  const rating = reviews[0]?._avg.stars ? Number((reviews[0]._avg.stars || 0).toFixed(2)) : null;

  return res.json({ establishment: { id: u.id, name: u.displayName || u.username, address: u.address, city: u.city, phone: u.phone, rules: u.bio, schedule: u.serviceDescription, coverUrl: u.coverUrl, avatarUrl: u.avatarUrl, latitude: u.latitude, longitude: u.longitude, isOpen: Boolean((u as any).isOpen ?? true), operationalStatusUpdatedAt: (u as any).operationalStatusUpdatedAt || null, rating, reviewsCount: reviews[0]?._count._all || 0, gallery: u.media.map((m) => m.url), rooms, promotions } });
}));

motelRouter.post("/motels/:id/bookings", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const clientId = req.session.userId;
  if (!clientId) return res.status(401).json({ error: "UNAUTHENTICATED" });

  const establishmentId = String(req.params.id);
  const roomId = req.body?.roomId ? String(req.body.roomId) : null;
  const durationType = String(req.body?.durationType || "3H").toUpperCase();
  const startAt = req.body?.startAt ? new Date(req.body.startAt) : null;
  const note = req.body?.note ? String(req.body.note).slice(0, 500) : null;

  const fallbackRoom = await findRoomForBooking(establishmentId, roomId);
  if (!fallbackRoom) return res.status(400).json({ error: "NO_ROOMS" });

  const fallbackAny = fallbackRoom as any;
  const priceClp = durationType === "6H" ? Number(fallbackAny.price6h || fallbackRoom.price) : durationType === "NIGHT" ? Number(fallbackAny.priceNight || fallbackRoom.price) : Number(fallbackAny.price3h || fallbackRoom.price);

  const bookingId = randomUUID();
  const rows = await prisma.$queryRawUnsafe<any[]>(`INSERT INTO "MotelBooking" ("id", "establishmentId", "roomId", "clientId", "status", "durationType", "priceClp", "startAt", "note") VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'PENDIENTE', $5, $6, $7, $8) RETURNING *`, bookingId, establishmentId, fallbackRoom.id, clientId, durationType, priceClp, startAt, note);
  const booking = rows[0];
  await prisma.notification.create({ data: { userId: establishmentId, type: "SERVICE_PUBLISHED", title: "Nueva reserva pendiente", body: `Tienes una solicitud ${durationType}` } });
  sendToUser(establishmentId, "booking:new", { bookingId: booking.id });

  const roomName = fallbackRoom.name || "Habitación";
  const startLabel = startAt ? new Date(startAt).toLocaleString("es-CL") : "por confirmar";
  await sendBookingMessage(clientId, establishmentId, `Nueva solicitud de reserva\n• Duración: ${durationType}\n• Habitación: ${roomName}\n• Fecha/Hora: ${startLabel}\n• Monto: $${Number(priceClp || 0).toLocaleString("es-CL")}\n${note ? `• Comentario: ${note}` : ""}`);

  return res.json({ booking });
}));

motelRouter.get("/motel/bookings", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "UNAUTHENTICATED" });
  const isOwner = isMotelOwner((req as any).user);

  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT b.*, u."displayName" as "clientName", u."username" as "clientUsername", r."name" as "roomName" FROM "MotelBooking" b LEFT JOIN "User" u ON u.id = b."clientId" LEFT JOIN "MotelRoom" r ON r.id = b."roomId" WHERE ${isOwner ? 'b."establishmentId" = $1::uuid' : 'b."clientId" = $1::uuid'} ORDER BY b."createdAt" DESC LIMIT 300`, userId);
  return res.json({ bookings: rows });
}));

motelRouter.post("/motel/bookings/:id/action", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const userId = req.session.userId;
  if (!userId) return res.status(401).json({ error: "UNAUTHENTICATED" });
  const user = (req as any).user;
  const id = String(req.params.id);
  const action = String(req.body?.action || "").toUpperCase();

  const rows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "MotelBooking" WHERE id = $1::uuid LIMIT 1`, id);
  const booking = rows[0];
  if (!booking) return res.status(404).json({ error: "NOT_FOUND" });

  const isOwner = isMotelOwner(user) && booking.establishmentId === userId;
  const isClient = booking.clientId === userId;
  const rejectReason = String(req.body?.rejectReason || "").toUpperCase();
  const rejectNote = req.body?.rejectNote != null ? String(req.body.rejectNote).slice(0, 300) : null;

  let nextStatus: string | null = null;
  if (isOwner && action === "ACCEPT" && booking.status === "PENDIENTE") nextStatus = "CONFIRMADA";
  if (isOwner && action === "REJECT" && booking.status === "PENDIENTE") {
    if (!["CERRADO", "SIN_HABITACIONES", "OTRO"].includes(rejectReason)) {
      return res.status(400).json({ error: "REJECT_REASON_REQUIRED" });
    }
    if (rejectReason === "OTRO" && !rejectNote) {
      return res.status(400).json({ error: "REJECT_NOTE_REQUIRED" });
    }
    nextStatus = "RECHAZADA";
  }
  if (isOwner && action === "FINISH" && booking.status === "CONFIRMADA") nextStatus = "FINALIZADA";
  if (isClient && action === "CANCEL" && ["PENDIENTE", "CONFIRMADA"].includes(booking.status)) nextStatus = "CANCELADA_CLIENTE";
  if (!nextStatus) return res.status(400).json({ error: "INVALID_TRANSITION" });

  const updatedRows = await prisma.$queryRawUnsafe<any[]>(
    `UPDATE "MotelBooking"
     SET "status" = $1,
         "rejectReason" = CASE WHEN $1 = 'RECHAZADA' THEN $3 ELSE "rejectReason" END,
         "rejectNote" = CASE WHEN $1 = 'RECHAZADA' THEN $4 ELSE "rejectNote" END,
         "updatedAt" = NOW()
     WHERE id = $2::uuid
     RETURNING *`,
    nextStatus,
    id,
    rejectReason || null,
    rejectNote || null
  );
  const updated = updatedRows[0];
  const notifyUserId = isOwner ? booking.clientId : booking.establishmentId;
  await prisma.notification.create({ data: { userId: notifyUserId, type: "SERVICE_PUBLISHED", title: "Actualización de reserva", body: `Estado: ${nextStatus}` } });
  sendToUser(notifyUserId, "booking:update", { bookingId: updated.id, status: nextStatus, rejectReason: updated.rejectReason, rejectNote: updated.rejectNote });

  if (isOwner && nextStatus === "CONFIRMADA") {
    await sendBookingMessage(booking.establishmentId, booking.clientId, `✅ Reserva confirmada para ${updated.durationType}. Nos vemos en ${updated.startAt ? new Date(updated.startAt).toLocaleString("es-CL") : "horario por confirmar"}.`);
  }
  if (isOwner && nextStatus === "RECHAZADA") {
    const reasonText = rejectReason === "CERRADO" ? "Local cerrado" : rejectReason === "SIN_HABITACIONES" ? "Sin habitaciones" : `Otro motivo: ${rejectNote}`;
    await sendBookingMessage(booking.establishmentId, booking.clientId, `❌ Reserva rechazada. Motivo: ${reasonText}.`);
  }

  return res.json({ booking: updated });
}));

motelRouter.get("/motel/dashboard", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });
  const userId = req.session.userId!;

  const [rooms, promotions, bookings] = await Promise.all([
    listRooms(userId),
    listPromotions(userId),
    prisma.$queryRawUnsafe<any[]>(`SELECT b.*, u."displayName" as "clientName", u."username" as "clientUsername", r."name" as "roomName" FROM "MotelBooking" b LEFT JOIN "User" u ON u.id = b."clientId" LEFT JOIN "MotelRoom" r ON r.id = b."roomId" WHERE b."establishmentId" = $1::uuid ORDER BY b."createdAt" DESC LIMIT 200`, userId)
  ]);

  return res.json({ profile: { id: user.id, displayName: user.displayName, address: user.address, phone: user.phone, city: user.city, latitude: user.latitude, longitude: user.longitude, coverUrl: user.coverUrl, avatarUrl: user.avatarUrl, rules: user.bio, schedule: user.serviceDescription, isOpen: Boolean((user as any).isOpen ?? true), isPublished: Boolean((user as any).isPublished ?? true), operationalStatusUpdatedAt: (user as any).operationalStatusUpdatedAt || null, addressLastChangedAt: (user as any).addressLastChangedAt || null }, rooms, promotions, bookings });
}));

motelRouter.put("/motel/dashboard/profile", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });

  const current = await prisma.user.findUnique({ where: { id: req.session.userId! }, select: { address: true, addressLastChangedAt: true } as any });
  if (!current) return res.status(404).json({ error: "NOT_FOUND" });

  const nextAddress = req.body?.address != null ? String(req.body.address).trim() : undefined;
  const currentAddress = String((current as any).address || "").trim();
  const addressChanged = nextAddress != null && nextAddress && nextAddress !== currentAddress;
  if (addressChanged && (current as any).addressLastChangedAt) {
    const nextAllowedAt = new Date((current as any).addressLastChangedAt);
    nextAllowedAt.setDate(nextAllowedAt.getDate() + 60);
    if (nextAllowedAt.getTime() > Date.now()) {
      return res.status(400).json({ error: "ADDRESS_LOCKED", nextEditAt: nextAllowedAt.toISOString() });
    }
  }

  const updated = await prisma.user.update({
    where: { id: req.session.userId! },
    data: {
      displayName: req.body?.displayName != null ? String(req.body.displayName) : user.displayName,
      address: nextAddress != null ? nextAddress : user.address,
      addressLastChangedAt: addressChanged ? new Date() : (current as any).addressLastChangedAt,
      city: req.body?.city != null ? String(req.body.city) : user.city,
      phone: req.body?.phone != null ? String(req.body.phone) : user.phone,
      latitude: req.body?.latitude != null ? Number(req.body.latitude) : user.latitude,
      longitude: req.body?.longitude != null ? Number(req.body.longitude) : user.longitude,
      coverUrl: req.body?.coverUrl !== undefined ? (req.body.coverUrl ? String(req.body.coverUrl) : null) : user.coverUrl,
      avatarUrl: req.body?.avatarUrl !== undefined ? (req.body.avatarUrl ? String(req.body.avatarUrl) : null) : user.avatarUrl,
      bio: req.body?.rules != null ? String(req.body.rules) : user.bio,
      serviceDescription: req.body?.schedule != null ? String(req.body.schedule) : user.serviceDescription,
      isPublished: req.body?.isPublished != null ? Boolean(req.body.isPublished) : (user as any).isPublished,
      isOpen: req.body?.isOpen != null ? Boolean(req.body.isOpen) : (user as any).isOpen,
      operationalStatusUpdatedAt: req.body?.isOpen != null ? new Date() : (user as any).operationalStatusUpdatedAt
    } as any
  });

  return res.json({ profile: updated });
}));

motelRouter.post("/motel/dashboard/rooms", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });

  const data = {
    establishmentId: req.session.userId!,
    name: String(req.body?.name || "Suite"),
    description: req.body?.description ? String(req.body.description) : null,
    price: Number(req.body?.price3h || req.body?.price || 0),
    roomType: req.body?.roomType ? String(req.body.roomType) : null,
    amenities: parseStringArray(req.body?.amenities),
    photoUrls: parseStringArray(req.body?.photoUrls),
    price3h: Number(req.body?.price3h || 0),
    price6h: Number(req.body?.price6h || 0),
    priceNight: Number(req.body?.priceNight || 0)
    ,location: req.body?.location ? String(req.body.location) : null
  } as any;

  const delegate = motelRoomDelegate();
  if (delegate?.create) {
    const room = await delegate.create({ data });
    return res.json({ room });
  }

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO "MotelRoom" ("id", "establishmentId", "name", "description", "price", "roomType", "amenities", "photoUrls", "price3h", "price6h", "priceNight", "location", "isActive", "createdAt", "updatedAt") VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::text[], $8::text[], $9, $10, $11, $12, true, NOW(), NOW()) RETURNING *`,
    randomUUID(),
    data.establishmentId,
    data.name,
    data.description,
    data.price,
    data.roomType,
    data.amenities,
    data.photoUrls,
    data.price3h,
    data.price6h,
    data.priceNight,
    data.location
  );

  return res.json({ room: rows[0] });
}));

motelRouter.put("/motel/dashboard/rooms/:id", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });

  const data = {
    name: req.body?.name != null ? String(req.body.name) : undefined,
    description: req.body?.description != null ? String(req.body.description) : undefined,
    roomType: req.body?.roomType != null ? String(req.body.roomType) : undefined,
    amenities: req.body?.amenities ? parseStringArray(req.body.amenities) : undefined,
    photoUrls: req.body?.photoUrls ? parseStringArray(req.body.photoUrls) : undefined,
    price: req.body?.price3h != null ? Number(req.body.price3h) : undefined,
    price3h: req.body?.price3h != null ? Number(req.body.price3h) : undefined,
    price6h: req.body?.price6h != null ? Number(req.body.price6h) : undefined,
    priceNight: req.body?.priceNight != null ? Number(req.body.priceNight) : undefined,
    location: req.body?.location != null ? String(req.body.location) : undefined,
    isActive: req.body?.isActive != null ? Boolean(req.body.isActive) : undefined
  } as any;

  const delegate = motelRoomDelegate();
  if (delegate?.updateMany) {
    const updated = await delegate.updateMany({
      where: { id: String(req.params.id), establishmentId: req.session.userId! },
      data
    });
    return res.json({ ok: true, updated: updated.count });
  }

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `UPDATE "MotelRoom" SET
      "name" = COALESCE($3, "name"),
      "description" = COALESCE($4, "description"),
      "roomType" = COALESCE($5, "roomType"),
      "amenities" = COALESCE($6::text[], "amenities"),
      "photoUrls" = COALESCE($7::text[], "photoUrls"),
      "price" = COALESCE($8, "price"),
      "price3h" = COALESCE($9, "price3h"),
      "price6h" = COALESCE($10, "price6h"),
      "priceNight" = COALESCE($11, "priceNight"),
      "location" = COALESCE($12, "location"),
      "isActive" = COALESCE($13, "isActive"),
      "updatedAt" = NOW()
    WHERE id = $1::uuid AND "establishmentId" = $2::uuid
    RETURNING id`,
    String(req.params.id),
    req.session.userId!,
    data.name ?? null,
    data.description ?? null,
    data.roomType ?? null,
    data.amenities ?? null,
    data.photoUrls ?? null,
    data.price ?? null,
    data.price3h ?? null,
    data.price6h ?? null,
    data.priceNight ?? null,
    data.location ?? null,
    data.isActive ?? null
  );

  return res.json({ ok: true, updated: rows.length });
}));

motelRouter.post("/motel/dashboard/promotions", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });

  const data = {
    establishmentId: req.session.userId!,
    title: String(req.body?.title || "Promo"),
    description: req.body?.description ? String(req.body.description) : null,
    discountPercent: req.body?.discountPercent != null ? Number(req.body.discountPercent) : null,
    discountClp: req.body?.discountClp != null ? Number(req.body.discountClp) : null,
    startsAt: req.body?.startsAt ? new Date(req.body.startsAt) : null,
    endsAt: req.body?.endsAt ? new Date(req.body.endsAt) : null,
    isActive: req.body?.isActive != null ? Boolean(req.body.isActive) : true,
    roomId: req.body?.roomId ? String(req.body.roomId) : null,
    roomIds: Array.isArray(req.body?.roomIds) ? req.body.roomIds.map((id: any) => String(id)).filter(Boolean) : []
  } as any;

  const delegate = motelPromotionDelegate();
  if (delegate?.create) {
    const promotion = await delegate.create({ data });
    return res.json({ promotion });
  }

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `INSERT INTO "MotelPromotion" ("id", "establishmentId", "title", "description", "discountPercent", "discountClp", "startsAt", "endsAt", "isActive", "roomId", "roomIds", "createdAt", "updatedAt") VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10::uuid, $11::uuid[], NOW(), NOW()) RETURNING *`,
    randomUUID(),
    data.establishmentId,
    data.title,
    data.description,
    data.discountPercent,
    data.discountClp,
    data.startsAt,
    data.endsAt,
    data.isActive,
    data.roomId,
    data.roomIds
  );

  return res.json({ promotion: rows[0] });
}));

motelRouter.put("/motel/dashboard/promotions/:id", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });

  const data = {
    title: req.body?.title != null ? String(req.body.title) : undefined,
    description: req.body?.description != null ? String(req.body.description) : undefined,
    discountPercent: req.body?.discountPercent != null ? Number(req.body.discountPercent) : undefined,
    discountClp: req.body?.discountClp != null ? Number(req.body.discountClp) : undefined,
    startsAt: req.body?.startsAt ? new Date(req.body.startsAt) : undefined,
    endsAt: req.body?.endsAt ? new Date(req.body.endsAt) : undefined,
    isActive: req.body?.isActive != null ? Boolean(req.body.isActive) : undefined,
    roomId: req.body?.roomId != null ? String(req.body.roomId) : undefined,
    roomIds: Array.isArray(req.body?.roomIds) ? req.body.roomIds.map((id: any) => String(id)).filter(Boolean) : undefined
  } as any;

  const delegate = motelPromotionDelegate();
  if (delegate?.updateMany) {
    const updated = await delegate.updateMany({
      where: { id: String(req.params.id), establishmentId: req.session.userId! },
      data
    });
    return res.json({ ok: true, updated: updated.count });
  }

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `UPDATE "MotelPromotion" SET
      "title" = COALESCE($3, "title"),
      "description" = COALESCE($4, "description"),
      "discountPercent" = COALESCE($5, "discountPercent"),
      "discountClp" = COALESCE($6, "discountClp"),
      "startsAt" = COALESCE($7, "startsAt"),
      "endsAt" = COALESCE($8, "endsAt"),
      "isActive" = COALESCE($9, "isActive"),
      "roomId" = COALESCE($10, "roomId"),
      "roomIds" = COALESCE($11::uuid[], "roomIds"),
      "updatedAt" = NOW()
    WHERE id = $1::uuid AND "establishmentId" = $2::uuid
    RETURNING id`,
    String(req.params.id),
    req.session.userId!,
    data.title ?? null,
    data.description ?? null,
    data.discountPercent ?? null,
    data.discountClp ?? null,
    data.startsAt ?? null,
    data.endsAt ?? null,
    data.isActive ?? null,
    data.roomId ?? null,
    data.roomIds ?? null
  );

  return res.json({ ok: true, updated: rows.length });
}));

motelRouter.delete("/motel/dashboard/rooms/:id", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });
  const id = String(req.params.id);
  await prisma.$executeRawUnsafe(`DELETE FROM "MotelPromotion" WHERE "establishmentId" = $1::uuid AND ("roomId" = $2::uuid OR $2::uuid = ANY("roomIds"))`, req.session.userId!, id);
  const rows = await prisma.$queryRawUnsafe<any[]>(`DELETE FROM "MotelRoom" WHERE id = $1::uuid AND "establishmentId" = $2::uuid RETURNING id`, id, req.session.userId!);
  return res.json({ ok: true, deleted: rows.length });
}));

motelRouter.delete("/motel/dashboard/promotions/:id", asyncHandler(async (req, res) => {
  await ensureMotelSchema();
  const user = (req as any).user;
  if (!isMotelOwner(user)) return res.status(403).json({ error: "FORBIDDEN" });
  const rows = await prisma.$queryRawUnsafe<any[]>(`DELETE FROM "MotelPromotion" WHERE id = $1::uuid AND "establishmentId" = $2::uuid RETURNING id`, String(req.params.id), req.session.userId!);
  return res.json({ ok: true, deleted: rows.length });
}));

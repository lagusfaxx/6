/**
 * Acompañantes IA — rutas.
 *
 * Público:   GET /ai-companions/catalog, /ai-companions/catalog/:slug, /ai-companions/pricing
 * Usuario:   /ai-companions/me, consent, plans, chats, memorias, imágenes
 * Panel:     /admin/ai-companions*, /admin/ai-companions-settings, /admin/ai-companions-flags
 */
import { Router, type Request } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import sharp from "sharp";
import type { AiCompanionAccess, AiCompanionGender, AiCompanionPlanTier } from "@prisma/client";
import { prisma } from "../db";
import { config } from "../config";
import { requireAdmin } from "../auth/middleware";
import { asyncHandler } from "../lib/asyncHandler";
import { LocalStorageProvider } from "../storage/localStorageProvider";
import { privateRefToRelPath, streamPrivateFile } from "../umate/privateStorage";
import { INTENSITIES, PERSONALITIES, capIntensity, isIntensityKey, isPersonalityKey } from "./personas";
import { isChatConfigured, isImageConfigured, maxChatIntensity, maxImageIntensity, ProviderError } from "./providers";
import { checkText, recordFlag } from "./safety";
import {
  ageFromBirthdate,
  canUseCompanion,
  debitTokens,
  effectiveTier,
  getOrCreateAccount,
  getPrices,
  imagePrice,
  InsufficientTokensError,
  messagesSentToday,
  setPrices,
  TIER_LIMITS,
  type Prices,
} from "./plans";
import { chatPersonality, generateReply, maybeUpdateMemory, recoverStaleImageJobs, runImageJob } from "./service";
import { seedAiCompanions } from "./seed";

export const aiCompanionsRouter = Router();

const MAX_MESSAGE_CHARS = 2000;
const MAX_IMAGE_REQUEST_CHARS = 500;
const MAX_MEMORY_CHARS = 300;
const MAX_PENDING_IMAGES = 2;

const publicStorage = new LocalStorageProvider({
  baseDir: config.storageDir,
  publicPathPrefix: `${(config.apiUrl || "").replace(/\/$/, "")}/uploads`,
});
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const chatLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String((req as any).user?.id || req.ip),
  message: { error: "RATE_LIMITED", message: "Vas muy rápido. Espera unos segundos." },
});
const imageLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String((req as any).user?.id || req.ip),
  message: { error: "RATE_LIMITED", message: "Demasiadas imágenes seguidas. Espera un minuto." },
});

/* Arranque: catálogo inicial y recuperación de imágenes interrumpidas. */
void seedAiCompanions();
void recoverStaleImageJobs();
setInterval(() => void recoverStaleImageJobs(), 5 * 60_000).unref();

function userId(req: Request): string {
  return String((req as any).user?.id || "");
}

function publicCompanion(c: {
  id: string; slug: string; name: string; gender: AiCompanionGender; age: number; tagline: string | null;
  bio: string | null; personality: string; personalities: string[]; communicationStyle: string | null;
  roleplayNotes: string | null; interests: string[]; avatarUrl: string | null; galleryUrls: string[];
  access: AiCompanionAccess; unlockTokens: number; unlockDays: number;
}) {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    gender: c.gender,
    age: c.age,
    tagline: c.tagline,
    bio: c.bio,
    personality: c.personality,
    personalities: (c.personalities.length ? c.personalities : [c.personality])
      .filter(isPersonalityKey)
      .map((key) => ({ key, label: PERSONALITIES[key].label, description: PERSONALITIES[key].description })),
    communicationStyle: c.communicationStyle,
    roleplayNotes: c.roleplayNotes,
    interests: c.interests,
    avatarUrl: c.avatarUrl,
    galleryUrls: c.galleryUrls,
    access: c.access,
    unlockTokens: c.unlockTokens,
    unlockDays: c.unlockDays,
  };
}

function pricingPayload(prices: Prices) {
  return {
    days: prices.ai_plan_days,
    plans: [
      { tier: "FREE", tokens: 0, ...TIER_LIMITS.FREE, imageTokens: prices.ai_image_tokens },
      { tier: "PREMIUM", tokens: prices.ai_plan_premium_tokens, ...TIER_LIMITS.PREMIUM, imageTokens: prices.ai_image_tokens },
      { tier: "VIP", tokens: prices.ai_plan_vip_tokens, ...TIER_LIMITS.VIP, imageTokens: prices.ai_image_tokens_vip },
    ],
  };
}

/**
 * Exige que el usuario haya confirmado ser mayor de edad (con fecha de
 * nacimiento de 18+) y aceptado las reglas de la sección.
 */
async function requireAdultAccount(req: Request) {
  const uid = userId(req);
  const [account, user] = await Promise.all([
    getOrCreateAccount(uid),
    prisma.user.findUnique({ where: { id: uid }, select: { birthdate: true } }),
  ]);
  const adult = Boolean(user?.birthdate && ageFromBirthdate(user.birthdate) >= 18);
  if (!account.adultConfirmedAt || !adult) return { ok: false as const, account };
  return { ok: true as const, account, tier: effectiveTier(account) };
}

const CONSENT_REQUIRED = {
  error: "CONSENT_REQUIRED",
  message: "Confirma que eres mayor de edad y acepta las reglas de la sección para continuar.",
};

async function findCompanionBySlug(slug: string) {
  return prisma.aiCompanion.findFirst({ where: { slug: String(slug || ""), isActive: true } });
}

/* ═════════════════════════════ Público ═════════════════════════════ */

aiCompanionsRouter.get("/ai-companions/catalog", asyncHandler(async (req, res) => {
  const gender = String(req.query.gender || "").toUpperCase();
  const companions = await prisma.aiCompanion.findMany({
    where: {
      isActive: true,
      ...(gender === "FEMALE" || gender === "MALE" ? { gender: gender as AiCompanionGender } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  res.json({ companions: companions.map(publicCompanion) });
}));

aiCompanionsRouter.get("/ai-companions/catalog/:slug", asyncHandler(async (req, res) => {
  const companion = await findCompanionBySlug(req.params.slug);
  if (!companion) return res.status(404).json({ error: "NOT_FOUND" });
  res.json({ companion: publicCompanion(companion) });
}));

aiCompanionsRouter.get("/ai-companions/pricing", asyncHandler(async (_req, res) => {
  res.json(pricingPayload(await getPrices()));
}));

/* ═════════════════════════════ Usuario ═════════════════════════════ */

aiCompanionsRouter.get("/ai-companions/me", asyncHandler(async (req, res) => {
  const uid = userId(req);
  const [account, user, wallet, sentToday, prices] = await Promise.all([
    getOrCreateAccount(uid),
    prisma.user.findUnique({ where: { id: uid }, select: { birthdate: true } }),
    prisma.wallet.findUnique({ where: { userId: uid }, select: { balance: true } }),
    messagesSentToday(uid),
    getPrices(),
  ]);
  const tier = effectiveTier(account);
  const limits = TIER_LIMITS[tier];
  res.json({
    tier,
    tierExpiresAt: tier === "FREE" ? null : account.tierExpiresAt,
    adultConfirmed: Boolean(account.adultConfirmedAt),
    hasBirthdate: Boolean(user?.birthdate),
    isAdult: Boolean(user?.birthdate && ageFromBirthdate(user.birthdate) >= 18),
    limits,
    usage: { messagesToday: sentToday, messagesLeft: Math.max(0, limits.dailyMessages - sentToday) },
    walletBalance: wallet?.balance ?? 0,
    imageTokens: imagePrice(tier, prices),
    features: {
      chat: isChatConfigured(),
      images: isImageConfigured(),
      maxChatIntensity: maxChatIntensity(),
      maxImageIntensity: maxImageIntensity(),
    },
    personalities: Object.entries(PERSONALITIES).map(([key, p]) => ({ key, label: p.label, description: p.description })),
    intensities: Object.entries(INTENSITIES).map(([key, i]) => ({ key, label: i.label })),
  });
}));

/** Declaración de mayoría de edad + aceptación de reglas. */
aiCompanionsRouter.post("/ai-companions/consent", asyncHandler(async (req, res) => {
  const uid = userId(req);
  if (req.body?.accept !== true) return res.status(400).json({ error: "ACCEPT_REQUIRED" });

  const user = await prisma.user.findUnique({ where: { id: uid }, select: { birthdate: true } });
  let birthdate = user?.birthdate ?? null;

  // Si la cuenta no tenía fecha de nacimiento se registra ahora; una ya
  // guardada no se reescribe desde aquí.
  if (!birthdate) {
    const raw = String(req.body?.birthdate || "");
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00Z`) : null;
    if (!parsed || Number.isNaN(parsed.getTime()) || parsed.getFullYear() < 1900) {
      return res.status(400).json({ error: "BIRTHDATE_REQUIRED", message: "Indica tu fecha de nacimiento." });
    }
    birthdate = parsed;
    if (ageFromBirthdate(birthdate) >= 18) {
      await prisma.user.update({ where: { id: uid }, data: { birthdate } });
    }
  }

  if (ageFromBirthdate(birthdate) < 18) {
    return res.status(403).json({ error: "UNDERAGE", message: "Esta sección es sólo para mayores de 18 años." });
  }

  await prisma.aiCompanionAccount.upsert({
    where: { userId: uid },
    create: { userId: uid, adultConfirmedAt: new Date() },
    update: { adultConfirmedAt: new Date() },
  });
  res.json({ ok: true });
}));

/** Compra o renueva Premium/VIP con tokens. Renovar suma días al vencimiento vigente. */
aiCompanionsRouter.post("/ai-companions/plans/buy", asyncHandler(async (req, res) => {
  const gate = await requireAdultAccount(req);
  if (!gate.ok) return res.status(403).json(CONSENT_REQUIRED);

  const tier = String(req.body?.tier || "").toUpperCase() as AiCompanionPlanTier;
  if (tier !== "PREMIUM" && tier !== "VIP") return res.status(400).json({ error: "INVALID_TIER" });

  const prices = await getPrices();
  const cost = tier === "VIP" ? prices.ai_plan_vip_tokens : prices.ai_plan_premium_tokens;
  const days = prices.ai_plan_days;
  const uid = userId(req);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.aiCompanionAccount.findUniqueOrThrow({ where: { userId: uid } });
      const current = effectiveTier(account);
      // Mismo plan vigente: se extiende. Cambio de plan: parte hoy.
      const base = current === tier && account.tierExpiresAt ? account.tierExpiresAt : new Date();
      const expiresAt = new Date(base.getTime() + days * 86_400_000);
      const balance = await debitTokens(tx, {
        userId: uid,
        amount: cost,
        description: `Acompañantes IA: plan ${tier === "VIP" ? "VIP" : "Premium"} ${days} días`,
        referenceId: account.id,
      });
      await tx.aiCompanionAccount.update({ where: { id: account.id }, data: { tier, tierExpiresAt: expiresAt } });
      return { expiresAt, balance };
    });
    res.json({ ok: true, tier, tierExpiresAt: result.expiresAt, walletBalance: result.balance });
  } catch (err) {
    if (err instanceof InsufficientTokensError) {
      return res.status(402).json({ error: "INSUFFICIENT_TOKENS", needed: err.needed, balance: err.balance, message: "No tienes tokens suficientes." });
    }
    throw err;
  }
}));

/** Desbloqueo individual de un personaje EXCLUSIVE. */
aiCompanionsRouter.post("/ai-companions/unlock/:slug", asyncHandler(async (req, res) => {
  const gate = await requireAdultAccount(req);
  if (!gate.ok) return res.status(403).json(CONSENT_REQUIRED);
  const companion = await findCompanionBySlug(req.params.slug);
  if (!companion) return res.status(404).json({ error: "NOT_FOUND" });
  if (companion.access !== "EXCLUSIVE" || companion.unlockTokens <= 0) {
    return res.status(400).json({ error: "NOT_UNLOCKABLE" });
  }
  const uid = userId(req);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.aiCompanionUnlock.findUnique({
        where: { userId_companionId: { userId: uid, companionId: companion.id } },
      });
      const base = existing && existing.expiresAt.getTime() > Date.now() ? existing.expiresAt : new Date();
      const expiresAt = new Date(base.getTime() + companion.unlockDays * 86_400_000);
      const balance = await debitTokens(tx, {
        userId: uid,
        amount: companion.unlockTokens,
        description: `Acompañantes IA: acceso a ${companion.name} (${companion.unlockDays} días)`,
        referenceId: companion.id,
      });
      await tx.aiCompanionUnlock.upsert({
        where: { userId_companionId: { userId: uid, companionId: companion.id } },
        create: { userId: uid, companionId: companion.id, expiresAt },
        update: { expiresAt },
      });
      return { expiresAt, balance };
    });
    res.json({ ok: true, expiresAt: result.expiresAt, walletBalance: result.balance });
  } catch (err) {
    if (err instanceof InsufficientTokensError) {
      return res.status(402).json({ error: "INSUFFICIENT_TOKENS", needed: err.needed, balance: err.balance, message: "No tienes tokens suficientes." });
    }
    throw err;
  }
}));

/** Conversaciones del usuario, la más reciente primero. */
aiCompanionsRouter.get("/ai-companions/chats", asyncHandler(async (req, res) => {
  const chats = await prisma.aiCompanionChat.findMany({
    where: { userId: userId(req), companion: { isActive: true } },
    orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } },
    include: {
      companion: { select: { slug: true, name: true, avatarUrl: true, gender: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { role: true, content: true, createdAt: true } },
    },
  });
  res.json({
    chats: chats.map((c) => ({
      id: c.id,
      companion: c.companion,
      lastMessage: c.messages[0] || null,
      lastMessageAt: c.lastMessageAt,
    })),
  });
}));

async function chatContext(req: Request, slug: string) {
  const gate = await requireAdultAccount(req);
  if (!gate.ok) return { ok: false as const, status: 403, body: CONSENT_REQUIRED as object };
  const companion = await findCompanionBySlug(slug);
  if (!companion) return { ok: false as const, status: 404, body: { error: "NOT_FOUND" } as object };
  const uid = userId(req);
  const allowed = await canUseCompanion(uid, gate.tier, companion);
  return { ok: true as const, uid, tier: gate.tier, companion, allowed };
}

const LOCKED = (access: AiCompanionAccess) => ({
  error: "COMPANION_LOCKED",
  access,
  message:
    access === "EXCLUSIVE"
      ? "Este personaje es exclusivo: desbloquéalo o activa el plan VIP."
      : `Este personaje requiere el plan ${access === "VIP" ? "VIP" : "Premium"}.`,
});

aiCompanionsRouter.get("/ai-companions/chats/:slug", asyncHandler(async (req, res) => {
  const ctx = await chatContext(req, req.params.slug);
  if (!ctx.ok) return res.status(ctx.status).json(ctx.body);
  const { uid, companion } = ctx;

  const chat = await prisma.aiCompanionChat.findUnique({
    where: { userId_companionId: { userId: uid, companionId: companion.id } },
  });
  const before = req.query.before ? new Date(String(req.query.before)) : null;
  const messages = chat
    ? await prisma.aiCompanionMessage.findMany({
        where: { chatId: chat.id, ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}) },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, role: true, content: true, imageId: true, createdAt: true },
      })
    : [];

  const unlockedUntil =
    companion.access === "EXCLUSIVE"
      ? (await prisma.aiCompanionUnlock.findUnique({
          where: { userId_companionId: { userId: uid, companionId: companion.id } },
          select: { expiresAt: true },
        }))?.expiresAt ?? null
      : null;

  res.json({
    companion: publicCompanion(companion),
    allowed: ctx.allowed,
    unlockedUntil,
    settings: {
      personality: chatPersonality(chat, companion),
      intensity: capIntensity(chat?.intensity || "suave", maxChatIntensity()),
      userNickname: chat?.userNickname || null,
    },
    hasSummary: Boolean(chat?.summary),
    messages: messages.reverse(),
    hasMore: messages.length === 50,
  });
}));

aiCompanionsRouter.patch("/ai-companions/chats/:slug/settings", asyncHandler(async (req, res) => {
  const ctx = await chatContext(req, req.params.slug);
  if (!ctx.ok) return res.status(ctx.status).json(ctx.body);
  const { uid, companion } = ctx;

  const data: { personality?: string | null; intensity?: string; userNickname?: string | null } = {};
  const allowedPersonalities = companion.personalities.length ? companion.personalities : [companion.personality];
  if (req.body?.personality !== undefined) {
    const p = req.body.personality;
    if (p !== null && (!isPersonalityKey(p) || !allowedPersonalities.includes(p))) {
      return res.status(400).json({ error: "INVALID_PERSONALITY" });
    }
    data.personality = p;
  }
  if (req.body?.intensity !== undefined) {
    if (!isIntensityKey(req.body.intensity)) return res.status(400).json({ error: "INVALID_INTENSITY" });
    data.intensity = capIntensity(req.body.intensity, maxChatIntensity());
  }
  if (req.body?.userNickname !== undefined) {
    const nick = String(req.body.userNickname || "").trim().slice(0, 40);
    if (nick && !checkText(nick, "chat_in").ok) return res.status(400).json({ error: "INVALID_NICKNAME" });
    data.userNickname = nick || null;
  }

  const chat = await prisma.aiCompanionChat.upsert({
    where: { userId_companionId: { userId: uid, companionId: companion.id } },
    create: { userId: uid, companionId: companion.id, ...data, intensity: data.intensity || "suave" },
    update: data,
  });
  res.json({
    settings: {
      personality: chatPersonality(chat, companion),
      intensity: capIntensity(chat.intensity, maxChatIntensity()),
      userNickname: chat.userNickname,
    },
  });
}));

aiCompanionsRouter.post("/ai-companions/chats/:slug/messages", chatLimiter, asyncHandler(async (req, res) => {
  const ctx = await chatContext(req, req.params.slug);
  if (!ctx.ok) return res.status(ctx.status).json(ctx.body);
  const { uid, tier, companion } = ctx;
  if (!ctx.allowed) return res.status(403).json(LOCKED(companion.access));
  if (!isChatConfigured()) {
    return res.status(503).json({ error: "AI_UNAVAILABLE", message: "El chat con IA no está disponible en este momento." });
  }

  const content = String(req.body?.content || "").trim();
  if (!content) return res.status(400).json({ error: "EMPTY_MESSAGE" });
  if (content.length > MAX_MESSAGE_CHARS) {
    return res.status(400).json({ error: "MESSAGE_TOO_LONG", message: `Máximo ${MAX_MESSAGE_CHARS} caracteres.` });
  }

  const limits = TIER_LIMITS[tier];
  const sent = await messagesSentToday(uid);
  if (sent >= limits.dailyMessages) {
    return res.status(429).json({
      error: "DAILY_LIMIT",
      message: tier === "VIP" ? "Llegaste al límite diario de mensajes." : "Llegaste al límite diario de mensajes de tu plan. Mejora tu plan para seguir conversando.",
    });
  }

  const check = checkText(content, "chat_in");
  if (!check.ok) {
    await recordFlag({ userId: uid, companionId: companion.id, source: "chat_in", reason: check.reason, text: content });
    return res.status(422).json({ error: "CONTENT_BLOCKED", reason: check.reason, message: check.message });
  }

  const chat = await prisma.aiCompanionChat.upsert({
    where: { userId_companionId: { userId: uid, companionId: companion.id } },
    create: { userId: uid, companionId: companion.id },
    update: {},
  });
  const userMessage = await prisma.aiCompanionMessage.create({
    data: { chatId: chat.id, role: "USER", content },
    select: { id: true, role: true, content: true, imageId: true, createdAt: true },
  });

  let reply: { content: string };
  try {
    reply = await generateReply({ userId: uid, tier, companion, chat });
  } catch (err) {
    console.error("[ai-companions] chat falló", err instanceof ProviderError ? err.message : err);
    // El mensaje del usuario no cuenta para el límite si no hubo respuesta.
    await prisma.aiCompanionMessage.delete({ where: { id: userMessage.id } }).catch(() => {});
    return res.status(502).json({ error: "AI_ERROR", message: `${companion.name} no pudo responder. Intenta de nuevo.` });
  }

  const assistantMessage = await prisma.aiCompanionMessage.create({
    data: { chatId: chat.id, role: "ASSISTANT", content: reply.content },
    select: { id: true, role: true, content: true, imageId: true, createdAt: true },
  });
  await prisma.aiCompanionChat.update({ where: { id: chat.id }, data: { lastMessageAt: assistantMessage.createdAt } });

  void maybeUpdateMemory({ userId: uid, tier, companion, chatId: chat.id });

  res.json({
    messages: [userMessage, assistantMessage],
    usage: { messagesToday: sent + 1, messagesLeft: Math.max(0, limits.dailyMessages - sent - 1) },
  });
}));

/** Borra el historial del chat. Con ?memories=1 también los recuerdos. */
aiCompanionsRouter.delete("/ai-companions/chats/:slug", asyncHandler(async (req, res) => {
  const companion = await findCompanionBySlug(req.params.slug);
  if (!companion) return res.status(404).json({ error: "NOT_FOUND" });
  const uid = userId(req);
  const alsoMemories = String(req.query.memories || "") === "1";

  await prisma.$transaction(async (tx) => {
    const chat = await tx.aiCompanionChat.findUnique({
      where: { userId_companionId: { userId: uid, companionId: companion.id } },
    });
    if (chat) {
      await tx.aiCompanionMessage.deleteMany({ where: { chatId: chat.id } });
      await tx.aiCompanionChat.update({
        where: { id: chat.id },
        data: { summary: null, summarizedUntil: null, lastMessageAt: null },
      });
    }
    if (alsoMemories) {
      await tx.aiCompanionMemory.deleteMany({ where: { userId: uid, companionId: companion.id } });
    }
  });
  res.json({ ok: true });
}));

/* ── Memoria ── */

aiCompanionsRouter.get("/ai-companions/chats/:slug/memories", asyncHandler(async (req, res) => {
  const companion = await findCompanionBySlug(req.params.slug);
  if (!companion) return res.status(404).json({ error: "NOT_FOUND" });
  const uid = userId(req);
  const [memories, chat, account] = await Promise.all([
    prisma.aiCompanionMemory.findMany({
      where: { userId: uid, companionId: companion.id },
      orderBy: { updatedAt: "desc" },
      select: { id: true, kind: true, content: true, source: true, updatedAt: true },
    }),
    prisma.aiCompanionChat.findUnique({
      where: { userId_companionId: { userId: uid, companionId: companion.id } },
      select: { summary: true },
    }),
    getOrCreateAccount(uid),
  ]);
  const tier = effectiveTier(account);
  res.json({ memories, summary: chat?.summary || null, limit: TIER_LIMITS[tier].memoryLimit, autoMemory: TIER_LIMITS[tier].autoMemory });
}));

function parseMemoryBody(body: any): { content: string; kind: "FACT" | "PREFERENCE" } | { error: string } {
  const content = String(body?.content || "").trim().slice(0, MAX_MEMORY_CHARS);
  if (!content) return { error: "EMPTY_MEMORY" };
  if (!checkText(content, "chat_in").ok) return { error: "CONTENT_BLOCKED" };
  const kind = body?.kind === "PREFERENCE" ? "PREFERENCE" : "FACT";
  return { content, kind };
}

aiCompanionsRouter.post("/ai-companions/chats/:slug/memories", asyncHandler(async (req, res) => {
  const ctx = await chatContext(req, req.params.slug);
  if (!ctx.ok) return res.status(ctx.status).json(ctx.body);
  const parsed = parseMemoryBody(req.body);
  if ("error" in parsed) return res.status(400).json(parsed);

  const count = await prisma.aiCompanionMemory.count({ where: { userId: ctx.uid, companionId: ctx.companion.id } });
  if (count >= TIER_LIMITS[ctx.tier].memoryLimit) {
    return res.status(409).json({ error: "MEMORY_FULL", message: "Llegaste al máximo de recuerdos de tu plan. Borra alguno o mejora tu plan." });
  }
  const memory = await prisma.aiCompanionMemory.create({
    data: { userId: ctx.uid, companionId: ctx.companion.id, content: parsed.content, kind: parsed.kind, source: "user" },
    select: { id: true, kind: true, content: true, source: true, updatedAt: true },
  });
  res.status(201).json({ memory });
}));

aiCompanionsRouter.patch("/ai-companions/memories/:id", asyncHandler(async (req, res) => {
  const parsed = parseMemoryBody(req.body);
  if ("error" in parsed) return res.status(400).json(parsed);
  const result = await prisma.aiCompanionMemory.updateMany({
    where: { id: req.params.id, userId: userId(req) },
    data: { content: parsed.content, kind: parsed.kind, source: "user" },
  });
  if (!result.count) return res.status(404).json({ error: "NOT_FOUND" });
  res.json({ ok: true });
}));

aiCompanionsRouter.delete("/ai-companions/memories/:id", asyncHandler(async (req, res) => {
  const result = await prisma.aiCompanionMemory.deleteMany({ where: { id: req.params.id, userId: userId(req) } });
  if (!result.count) return res.status(404).json({ error: "NOT_FOUND" });
  res.json({ ok: true });
}));

aiCompanionsRouter.delete("/ai-companions/chats/:slug/summary", asyncHandler(async (req, res) => {
  const companion = await findCompanionBySlug(req.params.slug);
  if (!companion) return res.status(404).json({ error: "NOT_FOUND" });
  await prisma.aiCompanionChat.updateMany({
    where: { userId: userId(req), companionId: companion.id },
    data: { summary: null },
  });
  res.json({ ok: true });
}));

/* ── Imágenes ── */

function publicImage(img: { id: string; companionId: string; request: string; status: string; tokensCharged: number; error: string | null; createdAt: Date }) {
  return {
    id: img.id,
    companionId: img.companionId,
    request: img.request,
    status: img.status,
    tokensCharged: img.tokensCharged,
    error: img.error,
    createdAt: img.createdAt,
    fileUrl: img.status === "DONE" ? `/ai-companions/images/${img.id}/file` : null,
  };
}

aiCompanionsRouter.post("/ai-companions/chats/:slug/images", imageLimiter, asyncHandler(async (req, res) => {
  const ctx = await chatContext(req, req.params.slug);
  if (!ctx.ok) return res.status(ctx.status).json(ctx.body);
  const { uid, tier, companion } = ctx;
  if (!ctx.allowed) return res.status(403).json(LOCKED(companion.access));
  if (!isImageConfigured()) {
    return res.status(503).json({ error: "AI_UNAVAILABLE", message: "La generación de imágenes no está disponible en este momento." });
  }

  const request = String(req.body?.request || "").trim();
  if (request.length < 3) return res.status(400).json({ error: "EMPTY_REQUEST", message: "Describe la imagen que quieres." });
  if (request.length > MAX_IMAGE_REQUEST_CHARS) {
    return res.status(400).json({ error: "REQUEST_TOO_LONG", message: `Máximo ${MAX_IMAGE_REQUEST_CHARS} caracteres.` });
  }
  const check = checkText(request, "image");
  if (!check.ok) {
    await recordFlag({ userId: uid, companionId: companion.id, source: "image", reason: check.reason, text: request });
    return res.status(422).json({ error: "CONTENT_BLOCKED", reason: check.reason, message: check.message });
  }

  const pending = await prisma.aiCompanionImage.count({ where: { userId: uid, status: "PENDING" } });
  if (pending >= MAX_PENDING_IMAGES) {
    return res.status(429).json({ error: "TOO_MANY_PENDING", message: "Espera a que terminen tus imágenes en curso." });
  }

  const chat = await prisma.aiCompanionChat.upsert({
    where: { userId_companionId: { userId: uid, companionId: companion.id } },
    create: { userId: uid, companionId: companion.id },
    update: {},
  });
  const requestedIntensity = isIntensityKey(req.body?.intensity) ? req.body.intensity : chat.intensity;
  const intensity = capIntensity(requestedIntensity, maxImageIntensity());
  const cost = imagePrice(tier, await getPrices());

  try {
    const { image, balance } = await prisma.$transaction(async (tx) => {
      const image = await tx.aiCompanionImage.create({
        data: { userId: uid, companionId: companion.id, request, prompt: "", intensity, tokensCharged: cost },
      });
      const balance = await debitTokens(tx, {
        userId: uid,
        amount: cost,
        description: `Acompañantes IA: imagen de ${companion.name}`,
        referenceId: image.id,
      });
      // Con imageId: el pedido de foto ya se paga aparte y no cuenta para el límite de mensajes.
      await tx.aiCompanionMessage.create({
        data: { chatId: chat.id, role: "USER", content: `📸 ${request}`, imageId: image.id },
      });
      return { image, balance };
    });

    void runImageJob(image.id);
    res.status(202).json({ image: publicImage(image), walletBalance: balance });
  } catch (err) {
    if (err instanceof InsufficientTokensError) {
      return res.status(402).json({ error: "INSUFFICIENT_TOKENS", needed: err.needed, balance: err.balance, message: "No tienes tokens suficientes para la imagen." });
    }
    throw err;
  }
}));

aiCompanionsRouter.get("/ai-companions/images", asyncHandler(async (req, res) => {
  const slug = String(req.query.slug || "");
  const companion = slug ? await findCompanionBySlug(slug) : null;
  const images = await prisma.aiCompanionImage.findMany({
    where: { userId: userId(req), ...(companion ? { companionId: companion.id } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json({ images: images.map(publicImage) });
}));

aiCompanionsRouter.get("/ai-companions/images/:id", asyncHandler(async (req, res) => {
  const image = await prisma.aiCompanionImage.findFirst({ where: { id: req.params.id, userId: userId(req) } });
  if (!image) return res.status(404).json({ error: "NOT_FOUND" });
  res.json({ image: publicImage(image) });
}));

/** Archivo de la imagen: sólo su dueño, nunca por /uploads. */
aiCompanionsRouter.get("/ai-companions/images/:id/file", asyncHandler(async (req, res) => {
  const image = await prisma.aiCompanionImage.findFirst({
    where: { id: req.params.id, userId: userId(req), status: "DONE" },
    select: { fileRef: true },
  });
  const rel = image?.fileRef ? privateRefToRelPath(image.fileRef) : null;
  if (!rel) return res.status(404).json({ error: "NOT_FOUND" });
  res.setHeader("Cache-Control", "private, max-age=3600");
  res.setHeader("X-Robots-Tag", "noindex");
  await streamPrivateFile(rel, req, res);
}));

aiCompanionsRouter.delete("/ai-companions/images/:id", asyncHandler(async (req, res) => {
  const uid = userId(req);
  const image = await prisma.aiCompanionImage.findFirst({ where: { id: req.params.id, userId: uid } });
  if (!image) return res.status(404).json({ error: "NOT_FOUND" });
  if (image.status === "PENDING") return res.status(409).json({ error: "IMAGE_PENDING" });
  await prisma.$transaction([
    prisma.aiCompanionMessage.updateMany({
      where: { imageId: image.id, role: "ASSISTANT" },
      data: { imageId: null, content: "(imagen eliminada)" },
    }),
    prisma.aiCompanionImage.delete({ where: { id: image.id } }),
  ]);
  // El archivo privado queda huérfano y sin forma de llegar a él (no hay ruta pública).
  res.json({ ok: true });
}));

/* ═════════════════════════════ Panel ═════════════════════════════ */

const ACCESS_VALUES: AiCompanionAccess[] = ["FREE", "PREMIUM", "VIP", "EXCLUSIVE"];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function parseCompanionBody(body: any, partial: boolean) {
  const out: Record<string, unknown> = {};
  const str = (k: string, max: number) => {
    if (body?.[k] === undefined) return;
    const v = String(body[k] ?? "").trim().slice(0, max);
    out[k] = v || null;
  };
  const list = (k: string, max: number) => {
    if (body?.[k] === undefined) return;
    const arr = Array.isArray(body[k]) ? body[k] : String(body[k] || "").split(",");
    out[k] = arr.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, max);
  };

  if (body?.name !== undefined) out.name = String(body.name).trim().slice(0, 60);
  if (body?.slug !== undefined || (!partial && body?.name)) out.slug = slugify(String(body.slug || body.name || ""));
  if (body?.gender !== undefined) out.gender = body.gender === "MALE" ? "MALE" : "FEMALE";
  if (body?.age !== undefined) out.age = Math.floor(Number(body.age));
  str("tagline", 140);
  str("bio", 1500);
  if (body?.appearance !== undefined) out.appearance = String(body.appearance || "").trim().slice(0, 600);
  if (body?.personality !== undefined) out.personality = String(body.personality);
  list("personalities", 7);
  str("communicationStyle", 400);
  str("roleplayNotes", 800);
  list("interests", 12);
  if (body?.access !== undefined) out.access = String(body.access).toUpperCase();
  if (body?.unlockTokens !== undefined) out.unlockTokens = Math.max(0, Math.floor(Number(body.unlockTokens) || 0));
  if (body?.unlockDays !== undefined) out.unlockDays = Math.min(365, Math.max(1, Math.floor(Number(body.unlockDays) || 30)));
  if (body?.imageSeed !== undefined) out.imageSeed = Math.max(0, Math.floor(Number(body.imageSeed) || 0));
  if (body?.isActive !== undefined) out.isActive = Boolean(body.isActive);
  if (body?.sortOrder !== undefined) out.sortOrder = Math.floor(Number(body.sortOrder) || 0);

  const errors: string[] = [];
  if (!partial || out.name !== undefined) if (!out.name) errors.push("Falta el nombre.");
  if (!partial || out.slug !== undefined) if (!out.slug) errors.push("Slug inválido.");
  if (!partial || out.age !== undefined) {
    if (!Number.isFinite(out.age as number) || (out.age as number) < 18 || (out.age as number) > 99) {
      errors.push("La edad debe ser de 18 años o más.");
    }
  }
  if (!partial || out.appearance !== undefined) if (!out.appearance) errors.push("Falta la descripción visual.");
  if (out.personality !== undefined && !isPersonalityKey(out.personality)) errors.push("Personalidad inválida.");
  if (Array.isArray(out.personalities) && (out.personalities as string[]).some((p) => !isPersonalityKey(p))) {
    errors.push("Hay personalidades inválidas.");
  }
  if (out.access !== undefined && !ACCESS_VALUES.includes(out.access as AiCompanionAccess)) errors.push("Acceso inválido.");

  // El propio perfil del personaje tampoco puede sugerir minoría de edad.
  const profileText = ["name", "tagline", "bio", "appearance", "communicationStyle", "roleplayNotes"]
    .map((k) => (typeof out[k] === "string" ? out[k] : ""))
    .join(" ");
  const safe = checkText(profileText, "image");
  if (!safe.ok) errors.push(safe.message);

  return { data: out, errors };
}

aiCompanionsRouter.get("/admin/ai-companions", requireAdmin, asyncHandler(async (_req, res) => {
  const companions = await prisma.aiCompanion.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { chats: true, images: true } } },
  });
  res.json({
    companions,
    personalities: Object.entries(PERSONALITIES).map(([key, p]) => ({ key, label: p.label })),
    providers: {
      chat: isChatConfigured(),
      images: isImageConfigured(),
      maxChatIntensity: maxChatIntensity(),
      maxImageIntensity: maxImageIntensity(),
    },
  });
}));

aiCompanionsRouter.post("/admin/ai-companions", requireAdmin, asyncHandler(async (req, res) => {
  const { data, errors } = parseCompanionBody(req.body, false);
  if (errors.length) return res.status(400).json({ error: "VALIDATION", message: errors.join(" ") });
  const exists = await prisma.aiCompanion.findUnique({ where: { slug: String(data.slug) } });
  if (exists) return res.status(409).json({ error: "SLUG_TAKEN", message: "Ya existe un personaje con ese slug." });
  const companion = await prisma.aiCompanion.create({
    data: { imageSeed: Math.floor(Math.random() * 1_000_000), ...(data as any) },
  });
  res.status(201).json({ companion });
}));

aiCompanionsRouter.put("/admin/ai-companions/:id", requireAdmin, asyncHandler(async (req, res) => {
  const { data, errors } = parseCompanionBody(req.body, true);
  if (errors.length) return res.status(400).json({ error: "VALIDATION", message: errors.join(" ") });
  if (data.slug) {
    const clash = await prisma.aiCompanion.findFirst({ where: { slug: String(data.slug), NOT: { id: req.params.id } } });
    if (clash) return res.status(409).json({ error: "SLUG_TAKEN", message: "Ya existe un personaje con ese slug." });
  }
  const companion = await prisma.aiCompanion.update({ where: { id: req.params.id }, data: data as any });
  res.json({ companion });
}));

async function saveCompanionImage(file: Express.Multer.File): Promise<string> {
  const webp = await sharp(file.buffer).rotate().resize({ width: 1080, withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  const saved = await publicStorage.save({ buffer: webp, filename: "companion.webp", mimeType: "image/webp", folder: "ai-companions" });
  return saved.url;
}

aiCompanionsRouter.post("/admin/ai-companions/:id/avatar", requireAdmin, upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "FILE_REQUIRED" });
  let url: string;
  try {
    url = await saveCompanionImage(req.file);
  } catch {
    return res.status(400).json({ error: "INVALID_IMAGE", message: "El archivo no es una imagen válida." });
  }
  const companion = await prisma.aiCompanion.update({ where: { id: req.params.id }, data: { avatarUrl: url } });
  res.json({ companion });
}));

aiCompanionsRouter.post("/admin/ai-companions/:id/gallery", requireAdmin, upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "FILE_REQUIRED" });
  const current = await prisma.aiCompanion.findUnique({ where: { id: req.params.id }, select: { galleryUrls: true } });
  if (!current) return res.status(404).json({ error: "NOT_FOUND" });
  if (current.galleryUrls.length >= 12) return res.status(409).json({ error: "GALLERY_FULL", message: "Máximo 12 imágenes." });
  let url: string;
  try {
    url = await saveCompanionImage(req.file);
  } catch {
    return res.status(400).json({ error: "INVALID_IMAGE", message: "El archivo no es una imagen válida." });
  }
  const companion = await prisma.aiCompanion.update({
    where: { id: req.params.id },
    data: { galleryUrls: [...current.galleryUrls, url] },
  });
  res.json({ companion });
}));

aiCompanionsRouter.delete("/admin/ai-companions/:id/gallery", requireAdmin, asyncHandler(async (req, res) => {
  const url = String(req.body?.url || req.query.url || "");
  const current = await prisma.aiCompanion.findUnique({ where: { id: req.params.id }, select: { galleryUrls: true } });
  if (!current) return res.status(404).json({ error: "NOT_FOUND" });
  const companion = await prisma.aiCompanion.update({
    where: { id: req.params.id },
    data: { galleryUrls: current.galleryUrls.filter((u) => u !== url) },
  });
  res.json({ companion });
}));

aiCompanionsRouter.get("/admin/ai-companions-settings", requireAdmin, asyncHandler(async (_req, res) => {
  res.json({ prices: await getPrices(), limits: TIER_LIMITS });
}));

aiCompanionsRouter.put("/admin/ai-companions-settings", requireAdmin, asyncHandler(async (req, res) => {
  res.json({ prices: await setPrices(req.body?.prices || {}), limits: TIER_LIMITS });
}));

aiCompanionsRouter.get("/admin/ai-companions-flags", requireAdmin, asyncHandler(async (req, res) => {
  const onlyOpen = String(req.query.open || "1") === "1";
  const flags = await prisma.aiCompanionFlag.findMany({
    where: onlyOpen ? { reviewedAt: null } : {},
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const userIds = [...new Set(flags.map((f) => f.userId).filter(Boolean))] as string[];
  const companionIds = [...new Set(flags.map((f) => f.companionId).filter(Boolean))] as string[];
  const [users, companions] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, username: true, email: true } }),
    prisma.aiCompanion.findMany({ where: { id: { in: companionIds } }, select: { id: true, name: true } }),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const compMap = new Map(companions.map((c) => [c.id, c]));
  // Cuántos bloqueos acumula cada usuario: ayuda a detectar insistencia.
  const counts = userIds.length
    ? await prisma.aiCompanionFlag.groupBy({ by: ["userId"], where: { userId: { in: userIds } }, _count: { _all: true } })
    : [];
  const countMap = new Map(counts.map((c) => [c.userId, c._count._all]));
  res.json({
    flags: flags.map((f) => ({
      ...f,
      user: f.userId ? userMap.get(f.userId) || null : null,
      userFlagCount: f.userId ? countMap.get(f.userId) || 0 : 0,
      companion: f.companionId ? compMap.get(f.companionId) || null : null,
    })),
  });
}));

aiCompanionsRouter.post("/admin/ai-companions-flags/:id/review", requireAdmin, asyncHandler(async (req, res) => {
  await prisma.aiCompanionFlag.update({ where: { id: req.params.id }, data: { reviewedAt: new Date() } });
  res.json({ ok: true });
}));

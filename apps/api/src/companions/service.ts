/**
 * Lógica de chat, memoria e imágenes de Acompañantes IA.
 */
import type { AiCompanion, AiCompanionChat, AiCompanionPlanTier } from "@prisma/client";
import sharp from "sharp";
import { prisma } from "../db";
import { savePrivate } from "../umate/privateStorage";
import {
  buildSystemPrompt,
  capIntensity,
  INTENSITIES,
  isPersonalityKey,
  safeDeflection,
  type IntensityKey,
  type PersonalityKey,
} from "./personas";
import { chatComplete, generateImage, isChatConfigured, maxChatIntensity, maxImageIntensity, type ChatMessage } from "./providers";
import { checkText, IMAGE_NEGATIVE_PROMPT, recordFlag } from "./safety";
import { refundTokens, TIER_LIMITS } from "./plans";

export function chatPersonality(chat: AiCompanionChat | null, companion: AiCompanion): PersonalityKey {
  if (chat?.personality && isPersonalityKey(chat.personality)) return chat.personality;
  return isPersonalityKey(companion.personality) ? companion.personality : "romantica";
}

async function loadMemories(userId: string, companionId: string, limit: number): Promise<string[]> {
  const rows = await prisma.aiCompanionMemory.findMany({
    where: { userId, companionId, kind: { in: ["FACT", "PREFERENCE"] } },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: { content: true },
  });
  return rows.map((r) => r.content);
}

/** Genera la respuesta del personaje al último mensaje guardado del usuario. */
export async function generateReply(params: {
  userId: string;
  tier: AiCompanionPlanTier;
  companion: AiCompanion;
  chat: AiCompanionChat;
}): Promise<{ content: string; deflected: boolean }> {
  const { userId, tier, companion, chat } = params;
  const limits = TIER_LIMITS[tier];

  const [memories, recent] = await Promise.all([
    loadMemories(userId, companion.id, limits.memoryLimit),
    prisma.aiCompanionMessage.findMany({
      where: { chatId: chat.id },
      orderBy: { createdAt: "desc" },
      take: limits.contextMessages,
      select: { role: true, content: true },
    }),
  ]);

  const intensity = capIntensity(chat.intensity, maxChatIntensity());
  const system = buildSystemPrompt({
    companion,
    personality: chatPersonality(chat, companion),
    intensity,
    userNickname: chat.userNickname,
    memories,
    summary: chat.summary,
  });

  const messages: ChatMessage[] = [
    { role: "system", content: system },
    ...recent.reverse().map((m) => ({
      role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
  ];

  const raw = await chatComplete(messages, { maxTokens: 450 });
  const check = checkText(raw, "chat_out");
  if (!check.ok) {
    await recordFlag({ userId, companionId: companion.id, source: "chat_out", reason: check.reason, text: raw });
    return { content: safeDeflection(companion.name), deflected: true };
  }
  return { content: raw, deflected: false };
}

/**
 * Memoria automática (Premium y VIP): cuando se acumulan suficientes mensajes
 * fuera del contexto, se resumen y se extraen datos del usuario. Corre en
 * segundo plano y nunca rompe el chat.
 */
export async function maybeUpdateMemory(params: {
  userId: string;
  tier: AiCompanionPlanTier;
  companion: AiCompanion;
  chatId: string;
}): Promise<void> {
  const limits = TIER_LIMITS[params.tier];
  if (!limits.autoMemory || !isChatConfigured()) return;

  try {
    const chat = await prisma.aiCompanionChat.findUnique({ where: { id: params.chatId } });
    if (!chat) return;

    const pending = await prisma.aiCompanionMessage.findMany({
      where: { chatId: chat.id, ...(chat.summarizedUntil ? { createdAt: { gt: chat.summarizedUntil } } : {}) },
      orderBy: { createdAt: "asc" },
      select: { role: true, content: true, createdAt: true },
    });
    // Sólo se resume lo que ya quedó fuera de la ventana de contexto.
    if (pending.length < limits.contextMessages * 2) return;
    const toSummarize = pending.slice(0, pending.length - limits.contextMessages);
    const until = toSummarize[toSummarize.length - 1].createdAt;

    const transcript = toSummarize
      .map((m) => `${m.role === "USER" ? "Usuario" : params.companion.name}: ${m.content}`)
      .join("\n")
      .slice(-12_000);

    const raw = await chatComplete(
      [
        {
          role: "system",
          content:
            "Eres un asistente que mantiene la memoria de una conversación de roleplay entre adultos. " +
            "Responde SOLO con JSON válido con la forma {\"summary\": string, \"facts\": string[]}. " +
            "summary: resumen breve (máx. 120 palabras) de lo ocurrido, combinando el resumen previo. " +
            "facts: hasta 5 datos nuevos y duraderos sobre el USUARIO (gustos, nombre, trabajo, preferencias), frases cortas en tercera persona. " +
            "Nunca guardes contraseñas, datos bancarios, direcciones exactas ni números de documento.",
        },
        {
          role: "user",
          content: `Resumen previo: ${chat.summary || "(ninguno)"}\n\nConversación:\n${transcript}`,
        },
      ],
      { maxTokens: 500, temperature: 0.2 },
    );

    const json = raw.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return;
    const parsed = JSON.parse(json) as { summary?: unknown; facts?: unknown };
    const summary = typeof parsed.summary === "string" ? parsed.summary.slice(0, 1500) : chat.summary;
    const facts = Array.isArray(parsed.facts)
      ? parsed.facts.filter((f): f is string => typeof f === "string" && f.trim().length > 2).map((f) => f.trim().slice(0, 200))
      : [];

    await prisma.aiCompanionChat.update({
      where: { id: chat.id },
      data: { summary, summarizedUntil: until },
    });

    if (facts.length) {
      const existing = await prisma.aiCompanionMemory.findMany({
        where: { userId: params.userId, companionId: params.companion.id },
        select: { content: true },
      });
      const room = Math.max(0, limits.memoryLimit - existing.length);
      const known = new Set(existing.map((e) => e.content.toLowerCase()));
      const fresh = facts.filter((f) => !known.has(f.toLowerCase()) && checkText(f, "chat_in").ok).slice(0, room);
      if (fresh.length) {
        await prisma.aiCompanionMemory.createMany({
          data: fresh.map((content) => ({
            userId: params.userId,
            companionId: params.companion.id,
            kind: "FACT" as const,
            source: "auto",
            content,
          })),
        });
      }
    }
  } catch (err) {
    console.error("[ai-companions] memoria automática falló", (err as Error)?.message);
  }
}

/**
 * Convierte el pedido del usuario (en español) en un prompt de imagen en inglés
 * anclado a la apariencia fija del personaje. Si no hay modelo de chat, usa el
 * pedido tal cual.
 */
async function buildImagePrompt(companion: AiCompanion, request: string, intensity: IntensityKey): Promise<string> {
  let scene = request;
  if (isChatConfigured()) {
    try {
      scene = await chatComplete(
        [
          {
            role: "system",
            content:
              "Convierte el pedido del usuario en una descripción breve en inglés (máx. 60 palabras) de la escena para un generador de imágenes fotorrealistas: " +
              "ropa, pose, lugar, iluminación y encuadre. No describas la cara ni el cuerpo del personaje (eso ya está definido). " +
              "Todas las personas son adultas. Responde sólo con la descripción.",
          },
          { role: "user", content: request },
        ],
        { maxTokens: 150, temperature: 0.4 },
      );
    } catch {
      scene = request;
    }
  }
  return [
    "photorealistic portrait photo, high detail, consistent character",
    companion.appearance,
    "clearly adult, mature features",
    scene,
    INTENSITIES[intensity].image,
  ].join(", ");
}

/** Genera una imagen ya cobrada. Si falla, devuelve los tokens. */
export async function runImageJob(imageId: string): Promise<void> {
  const image = await prisma.aiCompanionImage.findUnique({
    where: { id: imageId },
    include: { companion: true },
  });
  if (!image || image.status !== "PENDING") return;

  try {
    const intensity = capIntensity(image.intensity, maxImageIntensity());
    const prompt = await buildImagePrompt(image.companion, image.request, intensity);

    const check = checkText(prompt, "image");
    if (!check.ok) {
      await recordFlag({ userId: image.userId, companionId: image.companionId, source: "image", reason: check.reason, text: prompt });
      await prisma.aiCompanionImage.update({
        where: { id: image.id },
        data: { status: "BLOCKED", prompt, error: check.message },
      });
      await refundTokens({
        userId: image.userId,
        amount: image.tokensCharged,
        description: `Devolución: imagen bloqueada de ${image.companion.name}`,
        referenceId: image.id,
      });
      return;
    }

    const result = await generateImage({
      prompt,
      negativePrompt: IMAGE_NEGATIVE_PROMPT,
      seed: image.companion.imageSeed,
    });

    // Re-codificar valida que sea una imagen y quita metadatos.
    const webp = await sharp(result.buffer).rotate().webp({ quality: 88 }).toBuffer();
    const saved = await savePrivate({
      buffer: webp,
      originalName: "image.webp",
      mimeType: "image/webp",
      folder: "ai-companions",
    });

    await prisma.$transaction(async (tx) => {
      await tx.aiCompanionImage.update({
        where: { id: image.id },
        data: { status: "DONE", prompt, fileRef: saved.url, error: null },
      });
      const chat = await tx.aiCompanionChat.findUnique({
        where: { userId_companionId: { userId: image.userId, companionId: image.companionId } },
      });
      if (chat) {
        await tx.aiCompanionMessage.create({
          data: { chatId: chat.id, role: "ASSISTANT", content: "Aquí tienes lo que me pediste 😘", imageId: image.id },
        });
        await tx.aiCompanionChat.update({ where: { id: chat.id }, data: { lastMessageAt: new Date() } });
      }
    });
  } catch (err) {
    console.error("[ai-companions] generación de imagen falló", (err as Error)?.message);
    await prisma.aiCompanionImage.update({
      where: { id: image.id },
      data: { status: "FAILED", error: "No se pudo generar la imagen. Te devolvimos los tokens." },
    });
    await refundTokens({
      userId: image.userId,
      amount: image.tokensCharged,
      description: `Devolución: imagen fallida de ${image.companion.name}`,
      referenceId: image.id,
    });
  }
}

/** Al arrancar: imágenes que quedaron a medias por un reinicio se dan por fallidas y se devuelven. */
export async function recoverStaleImageJobs(): Promise<void> {
  try {
    const stale = await prisma.aiCompanionImage.findMany({
      where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - 10 * 60_000) } },
      include: { companion: { select: { name: true } } },
    });
    for (const img of stale) {
      const res = await prisma.aiCompanionImage.updateMany({
        where: { id: img.id, status: "PENDING" },
        data: { status: "FAILED", error: "La generación se interrumpió. Te devolvimos los tokens." },
      });
      if (res.count) {
        await refundTokens({
          userId: img.userId,
          amount: img.tokensCharged,
          description: `Devolución: imagen interrumpida de ${img.companion.name}`,
          referenceId: img.id,
        });
      }
    }
  } catch (err) {
    console.error("[ai-companions] recuperación de imágenes falló", err);
  }
}

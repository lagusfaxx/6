/**
 * High-level WhatsApp notification dispatcher.
 *
 * Used by the Prisma middleware on Notification.create and by the worker
 * (digest of pending messages, reminders). It loads the recipient's
 * opt-in flags, picks the right channel (free-form text inside the 24h
 * window, otherwise a pre-approved template if one is configured) and
 * sends fire-and-forget. All errors are logged but never thrown so the
 * caller's transaction never rolls back because of a delivery failure.
 */

import { prisma } from "../db";
import { config } from "../config";
import {
  bodyParams,
  defaultTemplateLang,
  isWhatsAppConfigured,
  normalizePhone,
  sendTemplate,
  sendText,
} from "./client";

/** 24h customer-service window from Meta. */
const SESSION_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Map a NotificationType (or arbitrary tag) → user preference key. */
type Channel = "events" | "messages" | "reminders";

function classify(notificationType: string): Channel {
  if (notificationType === "MESSAGE_RECEIVED") return "messages";
  if (notificationType.startsWith("REMINDER_")) return "reminders";
  return "events";
}

interface Recipient {
  whatsappNumber: string | null;
  whatsappOptIn: boolean;
  whatsappVerifiedAt: Date | null;
  whatsappEvents: boolean;
  whatsappMessages: boolean;
  whatsappReminders: boolean;
  whatsappLastInboundAt: Date | null;
  displayName: string | null;
}

async function loadRecipient(userId: string): Promise<Recipient | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      whatsappNumber: true,
      whatsappOptIn: true,
      whatsappVerifiedAt: true,
      whatsappEvents: true,
      whatsappMessages: true,
      whatsappReminders: true,
      whatsappLastInboundAt: true,
      displayName: true,
    },
  });
}

function channelEnabled(user: Recipient, channel: Channel): boolean {
  if (channel === "messages") return user.whatsappMessages;
  if (channel === "reminders") return user.whatsappReminders;
  return user.whatsappEvents;
}

/** True if the recipient messaged us in the last 24h, so free-form text is allowed. */
function insideSessionWindow(user: Recipient): boolean {
  if (!user.whatsappLastInboundAt) return false;
  return Date.now() - user.whatsappLastInboundAt.getTime() < SESSION_WINDOW_MS;
}

function appLink(url: string | undefined | null): string {
  const base = config.appUrl.replace(/\/$/, "");
  if (!url) return base;
  if (/^https?:\/\//i.test(url)) return url;
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}

function templateForType(notificationType: string): string | null {
  // Per-event templates can be overridden via env vars (e.g.
  // WHATSAPP_TEMPLATE_MESSAGE_RECEIVED=pending_messages_v1). Falls back to
  // WHATSAPP_TEMPLATE_DEFAULT, then null which means "skip template, try text".
  const key = `WHATSAPP_TEMPLATE_${notificationType}`;
  return process.env[key] || process.env.WHATSAPP_TEMPLATE_DEFAULT || null;
}

export interface WhatsAppPayload {
  type: string;
  title: string;
  body: string;
  url?: string;
  templateOverride?: string;
}

/**
 * Build the human-readable text we send when free-form messaging is allowed.
 * Format: bold title, body, then a CTA URL.
 */
function renderText(payload: WhatsAppPayload, displayName: string | null): string {
  const greeting = displayName ? `Hola ${displayName.split(" ")[0]}, ` : "";
  const cta = payload.url ? `\n\n${appLink(payload.url)}` : "";
  return `*${payload.title}*\n${greeting}${payload.body}${cta}`;
}

/**
 * Send a WhatsApp notification to the given user. Resolves to { ok, reason }
 * but never rejects.
 */
export async function notifyWhatsApp(
  userId: string,
  payload: WhatsAppPayload,
): Promise<{ ok: boolean; reason?: string }> {
  if (!isWhatsAppConfigured()) {
    return { ok: false, reason: "NOT_CONFIGURED" };
  }

  let user: Recipient | null;
  try {
    user = await loadRecipient(userId);
  } catch (err: any) {
    console.error("[whatsapp] failed to load recipient", { userId, err: err?.message });
    return { ok: false, reason: "DB_ERROR" };
  }
  if (!user) return { ok: false, reason: "USER_NOT_FOUND" };

  if (!user.whatsappOptIn || !user.whatsappVerifiedAt || !user.whatsappNumber) {
    return { ok: false, reason: "NOT_OPTED_IN" };
  }

  const channel = classify(payload.type);
  if (!channelEnabled(user, channel)) {
    return { ok: false, reason: "CHANNEL_DISABLED" };
  }

  const to = normalizePhone(user.whatsappNumber);
  if (!to) return { ok: false, reason: "INVALID_PHONE" };

  const text = renderText(payload, user.displayName);
  const inWindow = insideSessionWindow(user);
  const templateName = payload.templateOverride || templateForType(payload.type);

  // Inside the 24h window we prefer free-form text — it's instant, doesn't
  // need template approval, and renders Markdown.
  if (inWindow) {
    const result = await sendText(to, text);
    if (result.ok) return { ok: true };
    console.warn("[whatsapp] free-form send failed, will try template if available", {
      userId,
      reason: result.error,
      statusCode: result.statusCode,
    });
  }

  // Outside the window (or after a free-form failure) fall back to a template.
  if (templateName) {
    const result = await sendTemplate(
      to,
      templateName,
      [bodyParams(payload.title, payload.body, appLink(payload.url))],
      defaultTemplateLang(),
    );
    if (result.ok) return { ok: true };
    console.error("[whatsapp] template send failed", {
      userId,
      template: templateName,
      reason: result.error,
      statusCode: result.statusCode,
    });
    return { ok: false, reason: result.error };
  }

  return { ok: false, reason: inWindow ? "FREEFORM_FAILED" : "OUTSIDE_WINDOW_NO_TEMPLATE" };
}

/** Fire-and-forget — never throws and never blocks the caller. */
export function notifyWhatsAppAsync(userId: string, payload: WhatsAppPayload): void {
  notifyWhatsApp(userId, payload).catch((err) => {
    console.error("[whatsapp] notifyWhatsAppAsync unexpected error", { userId, err: err?.message });
  });
}

/** Mark that the user just messaged us — extends the 24h free-form window. */
export async function markInboundFromPhone(phoneE164: string): Promise<string | null> {
  const candidates = [phoneE164, `+${phoneE164}`];
  const user = await prisma.user.findFirst({
    where: { whatsappNumber: { in: candidates } },
    select: { id: true },
  });
  if (!user) return null;
  await prisma.user.update({
    where: { id: user.id },
    data: { whatsappLastInboundAt: new Date() },
  });
  return user.id;
}

import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { config } from "../config";
import {
  PAID_PROFILE_TYPES,
  getBillingSettings,
  graceEndsAt,
  hasPacCharge,
  isBillingEnforced,
  type BillingSettings,
} from "../lib/billingSettings";
import type { MailResult } from "../lib/mailer";
import { sendInAppAndPush } from "../lib/sendReminder";
import { getWhatsAppProvider, logDelivery, normalizePhoneForWhatsApp, sendWhatsAppNotification } from "../notifications/whatsapp";
import { mailEnabled, sendBillingNoticeEmail } from "./email";

/*
 * Avisos de "tu perfil está apagado" (sin plan vigente, no se muestra en el
 * sitio y la app queda bloqueada). Antes nadie les avisaba: si no entraban a
 * la app no se enteraban de que su perfil estaba oculto.
 *
 * Tres avisos por cada vez que se le apaga el perfil:
 *   1. Apenas se apaga: correo + WhatsApp + push.
 *   2. 3 días después del primero: correo + push.
 *   3. 7 días después del segundo: correo + WhatsApp + push (último).
 * Si paga y más adelante se le vuelve a apagar, la secuencia parte de nuevo.
 *
 * Correo por Resend (lib/mailer), WhatsApp por la Cloud API de Meta. Cada
 * envío queda en NotificationDelivery (canal EMAIL o WHATSAPP, tipo PLAN_OFF_n).
 * También se corre a mano desde /admin/cobros. Se apaga con PLAN_OFF_NOTICES=off.
 */

const DAY = 24 * 60 * 60 * 1000;
/** Perfiles apagados hace más de esto ya no reciben el primer aviso. */
const MAX_AGE_DAYS = 60;
const STEP_GAP_DAYS = { 2: 3, 3: 7 } as const;
const MAX_PER_TICK = 150;
const MAX_WHATSAPP_PER_TICK = 60;

function firstName(name: string | null | undefined, username: string): string {
  const n = String(name || "").trim().split(/\s+/)[0];
  return n || username;
}

type Step = 1 | 2 | 3;

function content(step: Step, o: { name: string; price: string; paidBefore: boolean; views: number; url: string }) {
  const why = o.paidBefore ? "se venció tu plan" : "se terminó tu prueba gratis";
  const views = o.views >= 30 ? o.views.toLocaleString("es-CL") : null;

  if (step === 1) {
    return {
      subject: "Tu perfil en UZEED está apagado",
      title: "Tu perfil está apagado",
      push: `Como ${why}, los clientes ya no te ven. Activa tu plan para volver a aparecer.`,
      email: [
        `Hola ${o.name}:`,
        `Como ${why}, tu perfil dejó de aparecer en UZEED. Los clientes no te pueden ver ni escribir.`,
        `Para volver a aparecer, activa tu plan (${o.price} al mes). Si lo pagas con tarjeta queda automático y no tienes que acordarte cada mes.`,
        `Actívalo acá: ${o.url}`,
        `Si tienes dudas, escríbenos desde ${o.url.replace(/\/pago$/, "/contacto")}.`,
      ],
      whatsapp: `tu perfil está apagado porque ${why} y los clientes ya no te ven. Actívalo en uzeed.cl/pago para volver a aparecer`,
    };
  }
  if (step === 2) {
    return {
      subject: "Tus clientes no te están encontrando",
      title: "Tu perfil sigue apagado",
      push: views
        ? `Tu perfil ya lleva ${views} visitas, pero hoy nadie lo puede ver. Actívalo y vuelve a aparecer.`
        : "Hoy nadie puede ver tu perfil. Actívalo y vuelve a aparecer.",
      email: [
        `Hola ${o.name}:`,
        views
          ? `Tu perfil ya lleva ${views} visitas en UZEED, pero desde que ${why} está apagado y nadie lo puede ver.`
          : `Desde que ${why}, tu perfil está apagado y nadie lo puede ver.`,
        `Lo activas en un minuto y vuelve a aparecer al tiro: ${o.url}`,
        `El plan cuesta ${o.price} al mes y lo puedes pagar con tarjeta, débito o transferencia.`,
      ],
      whatsapp: null,
    };
  }
  return {
    subject: "Último aviso: tu perfil sigue apagado",
    title: "Tu perfil sigue apagado",
    push: "Este es el último aviso. Cuando quieras volver, activa tu plan y tu perfil aparece al tiro.",
    email: [
      `Hola ${o.name}:`,
      "Tu perfil en UZEED sigue apagado. Este es el último aviso que te mandamos.",
      `Tus fotos y tus datos quedan guardados: cuando quieras volver, activas tu plan y apareces al tiro. ${o.url}`,
    ],
    whatsapp: "tu perfil sigue sin aparecer en UZEED. Tus datos quedan guardados: cuando quieras volver, actívalo en uzeed.cl/pago",
  };
}

/** Perfiles con el perfil apagado por falta de plan (mismo criterio que oculta el perfil del sitio). */
function planOffWhere(s: BillingSettings, now: Date): Prisma.UserWhereInput {
  const trialCutoff = new Date(now.getTime() - s.trialDays * DAY);
  // Escrito explícito por los NULL: `NOT (x > now)` descarta las filas sin fecha.
  return {
    profileType: { in: [...PAID_PROFILE_TYPES] },
    role: "USER",
    adminManaged: false,
    // Sólo perfiles que estuvieron publicados (no los que nunca se aprobaron).
    isActive: true,
    // Los que todavía no eligen su prueba reciben otros avisos (más abajo).
    ...(s.trialChoiceEnabled ? { needsTrialChoice: false } : {}),
    AND: [
      { OR: [{ membershipExpiresAt: null }, { membershipExpiresAt: { lte: now } }] },
      { OR: [{ shopTrialEndsAt: null }, { shopTrialEndsAt: { lte: now } }] },
      { createdAt: { lte: trialCutoff } },
    ],
  };
}

const offSelect = {
  id: true,
  email: true,
  phone: true,
  displayName: true,
  username: true,
  profileViews: true,
  createdAt: true,
  membershipExpiresAt: true,
  shopTrialEndsAt: true,
  flowSubscriptionId: true,
} as const;

type OffUser = Prisma.UserGetPayload<{ select: typeof offSelect }>;

/** Marca el aviso como enviado. Falso si ya estaba (otra pasada lo tomó): así nunca sale dos veces. */
async function claim(userId: string, type: string): Promise<boolean> {
  try {
    await prisma.reminderLog.create({ data: { userId, type } });
    return true;
  } catch {
    return false;
  }
}

async function logEmail(userId: string, type: string, result: MailResult) {
  await prisma.notificationDelivery
    .create({
      data: {
        userId,
        channel: "EMAIL",
        type,
        ok: result.ok,
        error: result.ok ? null : String(result.reason || "ERROR").slice(0, 300),
      },
    })
    .catch((err: any) => console.error("[plan-off] email log failed:", err?.message || err));
}

async function paidBefore(u: OffUser): Promise<boolean> {
  const n = await prisma.paymentIntent.count({
    where: { subscriberId: u.id, purpose: { in: ["MEMBERSHIP_PLAN", "SHOP_PLAN"] }, status: "PAID" },
  });
  return n > 0 || (u.flowSubscriptionId ? await hasPacCharge(u.id, u.flowSubscriptionId) : false);
}

export type NoticeRunSummary = {
  ran: boolean;
  reason?: string;
  avisos: number;
  correos: { ok: number; fallidos: number };
  whatsapp: { ok: number; fallidos: number };
  sinCorreo: number;
  sinWhatsapp: number;
  eligePrueba: number;
};

function emptySummary(reason?: string): NoticeRunSummary {
  return {
    ran: !reason,
    ...(reason ? { reason } : {}),
    avisos: 0,
    correos: { ok: 0, fallidos: 0 },
    whatsapp: { ok: 0, fallidos: 0 },
    sinCorreo: 0,
    sinWhatsapp: 0,
    eligePrueba: 0,
  };
}

async function sendStep(
  u: OffUser,
  step: Step,
  tag: string,
  ctx: { price: string; url: string; canEmail: boolean; canWhatsApp: boolean; allowWhatsApp: boolean },
  summary: NoticeRunSummary,
  channels: { push: boolean; email: boolean; whatsapp: boolean } = { push: true, email: true, whatsapp: true },
) {
  const name = firstName(u.displayName, u.username);
  const c = content(step, { name, price: ctx.price, paidBefore: await paidBefore(u), views: u.profileViews, url: ctx.url });

  if (channels.push) {
    await sendInAppAndPush(u.id, { type: "SUBSCRIPTION_RENEWED", title: c.title, body: c.push, url: "/pago", tag }).catch(
      () => undefined,
    );
  }

  if (channels.email) {
    if (ctx.canEmail && u.email) {
      const result = await sendBillingNoticeEmail(u.email, {
        subject: c.subject,
        title: c.title,
        text: c.email.join("\n\n"),
        ctaText: "Activar mi plan",
      });
      await logEmail(u.id, `PLAN_OFF_${step}`, result);
      if (result.ok) summary.correos.ok++;
      else summary.correos.fallidos++;
    } else {
      summary.sinCorreo++;
    }
  }

  if (channels.whatsapp && c.whatsapp) {
    if (ctx.canWhatsApp && ctx.allowWhatsApp && normalizePhoneForWhatsApp(u.phone)) {
      const result = await sendWhatsAppNotification(u.phone!, name, c.whatsapp).catch((err: any) => ({
        ok: false,
        error: String(err?.message || err),
      }));
      await logDelivery(prisma, { userId: u.id, channel: "WHATSAPP", type: `PLAN_OFF_${step}`, result });
      if (result.ok) summary.whatsapp.ok++;
      else summary.whatsapp.fallidos++;
    } else {
      summary.sinWhatsapp++;
    }
  }
}

/**
 * Una pasada de avisos: la corre el worker cada hora y el botón "Enviar avisos
 * ahora" de /admin/cobros. Manda a cada perfil apagado el aviso que le toque.
 */
export async function tickPlanOffNotices(): Promise<NoticeRunSummary> {
  if (process.env.PLAN_OFF_NOTICES === "off") return emptySummary("Los avisos están apagados (PLAN_OFF_NOTICES=off).");
  const s = await getBillingSettings(true);
  const now = new Date();
  if (!s.enabled) return emptySummary("El cobro está apagado: no hay perfiles apagados por falta de pago.");
  if (!isBillingEnforced(s, now)) return emptySummary("El cobro está en periodo de gracia: todavía no se apaga ningún perfil.");

  const users = await prisma.user.findMany({
    where: planOffWhere(s, now),
    select: offSelect,
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const grace = graceEndsAt(s);
  const ctx = {
    price: `$${s.priceClp.toLocaleString("es-CL")}`,
    url: `${config.appUrl.replace(/\/$/, "")}/pago`,
    canEmail: mailEnabled(),
    canWhatsApp: getWhatsAppProvider() !== null,
    allowWhatsApp: true,
  };
  const summary = emptySummary();
  let whatsapps = 0;

  for (const u of users) {
    if (summary.avisos >= MAX_PER_TICK) break;
    // Cuándo se apagó: el mayor entre membresía, prueba y gracia general.
    const end = new Date(
      Math.max(
        u.membershipExpiresAt?.getTime() ?? 0,
        u.shopTrialEndsAt?.getTime() ?? 0,
        u.createdAt.getTime() + s.trialDays * DAY,
        grace?.getTime() ?? 0,
      ),
    );
    if (end.getTime() > now.getTime()) continue;
    const endKey = end.toISOString().slice(0, 10);
    const keys = { 1: `plan_off_1_${endKey}`, 2: `plan_off_2_${endKey}`, 3: `plan_off_3_${endKey}` } as const;
    const logs = await prisma.reminderLog.findMany({
      where: { userId: u.id, type: { in: Object.values(keys) } },
      select: { type: true, createdAt: true },
    });
    const at = (step: Step) => logs.find((l) => l.type === keys[step])?.createdAt ?? null;

    let step: Step | null = null;
    if (!at(1)) {
      if (now.getTime() - end.getTime() <= MAX_AGE_DAYS * DAY) step = 1;
    } else if (!at(2)) {
      if (now.getTime() - at(1)!.getTime() >= STEP_GAP_DAYS[2] * DAY) step = 2;
    } else if (!at(3)) {
      if (now.getTime() - at(2)!.getTime() >= STEP_GAP_DAYS[3] * DAY) step = 3;
    }
    if (!step) continue;
    if (!(await claim(u.id, keys[step]))) continue;
    summary.avisos++;

    const wantsWhatsApp = Boolean(content(step, { name: "", price: "", paidBefore: false, views: 0, url: "" }).whatsapp);
    await sendStep(u, step, keys[step], { ...ctx, allowWhatsApp: whatsapps < MAX_WHATSAPP_PER_TICK }, summary);
    if (wantsWhatsApp) whatsapps++;
  }

  if (summary.avisos) console.log("[worker] plan off notices", JSON.stringify(summary));

  if (s.trialChoiceEnabled) {
    summary.eligePrueba = await tickTrialChoiceNotices(s.trialDays, Math.max(s.cardTrialDays, s.trialDays), ctx.price, ctx.canEmail, ctx.canWhatsApp);
  }
  return summary;
}

/**
 * Reenvía el correo del primer aviso a quienes lo recibieron por WhatsApp y
 * en la app pero no por correo (hasta el 6/11 los correos de cobro salían
 * sólo por SMTP, que no está configurado, así que no salió ninguno).
 */
export async function resendMissingPlanOffEmails(): Promise<NoticeRunSummary> {
  const s = await getBillingSettings(true);
  const now = new Date();
  if (!s.enabled || !isBillingEnforced(s, now)) return emptySummary("El cobro no está apagando perfiles ahora.");
  if (!mailEnabled()) return emptySummary("El correo no está configurado (falta RESEND_API_KEY).");

  const pending = await pendingEmailUsers(s, now);
  const ctx = { price: `$${s.priceClp.toLocaleString("es-CL")}`, url: `${config.appUrl.replace(/\/$/, "")}/pago`, canEmail: true, canWhatsApp: false, allowWhatsApp: false };
  const summary = emptySummary();
  for (const { user, step } of pending.slice(0, 300)) {
    if (!(await claim(user.id, `plan_off_email_${step}_${now.toISOString().slice(0, 10)}`))) continue;
    summary.avisos++;
    await sendStep(user, step, `plan_off_email_${step}`, ctx, summary, { push: false, email: true, whatsapp: false });
  }
  return summary;
}

/** Perfiles todavía apagados a los que se les mandó un aviso pero el correo de ese aviso no salió. */
async function pendingEmailUsers(s: BillingSettings, now: Date): Promise<{ user: OffUser; step: Step }[]> {
  const users = await prisma.user.findMany({ where: { ...planOffWhere(s, now), email: { not: "" } }, select: offSelect, take: 1000 });
  if (!users.length) return [];
  const ids = users.map((u) => u.id);
  const [logs, emails] = await Promise.all([
    prisma.reminderLog.findMany({
      where: { userId: { in: ids }, type: { startsWith: "plan_off_" }, NOT: { type: { startsWith: "plan_off_email_" } } },
      select: { userId: true, type: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.notificationDelivery.findMany({
      where: { userId: { in: ids }, channel: "EMAIL", ok: true, type: { startsWith: "PLAN_OFF_" } },
      select: { userId: true, type: true },
    }),
  ]);
  const gotEmail = new Set(emails.map((e) => `${e.userId}:${e.type}`));
  const out: { user: OffUser; step: Step }[] = [];
  for (const u of users) {
    // El último aviso que se le mandó: si ese correo no salió, se reenvía.
    const last = logs.find((l) => l.userId === u.id);
    if (!last) continue;
    const step = Number(last.type.split("_")[2]) as Step;
    if (![1, 2, 3].includes(step)) continue;
    if (!gotEmail.has(`${u.id}:PLAN_OFF_${step}`)) out.push({ user: u, step });
  }
  return out;
}

/** Números para la sección de avisos de /admin/cobros. */
export async function planOffNoticeStats() {
  const s = await getBillingSettings(true);
  const now = new Date();
  const active = s.enabled && isBillingEnforced(s, now) && process.env.PLAN_OFF_NOTICES !== "off";
  const since = new Date(now.getTime() - 60 * DAY);
  const [apagados, porPaso, entregas, pendientes] = await Promise.all([
    s.enabled && isBillingEnforced(s, now) ? prisma.user.count({ where: planOffWhere(s, now) }) : Promise.resolve(0),
    prisma.reminderLog.groupBy({
      by: ["type"],
      where: { type: { startsWith: "plan_off_" }, NOT: { type: { startsWith: "plan_off_email_" } }, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.notificationDelivery.groupBy({
      by: ["channel", "ok"],
      where: { type: { startsWith: "PLAN_OFF_" }, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    s.enabled && isBillingEnforced(s, now) && mailEnabled() ? pendingEmailUsers(s, now).then((p) => p.length) : Promise.resolve(0),
  ]);
  const step = (n: number) =>
    porPaso.filter((r) => r.type.startsWith(`plan_off_${n}_`)).reduce((acc, r) => acc + r._count._all, 0);
  const count = (channel: string, ok: boolean) =>
    entregas.find((e) => e.channel === channel && e.ok === ok)?._count._all ?? 0;
  return {
    activo: active,
    motivo: !s.enabled ? "cobro apagado" : !isBillingEnforced(s, now) ? "en periodo de gracia" : process.env.PLAN_OFF_NOTICES === "off" ? "PLAN_OFF_NOTICES=off" : null,
    correoConfigurado: mailEnabled(),
    whatsappConfigurado: getWhatsAppProvider() !== null,
    perfilesApagados: apagados,
    avisos: { primero: step(1), segundo: step(2), tercero: step(3) },
    correos: { ok: count("EMAIL", true), fallidos: count("EMAIL", false) },
    whatsapp: { ok: count("WHATSAPP", true), fallidos: count("WHATSAPP", false) },
    correosPendientes: pendientes,
  };
}

/*
 * Perfil creado que no eligió cómo empezar su prueba (con tarjeta o sin
 * tarjeta): está apagado. Dos recordatorios, al día siguiente del registro y
 * 3 días después del primero. La app igual se lo pide cada vez que entra.
 */
async function tickTrialChoiceNotices(
  trialDays: number,
  cardTrialDays: number,
  price: string,
  canEmail: boolean,
  canWhatsApp: boolean,
): Promise<number> {
  const now = new Date();
  const users = await prisma.user.findMany({
    where: {
      profileType: { in: [...PAID_PROFILE_TYPES] },
      role: "USER",
      adminManaged: false,
      needsTrialChoice: true,
      OR: [{ membershipExpiresAt: null }, { membershipExpiresAt: { lte: now } }],
      createdAt: { lte: new Date(now.getTime() - DAY), gte: new Date(now.getTime() - MAX_AGE_DAYS * DAY) },
    },
    select: { id: true, email: true, phone: true, displayName: true, username: true },
    orderBy: { createdAt: "desc" },
    take: MAX_PER_TICK,
  });
  const url = `${config.appUrl.replace(/\/$/, "")}/pago`;
  const bonus = cardTrialDays > trialDays;
  let sent = 0;

  for (const u of users) {
    const logs = await prisma.reminderLog.findMany({
      where: { userId: u.id, type: { in: ["trial_choice_1", "trial_choice_2"] } },
      select: { type: true, createdAt: true },
    });
    const first = logs.find((l) => l.type === "trial_choice_1");
    const second = logs.find((l) => l.type === "trial_choice_2");
    const step = !first ? 1 : !second && now.getTime() - first.createdAt.getTime() >= 3 * DAY ? 2 : null;
    if (!step) continue;
    if (!(await claim(u.id, `trial_choice_${step}`))) continue;
    sent++;

    const name = firstName(u.displayName, u.username);
    const offer = bonus
      ? `Con tarjeta tienes ${cardTrialDays} días gratis (hoy no se cobra nada) y sin tarjeta ${trialDays}.`
      : `Tienes ${trialDays} días gratis.`;
    const title = step === 1 ? "Activa tu perfil" : "Tu perfil sigue apagado";
    const body = `Tu perfil ya está creado, pero no aparece hasta que elijas cómo empezar tu prueba gratis. ${offer}`;

    await sendInAppAndPush(u.id, { type: "SUBSCRIPTION_RENEWED", title, body, url: "/pago", tag: `trial_choice_${step}` }).catch(
      () => undefined,
    );
    if (canEmail && u.email) {
      const result = await sendBillingNoticeEmail(u.email, {
        subject: step === 1 ? "Falta un paso para que tu perfil aparezca en UZEED" : "Tu perfil en UZEED sigue apagado",
        title,
        ctaText: "Elegir mi prueba",
        text: [
          `Hola ${name}:`,
          "Tu perfil ya está creado, pero no aparece en UZEED hasta que elijas cómo empezar tu prueba gratis.",
          bonus
            ? `Si registras tu tarjeta tienes ${cardTrialDays} días gratis. Hoy no se cobra nada: el primer cobro de ${price} es al terminar la prueba y puedes cancelar antes. Si prefieres no dejar tarjeta, tienes ${trialDays} días gratis.`
            : `Tienes ${trialDays} días gratis.`,
          `Elige acá: ${url}`,
        ].join("\n\n"),
      });
      await logEmail(u.id, `TRIAL_CHOICE_${step}`, result);
    }
    if (step === 1 && canWhatsApp && normalizePhoneForWhatsApp(u.phone)) {
      const info = bonus
        ? `tu perfil ya está creado pero no aparece hasta que elijas tu prueba gratis: ${cardTrialDays} días con tarjeta o ${trialDays} sin tarjeta. Elige en uzeed.cl/pago`
        : `tu perfil ya está creado pero no aparece hasta que actives tu prueba gratis en uzeed.cl/pago`;
      const result = await sendWhatsAppNotification(u.phone!, name, info).catch((err: any) => ({
        ok: false,
        error: String(err?.message || err),
      }));
      await logDelivery(prisma, { userId: u.id, channel: "WHATSAPP", type: "TRIAL_CHOICE_1", result });
    }
  }
  return sent;
}

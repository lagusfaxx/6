import { prisma } from "../db";
import { config } from "../config";
import {
  PAID_PROFILE_TYPES,
  getBillingSettings,
  graceEndsAt,
  hasPacCharge,
  isBillingEnforced,
} from "../lib/billingSettings";
import { sendInAppAndPush } from "../lib/sendReminder";
import {
  getWhatsAppProvider,
  logDelivery,
  normalizePhoneForWhatsApp,
  saveRelay,
  sendWhatsAppNotification,
} from "../notifications/whatsapp";
import { sendBillingNoticeEmail, smtpEnabled } from "./email";

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
 * Se apaga con PLAN_OFF_NOTICES=off.
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
        "Si tienes dudas, responde este correo.",
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

export async function tickPlanOffNotices() {
  if (process.env.PLAN_OFF_NOTICES === "off") return;
  const s = await getBillingSettings();
  const now = new Date();
  if (!s.enabled || !isBillingEnforced(s, now)) return;

  const trialCutoff = new Date(now.getTime() - s.trialDays * DAY);
  // Mismo criterio que oculta el perfil del sitio (planActiveWhere), escrito
  // explícito por los NULL: `NOT (x > now)` descarta las filas sin fecha.
  const users = await prisma.user.findMany({
    where: {
      profileType: { in: [...PAID_PROFILE_TYPES] },
      role: "USER",
      adminManaged: false,
      // Sólo perfiles que estuvieron publicados (no los que nunca se aprobaron).
      isActive: true,
      // Los que todavía no eligen su prueba reciben los avisos de abajo.
      ...(s.trialChoiceEnabled ? { needsTrialChoice: false } : {}),
      AND: [
        { OR: [{ membershipExpiresAt: null }, { membershipExpiresAt: { lte: now } }] },
        { OR: [{ shopTrialEndsAt: null }, { shopTrialEndsAt: { lte: now } }] },
        { createdAt: { lte: trialCutoff } },
      ],
    },
    select: {
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
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const grace = graceEndsAt(s);
  const price = `$${s.priceClp.toLocaleString("es-CL")}`;
  const url = `${config.appUrl.replace(/\/$/, "")}/pago`;
  const canWhatsApp = getWhatsAppProvider() !== null;
  const canEmail = smtpEnabled();
  let sent = 0;
  let whatsapps = 0;

  for (const u of users) {
    if (sent >= MAX_PER_TICK) break;
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

    // Se marca antes de enviar: si algo falla a medias no se repite el aviso.
    await prisma.reminderLog.create({ data: { userId: u.id, type: keys[step] } }).catch(() => null);
    sent++;

    const paidBefore =
      (await prisma.paymentIntent.count({
        where: { subscriberId: u.id, purpose: { in: ["MEMBERSHIP_PLAN", "SHOP_PLAN"] }, status: "PAID" },
      })) > 0 || (u.flowSubscriptionId ? await hasPacCharge(u.id, u.flowSubscriptionId) : false);
    const name = firstName(u.displayName, u.username);
    const c = content(step, { name, price, paidBefore, views: u.profileViews, url });

    await sendInAppAndPush(u.id, {
      type: "SUBSCRIPTION_RENEWED",
      title: c.title,
      body: c.push,
      url: "/pago",
      tag: keys[step],
    }).catch(() => undefined);

    if (canEmail && u.email) {
      await sendBillingNoticeEmail(u.email, { subject: c.subject, text: c.email.join("\n\n") }).catch(() => undefined);
    }

    if (c.whatsapp && canWhatsApp && whatsapps < MAX_WHATSAPP_PER_TICK && normalizePhoneForWhatsApp(u.phone)) {
      whatsapps++;
      const result = await sendWhatsAppNotification(u.phone!, name, c.whatsapp).catch((err: any) => ({
        ok: false,
        error: String(err?.message || err),
      }));
      await logDelivery(prisma, { userId: u.id, channel: "WHATSAPP", type: `PLAN_OFF_${step}`, result });
      // Si responde (o salta su respuesta automática), que no caiga en su último chat.
      await relayNotice(u.id, u.phone!, result, `PLAN_OFF_${step}`);
    }
  }

  if (sent) console.log(`[worker] plan off notices sent: ${sent} (whatsapp: ${whatsapps})`);

  if (s.trialChoiceEnabled) await tickTrialChoiceNotices(s.trialDays, Math.max(s.cardTrialDays, s.trialDays), price, canEmail, canWhatsApp);
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
) {
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

  for (const u of users) {
    const logs = await prisma.reminderLog.findMany({
      where: { userId: u.id, type: { in: ["trial_choice_1", "trial_choice_2"] } },
      select: { type: true, createdAt: true },
    });
    const first = logs.find((l) => l.type === "trial_choice_1");
    const second = logs.find((l) => l.type === "trial_choice_2");
    const step = !first ? 1 : !second && now.getTime() - first.createdAt.getTime() >= 3 * DAY ? 2 : null;
    if (!step) continue;
    await prisma.reminderLog.create({ data: { userId: u.id, type: `trial_choice_${step}` } }).catch(() => null);

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
      await sendBillingNoticeEmail(u.email, {
        subject: step === 1 ? "Falta un paso para que tu perfil aparezca en UZEED" : "Tu perfil en UZEED sigue apagado",
        text: [
          `Hola ${name}:`,
          "Tu perfil ya está creado, pero no aparece en UZEED hasta que elijas cómo empezar tu prueba gratis.",
          bonus
            ? `Si registras tu tarjeta tienes ${cardTrialDays} días gratis. Hoy no se cobra nada: el primer cobro de ${price} es al terminar la prueba y puedes cancelar antes. Si prefieres no dejar tarjeta, tienes ${trialDays} días gratis.`
            : `Tienes ${trialDays} días gratis.`,
          `Elige acá: ${url}`,
        ].join("\n\n"),
      }).catch(() => undefined);
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
      await relayNotice(u.id, u.phone!, result, "TRIAL_CHOICE_1");
    }
  }
}

/** Registra el aviso como "no es un chat" para enrutar bien una respuesta. */
async function relayNotice(userId: string, phone: string, result: { ok: boolean; messageId?: string }, kind: string) {
  const to = normalizePhoneForWhatsApp(phone);
  if (!result.ok || !to || getWhatsAppProvider() !== "cloud") return;
  await saveRelay(prisma, result.messageId, userId, null, to, kind);
}

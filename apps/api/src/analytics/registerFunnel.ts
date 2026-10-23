import { Router } from "express";
import rateLimit from "express-rate-limit";
import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { BOT_UA_PATTERN, organicSignupWhere, staffIdsSql } from "../lib/statsFilters";
import { chileToday } from "../lib/chileTime";
import { deviceFromUserAgent } from "./routes";

/**
 * Embudo del registro (clientes, profesionales, locales y tiendas).
 *
 * El formulario manda eventos `reg_*` (ver apps/web/lib/registerFunnel.ts) que
 * se guardan en UserAction. El reporte agrupa por persona (visitorId, que dura
 * entre pestañas; si falta, sessionId) y tipo de cuenta: hasta qué etapa llegó
 * cada una, qué errores vio, si se fue después de verlos y, de las que no
 * terminaron, cuál fue el último campo que tocaron.
 *
 * Sólo lee y escribe UserAction (y lee PageView para el dispositivo y la
 * fuente): no toca el registro en sí.
 */
export const registerFunnelRouter = Router();

const FUNNEL_ACTIONS = new Set([
  "reg_view",
  "reg_type",
  "reg_step",
  "reg_field",
  "reg_error",
  "reg_submit",
  "reg_verify",
  "reg_verified",
  "reg_done",
  "reg_fail",
]);

const FLOWS = new Set(["CLIENT", "PROFESSIONAL", "ESTABLISHMENT", "SHOP"]);

const BOT_UA = new RegExp(BOT_UA_PATTERN, "i");

/* Limitador propio: un registro completo manda unos 25-30 eventos y no debe
   gastar el cupo de las vistas de página y los clicks de WhatsApp. */
const funnelLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 150,
  message: { error: "TOO_MANY_REQUESTS" },
  standardHeaders: true,
  legacyHeaders: false,
});

function clientId(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9-]{8,64}$/.test(value) ? value : null;
}

function shortText(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim().replace(/[\u0000-\u001f]/g, "");
  return t ? t.slice(0, max) : undefined;
}

function osFromUserAgent(ua: string): string {
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac";
  if (/Linux|CrOS/i.test(ua)) return "Linux";
  return "Otro";
}

/** Los navegadores dentro de apps (Instagram, Facebook, TikTok) suelen fallar
 *  al subir fotos: por eso se separan de Safari/Chrome. */
function browserFromUserAgent(ua: string): string {
  if (/Instagram/i.test(ua)) return "Instagram (in-app)";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "Facebook (in-app)";
  if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) return "TikTok (in-app)";
  if (/SamsungBrowser/i.test(ua)) return "Samsung Internet";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/OPR\/|Opera/i.test(ua)) return "Opera";
  if (/FxiOS|Firefox/i.test(ua)) return "Firefox";
  if (/CriOS|Chrome/i.test(ua)) return "Chrome";
  if (/Safari/i.test(ua)) return "Safari";
  return "Otro";
}

registerFunnelRouter.post(
  "/analytics/register-funnel",
  funnelLimiter,
  asyncHandler(async (req, res) => {
    const { action, metadata, sessionId, visitorId } = req.body ?? {};
    if (typeof action !== "string" || !FUNNEL_ACTIONS.has(action)) {
      return res.status(400).json({ error: "action invalid" });
    }
    const ua = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : "";
    // Bots que ejecutan JS: no son personas registrándose.
    if (ua && BOT_UA.test(ua)) return res.json({ ok: true });

    const m = (metadata && typeof metadata === "object" ? metadata : {}) as Record<string, unknown>;
    const flow = typeof m.flow === "string" && FLOWS.has(m.flow) ? m.flow : null;
    const step =
      typeof m.step === "number" && Number.isFinite(m.step)
        ? Math.trunc(m.step)
        : shortText(m.step, 20);
    // Sólo nombres de campo y mensajes de error: nunca valores escritos.
    const clean = {
      flow,
      ...(step !== undefined ? { step } : {}),
      ...(shortText(m.field, 40) ? { field: shortText(m.field, 40) } : {}),
      ...(shortText(m.message, 160) ? { message: shortText(m.message, 160) } : {}),
      ...(m.google === true ? { google: true } : {}),
      ...(ua
        ? {
            device: deviceFromUserAgent(ua),
            os: osFromUserAgent(ua),
            browser: browserFromUserAgent(ua),
          }
        : {}),
    };

    await prisma.userAction.create({
      data: {
        action,
        userId: req.session?.userId || null,
        sessionId: clientId(sessionId),
        visitorId: clientId(visitorId),
        metadata: clean,
      },
    });
    res.json({ ok: true });
  }),
);

/* ─── Reporte ─── */

type Stage = { key: string; label: string };

const FORM_STAGES: Stage[] = [
  { key: "type", label: "Eligió tipo de cuenta" },
  { key: "started", label: "Empezó a llenar" },
  { key: "submit", label: "Envió el formulario" },
  { key: "verify", label: "Pantalla del código" },
  { key: "verified", label: "Código verificado" },
  { key: "done", label: "Cuenta creada" },
];

const PRO_STAGES: Stage[] = [
  { key: "type", label: "Eligió tipo de cuenta" },
  { key: "started", label: "Paso 1 · Cuenta (empezó a llenar)" },
  { key: "step2", label: "Paso 2 · Sobre ti" },
  { key: "step3", label: "Paso 3 · Fotos" },
  { key: "step4", label: "Paso 4 · Tu chat" },
  { key: "step5", label: "Paso 5 · Ubicación" },
  { key: "submit", label: "Envió el formulario" },
  { key: "verify", label: "Pantalla del código" },
  { key: "verified", label: "Código verificado" },
  { key: "done", label: "Cuenta creada" },
];

function stagesFor(flow: string): Stage[] {
  return flow === "PROFESSIONAL" ? PRO_STAGES : FORM_STAGES;
}

/** Índice de etapa que representa un evento (-1 si no avanza el embudo). */
function stageIndex(flow: string, action: string, meta: Record<string, unknown>): number {
  const keys = stagesFor(flow).map((s) => s.key);
  const at = (k: string) => keys.indexOf(k);
  switch (action) {
    case "reg_type":
      return at("type");
    case "reg_field":
      return at("started");
    case "reg_step": {
      const n = Number(meta.step);
      if (flow === "PROFESSIONAL" && n >= 2 && n <= 5) return at(`step${n}`);
      return -1;
    }
    case "reg_submit":
    case "reg_fail":
      return at("submit");
    case "reg_verify":
      return at("verify");
    case "reg_verified":
      return at("verified");
    case "reg_done":
      return at("done");
    default:
      return -1;
  }
}

/** Una persona sin eventos en 30 min se da por abandonada; antes, "en curso". */
const IDLE_MS = 30 * 60 * 1000;

/** "Failed to fetch" (Chrome), "Load failed" (Safari) y "NetworkError" (Firefox)
 *  son el mismo corte de red: se agrupan en una sola fila. */
const NETWORK_ERROR = /failed to fetch|load failed|networkerror|network request failed|se cortó la conexión/i;
const NETWORK_LABEL = "Se cortó la conexión (Failed to fetch / Load failed)";

function normalizeMessage(msg: string): string {
  return NETWORK_ERROR.test(msg) ? NETWORK_LABEL : msg;
}

type Env = { device: string; os: string; browser: string; source: string };

type Person = {
  firstAt: number;
  lastAt: number;
  doneAt: number | null;
  maxStage: number;
  /** Primer instante en que llegó a cada etapa (para tiempos entre etapas). */
  stageAt: Map<number, number>;
  lastAction: string;
  lastField: string | null;
  lastFailMessage: string | null;
  google: boolean;
  fields: Set<string>;
  errorKeys: Set<string>;
  sessionIds: Set<string>;
  env: Partial<Env>;
};

function bump(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function sortedEntries<T>(map: Map<string, T>, value: (v: T) => number, limit = 50) {
  return [...map.entries()].sort((a, b) => value(b[1]) - value(a[1])).slice(0, limit);
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

function sourceFrom(referrer: string | null, utmSource: string | null): string {
  if (utmSource) return utmSource.toLowerCase();
  if (!referrer) return "directo";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "").toLowerCase();
    if (host.endsWith("uzeed.cl")) return "directo";
    if (host.includes("google")) return "google";
    if (host.includes("instagram")) return "instagram";
    if (host.includes("facebook") || host === "fb.com" || host.endsWith(".fb.com")) return "facebook";
    if (host.includes("tiktok")) return "tiktok";
    if (host === "t.co" || host.includes("twitter") || host === "x.com") return "x / twitter";
    if (host.includes("whatsapp") || host === "wa.me") return "whatsapp";
    if (host.includes("bing")) return "bing";
    return host;
  } catch {
    return "directo";
  }
}

registerFunnelRouter.get(
  "/admin/register-funnel",
  asyncHandler(async (req, res) => {
    // Igual que /admin/analytics: administrador y equipo, sólo lectura.
    if (!req.session?.userId) return res.status(401).json({ error: "UNAUTHENTICATED" });
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { role: true },
    });
    if (user?.role !== "ADMIN" && user?.role !== "MODERATOR") {
      return res.status(403).json({ error: "FORBIDDEN" });
    }

    const now = Date.now();
    const period = ["24h", "7d", "30d", "90d"].includes(String(req.query.period))
      ? String(req.query.period)
      : "7d";
    const days = period === "24h" ? 1 : period === "30d" ? 30 : period === "90d" ? 90 : 7;
    const since = new Date(now - days * 24 * 60 * 60 * 1000);

    const [events, createdByType, staffVisitors] = await Promise.all([
      prisma.userAction.findMany({
        where: { action: { startsWith: "reg_" }, createdAt: { gte: since } },
        select: {
          sessionId: true,
          visitorId: true,
          userId: true,
          action: true,
          metadata: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
        take: 300_000,
      }),
      // Cuentas que de verdad se crearon en el periodo, para contrastar. Sin
      // perfiles de prueba, sin el equipo y sin las altas que carga el admin.
      prisma.user.groupBy({
        by: ["profileType"],
        where: { AND: [{ createdAt: { gte: since } }, organicSignupWhere()] },
        _count: { id: true },
      }),
      // Navegadores del equipo: cuando el admin prueba el registro no es una
      // persona real abandonando.
      prisma.$queryRaw<{ visitorId: string }[]>(Prisma.sql`
        SELECT DISTINCT "visitorId" FROM "PageView"
        WHERE "visitorId" IS NOT NULL
          AND "userId" IN ${staffIdsSql()}
          AND "createdAt" >= ${new Date(since.getTime() - 30 * 24 * 60 * 60 * 1000)}
      `),
    ]);

    const staff = new Set(staffVisitors.map((r) => r.visitorId));
    const staffUsers = new Set(
      (
        await prisma.user.findMany({
          where: { role: { in: ["ADMIN", "MODERATOR"] } },
          select: { id: true },
        })
      ).map((u) => u.id),
    );

    const viewers = new Set<string>();
    const flowPeople = new Set<string>();
    const people = new Map<string, Map<string, Person>>(); // flow -> persona -> estado
    /** flow -> "paso|campo|mensaje" -> { veces, personas } */
    const errors = new Map<string, Map<string, { events: number; people: Set<string> }>>();

    for (const ev of events) {
      if (ev.visitorId && staff.has(ev.visitorId)) continue;
      if (ev.userId && staffUsers.has(ev.userId)) continue;
      const key = ev.visitorId || ev.sessionId;
      if (!key) continue;
      const meta = (ev.metadata ?? {}) as Record<string, unknown>;
      if (ev.action === "reg_view") {
        viewers.add(key);
        continue;
      }
      const flow = typeof meta.flow === "string" && FLOWS.has(meta.flow) ? meta.flow : null;
      if (!flow) continue;
      flowPeople.add(key);

      let byFlow = people.get(flow);
      if (!byFlow) people.set(flow, (byFlow = new Map()));
      let p = byFlow.get(key);
      const at = ev.createdAt.getTime();
      if (!p) {
        p = {
          firstAt: at,
          lastAt: at,
          doneAt: null,
          maxStage: -1,
          stageAt: new Map(),
          lastAction: "",
          lastField: null,
          lastFailMessage: null,
          google: false,
          fields: new Set(),
          errorKeys: new Set(),
          sessionIds: new Set(),
          env: {},
        };
        byFlow.set(key, p);
      }
      p.lastAt = Math.max(p.lastAt, at);
      p.lastAction = ev.action;
      if (ev.sessionId) p.sessionIds.add(ev.sessionId);
      if (meta.google === true) p.google = true;
      if (typeof meta.device === "string" && !p.env.device) p.env.device = meta.device;
      if (typeof meta.os === "string" && !p.env.os) p.env.os = meta.os;
      if (typeof meta.browser === "string" && !p.env.browser) p.env.browser = meta.browser;

      const idx = stageIndex(flow, ev.action, meta);
      if (idx >= 0) {
        // Llegar a una etapa implica haber pasado por las anteriores (p. ej. un
        // enlace directo a /register?type=… no manda "eligió tipo").
        for (let i = 0; i <= idx; i++) if (!p.stageAt.has(i)) p.stageAt.set(i, at);
        p.maxStage = Math.max(p.maxStage, idx);
      }
      if (ev.action === "reg_done" && p.doneAt === null) p.doneAt = at;
      if (ev.action === "reg_field" && typeof meta.field === "string") {
        p.fields.add(meta.field);
        p.lastField = meta.field;
      }
      if ((ev.action === "reg_error" || ev.action === "reg_fail") && typeof meta.message === "string") {
        const message = normalizeMessage(meta.message);
        if (ev.action === "reg_fail") p.lastFailMessage = message;
        let byMsg = errors.get(flow);
        if (!byMsg) errors.set(flow, (byMsg = new Map()));
        const where = meta.step ?? (ev.action === "reg_fail" ? "creación" : "");
        const errKey = `${where}|${typeof meta.field === "string" ? meta.field : ""}|${message}`;
        let e = byMsg.get(errKey);
        if (!e) byMsg.set(errKey, (e = { events: 0, people: new Set() }));
        e.events++;
        e.people.add(key);
        p.errorKeys.add(errKey);
      }
    }

    /* Dispositivo y fuente de las personas sin esos datos en sus eventos
       (los anteriores a este cambio): la primera página vista de su sesión. */
    const missing = new Set<string>();
    for (const byFlow of people.values()) {
      for (const p of byFlow.values()) {
        if (!p.env.source || !p.env.device) for (const sid of p.sessionIds) missing.add(sid);
      }
    }
    const envBySession = new Map<string, Env>();
    const sids = [...missing];
    for (let i = 0; i < sids.length; i += 5000) {
      const chunk = sids.slice(i, i + 5000);
      const rows = await prisma.$queryRaw<
        { sessionId: string; userAgent: string | null; device: string | null; referrer: string | null; utmSource: string | null }[]
      >(Prisma.sql`
        SELECT DISTINCT ON ("sessionId") "sessionId", "userAgent", "device", "referrer", "utmSource"
        FROM "PageView"
        WHERE "sessionId" IN (${Prisma.join(chunk)})
          AND "createdAt" >= ${new Date(since.getTime() - 24 * 60 * 60 * 1000)}
        ORDER BY "sessionId", "createdAt" ASC
      `);
      for (const r of rows) {
        const ua = r.userAgent ?? "";
        envBySession.set(r.sessionId, {
          device: r.device ?? deviceFromUserAgent(ua) ?? "desconocido",
          os: ua ? osFromUserAgent(ua) : "desconocido",
          browser: ua ? browserFromUserAgent(ua) : "desconocido",
          source: sourceFrom(r.referrer, r.utmSource),
        });
      }
    }
    for (const byFlow of people.values()) {
      for (const p of byFlow.values()) {
        const fromView = [...p.sessionIds].map((s) => envBySession.get(s)).find(Boolean);
        p.env = {
          device: p.env.device ?? fromView?.device ?? "desconocido",
          os: p.env.os ?? fromView?.os ?? "desconocido",
          browser: p.env.browser ?? fromView?.browser ?? "desconocido",
          source: fromView?.source ?? "desconocido",
        };
      }
    }

    const flows = [...FLOWS].map((flow) => {
      const stages = stagesFor(flow);
      const doneIdx = stages.findIndex((s) => s.key === "done");
      const submitIdx = stages.findIndex((s) => s.key === "submit");
      const byFlow = people.get(flow) ?? new Map<string, Person>();

      const reached = stages.map(() => 0);
      const stageGaps: number[][] = stages.map(() => []);
      const fieldTouched = new Map<string, number>();
      const fieldAbandon = new Map<string, number>();
      const dropPoints = new Map<string, number>();
      const failMessages = new Map<string, { people: number; recovered: number }>();
      const segments = {
        device: new Map<string, { people: number; done: number }>(),
        os: new Map<string, { people: number; done: number }>(),
        browser: new Map<string, { people: number; done: number }>(),
        source: new Map<string, { people: number; done: number }>(),
        method: new Map<string, { people: number; done: number }>(),
      };
      const daily = new Map<string, { started: number; done: number; abandoned: number }>();
      const doneTimes: number[] = [];
      const abandonTimes: number[] = [];
      const recentFails: {
        at: string;
        message: string;
        device: string;
        os: string;
        browser: string;
        google: boolean;
        recovered: boolean;
      }[] = [];
      let done = 0;
      let inProgress = 0;
      let abandoned = 0;
      let googleDone = 0;
      let failedPeople = 0;
      let failedRecovered = 0;

      const statusOf = new Map<string, "done" | "progress" | "abandoned">();

      for (const [key, p] of byFlow) {
        const isDone = p.maxStage >= doneIdx;
        const status = isDone ? "done" : now - p.lastAt < IDLE_MS ? "progress" : "abandoned";
        statusOf.set(key, status);

        for (let i = 0; i <= p.maxStage && i < reached.length; i++) reached[i]++;
        for (let i = 1; i <= p.maxStage && i < stages.length; i++) {
          const a = p.stageAt.get(i - 1);
          const b = p.stageAt.get(i);
          if (a !== undefined && b !== undefined && b >= a) stageGaps[i].push(b - a);
        }
        for (const f of p.fields) bump(fieldTouched, f);

        const env = p.env as Env;
        const seg: [keyof typeof segments, string][] = [
          ["device", env.device],
          ["os", env.os],
          ["browser", env.browser],
          ["source", env.source],
          ["method", p.google ? "Google" : "Email"],
        ];
        for (const [dim, value] of seg) {
          const m = segments[dim];
          let row = m.get(value);
          if (!row) m.set(value, (row = { people: 0, done: 0 }));
          row.people++;
          if (isDone) row.done++;
        }

        const startDay = chileToday(new Date(p.firstAt));
        let d = daily.get(startDay);
        if (!d) daily.set(startDay, (d = { started: 0, done: 0, abandoned: 0 }));
        d.started++;
        if (isDone) d.done++;
        if (status === "abandoned") d.abandoned++;

        if (p.lastFailMessage) {
          failedPeople++;
          if (isDone) failedRecovered++;
        }

        if (isDone) {
          done++;
          if (p.google) googleDone++;
          if (p.doneAt !== null) doneTimes.push(p.doneAt - p.firstAt);
          continue;
        }
        if (status === "progress") {
          inProgress++;
          continue;
        }
        abandoned++;
        abandonTimes.push(p.lastAt - p.firstAt);
        // Dónde se quedó: si la creación falló, eso manda (aunque después
        // haya vuelto a tocar campos); si ya envió → la etapa; si no → el
        // último campo.
        let point: string;
        if (p.lastFailMessage) {
          point = "stage:fail";
        } else if (p.maxStage >= submitIdx) {
          point = `stage:${stages[p.maxStage]?.key ?? "submit"}`;
        } else if (p.lastField) {
          point = `field:${p.lastField}`;
          bump(fieldAbandon, p.lastField);
        } else {
          point = p.maxStage >= 0 ? "stage:untouched" : "stage:none";
        }
        bump(dropPoints, point);
      }

      // Fallos al crear la cuenta: por mensaje (una vez por persona) y los
      // más recientes.
      const failSeen = new Set<string>();
      for (const ev of events) {
        if (ev.action !== "reg_fail") continue;
        const meta = (ev.metadata ?? {}) as Record<string, unknown>;
        if (meta.flow !== flow) continue;
        const key = ev.visitorId || ev.sessionId;
        const p = key ? byFlow.get(key) : undefined;
        if (!p || !key) continue;
        const message = normalizeMessage(typeof meta.message === "string" ? meta.message : "Sin mensaje");
        const recovered = statusOf.get(key) === "done";
        const env = p.env as Env;
        recentFails.push({
          at: ev.createdAt.toISOString(),
          message,
          device: env.device,
          os: env.os,
          browser: env.browser,
          google: meta.google === true,
          recovered,
        });
        if (failSeen.has(`${message}|${key}`)) continue;
        failSeen.add(`${message}|${key}`);
        let row = failMessages.get(message);
        if (!row) failMessages.set(message, (row = { people: 0, recovered: 0 }));
        row.people++;
        if (recovered) row.recovered++;
      }

      const segmentRows = (m: Map<string, { people: number; done: number }>) =>
        sortedEntries(m, (v) => v.people, 12).map(([key, v]) => ({ key, people: v.people, done: v.done }));

      return {
        flow,
        sessions: byFlow.size,
        done,
        googleDone,
        inProgress,
        abandoned,
        failedPeople,
        failedRecovered,
        medianDoneMinutes: median(doneTimes) !== null ? median(doneTimes)! / 60000 : null,
        medianAbandonMinutes: median(abandonTimes) !== null ? median(abandonTimes)! / 60000 : null,
        stages: stages.map((st, i) => {
          const gap = median(stageGaps[i]);
          return {
            key: st.key,
            label: st.label,
            count: reached[i],
            medianSecondsFromPrev: i > 0 && gap !== null ? Math.round(gap / 1000) : null,
          };
        }),
        fields: sortedEntries(fieldTouched, (v) => v).map(([field, touched]) => ({
          field,
          touched,
          abandonedHere: fieldAbandon.get(field) ?? 0,
        })),
        dropPoints: sortedEntries(dropPoints, (v) => v).map(([point, count]) => ({ point, count })),
        errors: sortedEntries(errors.get(flow) ?? new Map(), (v) => v.people.size, 30).map(([k, v]) => {
          const [step, field, ...rest] = k.split("|");
          let peopleDone = 0;
          let peopleAbandoned = 0;
          for (const key of v.people) {
            const st = statusOf.get(key);
            if (st === "done") peopleDone++;
            else if (st === "abandoned") peopleAbandoned++;
          }
          return {
            step,
            field: field || null,
            message: rest.join("|"),
            count: v.events,
            people: v.people.size,
            peopleDone,
            peopleAbandoned,
          };
        }),
        failures: sortedEntries(failMessages, (v) => v.people, 15).map(([message, v]) => ({
          message,
          people: v.people,
          recovered: v.recovered,
        })),
        recentFails: recentFails.slice(-15).reverse(),
        segments: {
          device: segmentRows(segments.device),
          os: segmentRows(segments.os),
          browser: segmentRows(segments.browser),
          source: segmentRows(segments.source),
          method: segmentRows(segments.method),
        },
        daily: [...daily.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([day, v]) => ({ day, ...v })),
      };
    });

    let noType = 0;
    for (const v of viewers) if (!flowPeople.has(v)) noType++;

    res.json({
      period,
      since: since.toISOString(),
      generatedAt: new Date(now).toISOString(),
      idleMinutes: IDLE_MS / 60000,
      visits: viewers.size,
      visitsNoType: noType,
      truncated: events.length >= 300_000,
      accountsCreated: Object.fromEntries(
        createdByType.map((r) => [r.profileType ?? "OTHER", r._count.id]),
      ),
      flows,
    });
  }),
);

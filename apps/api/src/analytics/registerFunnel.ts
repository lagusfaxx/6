import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";

/**
 * Embudo del registro (clientes, profesionales, locales y tiendas).
 *
 * El formulario manda eventos `reg_*` (ver apps/web/lib/registerFunnel.ts) que
 * se guardan en UserAction con sessionId del navegador. El reporte agrupa por
 * sesión y tipo de cuenta: hasta qué etapa llegó cada una y, de las que no
 * terminaron, cuál fue el último campo que tocaron.
 *
 * Sólo lee y escribe UserAction: no toca el registro en sí.
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

registerFunnelRouter.post(
  "/analytics/register-funnel",
  funnelLimiter,
  asyncHandler(async (req, res) => {
    const { action, metadata, sessionId, visitorId } = req.body ?? {};
    if (typeof action !== "string" || !FUNNEL_ACTIONS.has(action)) {
      return res.status(400).json({ error: "action invalid" });
    }
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

/** Una visita sin eventos en 30 min se da por abandonada; antes, "en curso". */
const IDLE_MS = 30 * 60 * 1000;

type FlowSession = {
  maxStage: number;
  lastAt: number;
  lastAction: string;
  lastField: string | null;
  currentStep: number | null;
  google: boolean;
  fields: Set<string>;
};

function bump(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

function sortedEntries(map: Map<string, number>, limit = 50) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
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

    const [events, createdByType] = await Promise.all([
      prisma.userAction.findMany({
        where: { action: { startsWith: "reg_" }, createdAt: { gte: since } },
        select: { sessionId: true, visitorId: true, action: true, metadata: true, createdAt: true },
        orderBy: { createdAt: "asc" },
        take: 300_000,
      }),
      // Cuentas que de verdad se crearon en el periodo, para contrastar.
      prisma.user.groupBy({
        by: ["profileType"],
        where: { createdAt: { gte: since } },
        _count: { id: true },
      }),
    ]);

    const viewSessions = new Set<string>();
    const sessions = new Map<string, Map<string, FlowSession>>(); // flow -> session -> estado
    const errors = new Map<string, Map<string, number>>(); // flow -> "paso|campo|mensaje" -> n

    for (const ev of events) {
      const key = ev.sessionId || ev.visitorId;
      if (!key) continue;
      const meta = (ev.metadata ?? {}) as Record<string, unknown>;
      if (ev.action === "reg_view") {
        viewSessions.add(key);
        continue;
      }
      const flow = typeof meta.flow === "string" && FLOWS.has(meta.flow) ? meta.flow : null;
      if (!flow) continue;

      let byFlow = sessions.get(flow);
      if (!byFlow) sessions.set(flow, (byFlow = new Map()));
      let s = byFlow.get(key);
      if (!s) {
        s = {
          maxStage: -1,
          lastAt: 0,
          lastAction: "",
          lastField: null,
          currentStep: null,
          google: false,
          fields: new Set(),
        };
        byFlow.set(key, s);
      }
      const at = ev.createdAt.getTime();
      s.lastAt = Math.max(s.lastAt, at);
      s.lastAction = ev.action;
      if (meta.google === true) s.google = true;
      s.maxStage = Math.max(s.maxStage, stageIndex(flow, ev.action, meta));
      if (ev.action === "reg_step" && typeof meta.step === "number") s.currentStep = meta.step;
      if (ev.action === "reg_field" && typeof meta.field === "string") {
        s.fields.add(meta.field);
        s.lastField = meta.field;
      }
      if ((ev.action === "reg_error" || ev.action === "reg_fail") && typeof meta.message === "string") {
        let byMsg = errors.get(flow);
        if (!byMsg) errors.set(flow, (byMsg = new Map()));
        const where = meta.step ?? (ev.action === "reg_fail" ? "creación" : "");
        bump(byMsg, `${where}|${typeof meta.field === "string" ? meta.field : ""}|${meta.message}`);
      }
    }

    const flows = [...FLOWS].map((flow) => {
      const stages = stagesFor(flow);
      const doneIdx = stages.findIndex((s) => s.key === "done");
      const submitIdx = stages.findIndex((s) => s.key === "submit");
      const byFlow = sessions.get(flow) ?? new Map<string, FlowSession>();

      const reached = stages.map(() => 0);
      const fieldTouched = new Map<string, number>();
      const fieldAbandon = new Map<string, number>();
      const dropPoints = new Map<string, number>();
      let done = 0;
      let inProgress = 0;
      let abandoned = 0;
      let googleDone = 0;

      for (const s of byFlow.values()) {
        for (let i = 0; i <= s.maxStage && i < reached.length; i++) reached[i]++;
        for (const f of s.fields) bump(fieldTouched, f);
        if (s.maxStage >= doneIdx) {
          done++;
          if (s.google) googleDone++;
          continue;
        }
        if (now - s.lastAt < IDLE_MS) {
          inProgress++;
          continue;
        }
        abandoned++;
        // Dónde se quedó: ya enviado → la etapa; si no → el último campo.
        let point: string;
        if (s.maxStage >= submitIdx) {
          point =
            s.lastAction === "reg_fail"
              ? "stage:fail"
              : `stage:${stages[s.maxStage]?.key ?? "submit"}`;
        } else if (s.lastField) {
          point = `field:${s.lastField}`;
          bump(fieldAbandon, s.lastField);
        } else {
          point = s.maxStage >= 0 ? "stage:untouched" : "stage:none";
        }
        bump(dropPoints, point);
      }

      return {
        flow,
        sessions: byFlow.size,
        done,
        googleDone,
        inProgress,
        abandoned,
        stages: stages.map((st, i) => ({ key: st.key, label: st.label, count: reached[i] })),
        fields: sortedEntries(fieldTouched).map(([field, touched]) => ({
          field,
          touched,
          abandonedHere: fieldAbandon.get(field) ?? 0,
        })),
        dropPoints: sortedEntries(dropPoints).map(([point, count]) => ({ point, count })),
        errors: sortedEntries(errors.get(flow) ?? new Map(), 25).map(([k, count]) => {
          const [step, field, ...rest] = k.split("|");
          return { step, field: field || null, message: rest.join("|"), count };
        }),
      };
    });

    res.json({
      period,
      since: since.toISOString(),
      generatedAt: new Date(now).toISOString(),
      idleMinutes: IDLE_MS / 60000,
      visits: viewSessions.size,
      truncated: events.length >= 300_000,
      accountsCreated: Object.fromEntries(
        createdByType.map((r) => [r.profileType ?? "OTHER", r._count.id]),
      ),
      flows,
    });
  }),
);

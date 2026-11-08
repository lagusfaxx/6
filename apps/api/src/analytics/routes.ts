import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../db";
import { asyncHandler } from "../lib/asyncHandler";
import { broadcast } from "../realtime/sse";
import { MARKETING_PERIODS, buildMarketingDashboard, type MarketingPeriod } from "./marketing";

export const analyticsRouter = Router();

/** Ids que genera el navegador (UUID): se aceptan sólo si tienen esa forma. */
function clientId(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9-]{8,64}$/.test(value) ? value : null;
}

function shortText(value: unknown, max = 100): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim().replace(/[\u0000-\u001f]/g, "");
  return t ? t.slice(0, max) : null;
}

/** "mobile" | "tablet" | "desktop" a partir del user agent. */
export function deviceFromUserAgent(ua: string | null | undefined): string | null {
  if (!ua) return null;
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone|iPod|Windows Phone|Opera Mini|IEMobile/i.test(ua)) return "mobile";
  return "desktop";
}

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  message: { error: "TOO_MANY_REQUESTS" },
  standardHeaders: true,
  legacyHeaders: false,
});

/* ─── Track page view (called from frontend) ─── */

analyticsRouter.post(
  "/analytics/pageview",
  analyticsLimiter,
  asyncHandler(async (req, res) => {
    const { path, referrer, sessionId, visitorId, utm, standalone } = req.body;
    if (!path || typeof path !== "string") {
      return res.status(400).json({ error: "path required" });
    }

    const userId = req.session?.userId || null;
    const userAgent = req.headers["user-agent"] || null;
    const forwarded = req.headers["x-forwarded-for"];
    const ip = typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : req.ip;

    // Basic city/country from Cloudflare or similar headers
    const city = (req.headers["cf-ipcity"] as string) || (req.headers["x-vercel-ip-city"] as string) || null;
    const country = (req.headers["cf-ipcountry"] as string) || (req.headers["x-vercel-ip-country"] as string) || null;

    await prisma.pageView.create({
      data: {
        path: path.slice(0, 500),
        userId,
        sessionId: clientId(sessionId),
        visitorId: clientId(visitorId),
        utmSource: shortText(utm?.source),
        utmMedium: shortText(utm?.medium),
        utmCampaign: shortText(utm?.campaign),
        device: deviceFromUserAgent(typeof userAgent === "string" ? userAgent : null),
        displayMode: standalone === true ? "pwa" : "browser",
        referrer: referrer ? String(referrer).slice(0, 500) : null,
        userAgent: userAgent ? String(userAgent).slice(0, 500) : null,
        city,
        country,
      },
    });

    res.json({ ok: true });
  }),
);

/* ─── Impresiones en listados (una llamada por página de resultados) ───
   Agregado por perfil y día: cuántas veces apareció y en qué posiciones.
   Con las vistas de la ficha da el CTR listado → perfil. */

analyticsRouter.post(
  "/analytics/impressions",
  analyticsLimiter,
  asyncHandler(async (req, res) => {
    const ids: unknown = req.body?.ids;
    const start = Number(req.body?.start) || 0;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "ids required" });
    const clean = ids
      .slice(0, 120)
      .filter((v): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v));
    if (!clean.length) return res.json({ ok: true });
    const positions = clean.map((_, i) => start + i + 1);
    // Un solo upsert para toda la página. La fecha es la de Chile.
    await prisma.$executeRaw`
      INSERT INTO "ProfileDailyStats" ("profileId", "date", "impressions", "positionSum", "updatedAt")
      SELECT id, (now() AT TIME ZONE 'America/Santiago')::date, 1, pos, now()
      FROM unnest(${clean}::uuid[], ${positions}::int[]) AS t(id, pos)
      ON CONFLICT ("profileId", "date") DO UPDATE
        SET "impressions" = "ProfileDailyStats"."impressions" + 1,
            "positionSum" = "ProfileDailyStats"."positionSum" + EXCLUDED."positionSum",
            "updatedAt" = now()`;
    res.json({ ok: true });
  }),
);

/* ─── Track user action (called from frontend) ─── */

analyticsRouter.post(
  "/analytics/action",
  analyticsLimiter,
  asyncHandler(async (req, res) => {
    const { action, targetId, metadata, sessionId, visitorId } = req.body;
    if (!action || typeof action !== "string") {
      return res.status(400).json({ error: "action required" });
    }

    const userId = req.session?.userId || null;

    console.log("[analytics] action:", action, "target:", targetId, "user:", userId);

    await prisma.userAction.create({
      data: {
        action: action.slice(0, 100),
        userId,
        sessionId: clientId(sessionId),
        visitorId: clientId(visitorId),
        targetId: targetId || null,
        metadata: metadata || null,
      },
    });

    // Social proof broadcast on WhatsApp click
    if (action === "whatsapp_click" && metadata?.displayName) {
      broadcast("social_proof", {
        kind: "whatsapp",
        displayName: String(metadata.displayName),
        profileId: targetId || null,
        t: Date.now(),
      });
    }

    res.json({ ok: true });
  }),
);

/* ─── Admin: panel de marketing (/admin/estadisticas) ─── */

analyticsRouter.get(
  "/admin/analytics",
  asyncHandler(async (req, res) => {
    // Esta ruta no pasa por requireAdmin: valida el rol a mano. Las cuentas
    // de equipo (MODERATOR) también leen estadísticas, y sólo es un GET.
    if (!req.session?.userId) return res.status(401).json({ error: "UNAUTHENTICATED" });
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { role: true },
    });
    if (user?.role !== "ADMIN" && user?.role !== "MODERATOR") {
      return res.status(403).json({ error: "FORBIDDEN" });
    }
    const raw = String(req.query.period || "30d");
    const period = (MARKETING_PERIODS as readonly string[]).includes(raw) ? (raw as MarketingPeriod) : "30d";
    res.json(await buildMarketingDashboard(period));
  }),
);
